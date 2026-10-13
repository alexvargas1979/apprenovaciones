import {createClient} from '@supabase/supabase-js';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
const cfg=JSON.parse(execFileSync(process.env.SUPABASE_CLI??'supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(cfg.API_URL,'http://127.0.0.1:54321');
const origin='http://127.0.0.1:3000',prefix='hu60-drafts-'+randomUUID(),users=[],cookies=[],clients=[];
const admin=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
const sql=s=>execFileSync('docker',['exec','-i','supabase_db_apprenovaciones-local','psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input:s,encoding:'utf8',stdio:['pipe','pipe','pipe']});
const bundle=await build({stdin:{contents:`export {defaultDetail,termsDue} from './lib/invoices';export {fresh} from './lib/model'; export {emptyInvestment} from './lib/investment'; export {emptyOperations,freezeBudget} from './lib/operations'; export {accountingSummary} from './lib/accounting';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {defaultDetail,termsDue,fresh,emptyInvestment,emptyOperations,freezeBudget,accountingSummary}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
let checks=0,book,version='';const pass=s=>{checks++;console.log('PASS '+s);};
const request=(path,body,method='POST',cookie=cookies[0],from=origin)=>fetch(origin+path,{method,headers:{cookie:cookie??'',origin:from,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
const put=p=>request('/api/properties',p,'PUT');
const date=new Date().toISOString().slice(0,10);
const act=async(action,data,status=201)=>{const r=await request('/api/accounting',{action,data,version,date,reason:'Synthetic test',requestId:randomUUID()});const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));if(status===201){book=b.book;version=b.version;}return b;};
try{
 for(let i=0;i<2;i++){
  const email=prefix+i+'@example.invalid',password=randomBytes(24).toString('hex');const u=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(u.error);users.push(u.data.user.id);
  const login=await fetch(origin+'/auth/login',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email,password}),redirect:'manual'});assert.equal(login.status,303);cookies.push(login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '));
  const c=createClient(cfg.API_URL,cfg.PUBLISHABLE_KEY??cfg.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});assert.ifError((await c.auth.signInWithPassword({email,password})).error);clients.push(c);
 }
 if(process.argv.includes('--expect-disabled')){
  for(const [path,method] of [['/api/invoice-drafts','GET'],['/api/invoice-drafts','POST'],['/api/expense-recurring','POST']]){assert.equal((await request(path,method==='GET'?undefined:{},method)).status,503);pass(path+' '+method+' disabled by default');}
 }else{
 const p=fresh();p.name='Draft test';p.workflow={stage:'Análisis',responsible:'Ana',planB:false};p.workflowEdit={reason:'Synthetic creation',date};p.id=prefix+'-p';
 let r=await put({...p,requestId:randomUUID()});assert.equal(r.status,200,await r.clone().text());
 const id=prefix+'-d',detail=defaultDetail(id,date),invoice={declaredTotal:10,supplierId:prefix+'-supplier',number:'INV-DRAFT',due:termsDue(detail),documentId:'',documentPropertyId:p.id,contractId:'',creditFor:'',duplicateReason:'',detail,lines:[{id:prefix+'-line',propertyId:p.id,bucket:'line:1',category:'Materiales',description:'Blue paint',subtotal:10,tax:0,retention:0,included:0,sourceLineId:''}]};
 const body={id,propertyId:p.id,status:'Borrador',updatedAt:'',invoice,note:'Synthetic',requestId:randomUUID(),workflow:{createdBy:'forged',review:{actor:'forged'},history:[]}};
 const post=(b,c=cookies[0])=>request('/api/invoice-drafts',b,'POST',c);
 const get=(extra='',c=cookies[0])=>request('/api/invoice-drafts?propertyId='+p.id+extra,undefined,'GET',c);
 assert.equal((await post(body,'')).status,401);pass('anonymous draft write denied');
 assert.equal((await request('/api/invoice-drafts',body,'POST',cookies[0],'https://bad.example')).status,403);pass('foreign origin denied');
 assert.equal((await post(body,cookies[1])).status,400);pass('foreign property cannot receive draft');
 r=await post(body);assert.equal(r.status,201,await r.clone().text());let draft=(await r.json()).draft;assert.equal(draft.workflow.createdBy,users[0]);assert.equal(draft.workflow.review,undefined);pass('draft saves with server-owned history');
 r=await post(body);assert.equal(r.status,201,await r.clone().text());assert.equal((await r.json()).replayed,true);pass('draft retry is idempotent');
 assert.equal((await post({...body,note:'Changed'})).status,409);pass('request identity cannot be reused');
 r=await get('&id='+id);assert.equal(r.status,200);assert.deepEqual((await r.json()).draft,draft);pass('draft reload preserves data');
 assert.equal((await get('&id='+id,cookies[1])).status,404);pass('other owner cannot read draft');
 const listed=await (await get('&q=paint&supplier='+invoice.supplierId+'&status=Borrador&from='+date+'&to='+date)).json();assert.equal(listed.drafts.length,1);assert.equal(listed.drafts[0].id,id);pass('list filters number supplier date and description');
 assert.equal((await get('&from=invalid')).status,400);assert.equal((await get('&offset=-1')).status,400);pass('invalid filters rejected');
 assert.equal((await post({...body,requestId:randomUUID()})).status,409);pass('stale draft denied');
 const races=await Promise.all(['First','Second'].map(note=>post({...draft,note,requestId:randomUUID()})));assert.deepEqual(races.map(r=>r.status).sort(),[201,409]);draft=(await races.find(r=>r.status===201).json()).draft;pass('concurrent draft edits have one winner');
 r=await post({...draft,status:'En revisión',requestId:randomUUID()});assert.equal(r.status,201,await r.clone().text());draft=(await r.json()).draft;
 r=await post({...draft,reviewAction:'review',observation:'Checked',requestId:randomUUID()});assert.equal(r.status,201,await r.clone().text());draft=(await r.json()).draft;assert.equal(draft.workflow.review.actor,users[0]);pass('review stores verified actor and observation');
 r=await post({...draft,invoice:{...draft.invoice,number:'INV-EDITED'},requestId:randomUUID()});assert.equal(r.status,201,await r.clone().text());draft=(await r.json()).draft;assert.equal(draft.status,'Borrador');assert.equal(draft.workflow.review,undefined);pass('editing invoice invalidates prior review');
 sql(`create function public.hu60_draft_http_fail() returns trigger language plpgsql as $$begin if new.user_id=${q(users[0])} then raise exception 'synthetic draft audit failure';end if;return new;end$$;create trigger hu60_draft_http_fail before insert on public.audit_events for each row execute function public.hu60_draft_http_fail();`);
 try{assert.equal((await post({...draft,note:'Must roll back',requestId:randomUUID()})).status,500);}finally{sql('drop trigger hu60_draft_http_fail on public.audit_events;drop function public.hu60_draft_http_fail();');}
 assert.deepEqual((await (await get('&id='+id)).json()).draft,draft);pass('failed audit rolls back entire draft update');
 await act('supplier',{id:invoice.supplierId,name:'Supplier',contact:'Ana',phone:'555',email:'',address:'',note:''});
 const template={id:prefix+'-template',propertyId:p.id,name:'Monthly materials',frequency:'Mensual',start:date,end:'2027-12-31',active:true,invoice};
 await act('expense:template',template);
 const recur={templateId:template.id,period:date,requestId:randomUUID()};
 r=await request('/api/expense-recurring',recur);assert.equal(r.status,201,await r.clone().text());const rec=(await r.json()).id;pass('recurring period creates draft from stored template');
 r=await request('/api/expense-recurring',recur);assert.equal(r.status,201);assert.equal((await r.json()).replayed,true);pass('recurring request retry returns same draft');
 assert.equal((await request('/api/expense-recurring',{...recur,requestId:randomUUID()})).status,409);pass('same period cannot create a second draft');
 assert.equal((await request('/api/expense-recurring',{...recur,period:'2099-01-01',requestId:randomUUID()})).status,400);pass('future period rejected');
 let rd=(await (await get('&id='+rec)).json()).draft;assert.deepEqual(rd.invoice.detail.recurring,{templateId:template.id,period:date});assert.equal(rd.invoice.number,'');assert.equal(rd.invoice.documentId,'');pass('recurring draft keeps origin and requires real invoice details');
 const removed=structuredClone(rd);delete removed.invoice.detail.recurring;assert.equal((await post({...removed,requestId:randomUUID()})).status,400);pass('recurring origin cannot be stripped');
 r=await post({...rd,note:'Confirmed amount',requestId:randomUUID()});assert.equal(r.status,201,await r.clone().text());pass('generated draft remains editable');
 assert((await clients[0].from('expense_drafts').update({status:'Rechazado'}).eq('id',id)).error);pass('direct database mutation denied');
 assert.equal((await post({...draft,grantId:'unmigrated',requestId:randomUUID()})).status,503);pass('unmigrated collaborator path remains blocked');
 const doc=prefix+'-doc';sql(`insert into public.property_documents(id,group_id,property_id,user_id,version,object_key,filename,mime,size,sha256,title,category,link_type,link_ref,note,created_at) values(${q(doc)},${q(doc)},${q(p.id)},${q(users[0])},1,${q(doc)},'synthetic.pdf','application/pdf',20,repeat('b',64),'Test','Otros','','','',now());`);
 const issued=structuredClone(draft.invoice);issued.documentId=doc;issued.detail.noOrderReason='Synthetic expense';issued.detail.attachments=[{documentId:doc,propertyId:p.id,pages:'',kind:'Factura'}];
 await act('invoice',issued);assert.equal((await post({...draft,note:'After issue',requestId:randomUUID()})).status,409);pass('issued invoice locks its source draft');
 }
 console.log(JSON.stringify({checks,production_modified:false}));
}finally{
 for(const cookie of cookies)await fetch(origin+'/auth/logout',{method:'POST',headers:{cookie,origin},redirect:'manual'});
 for(const c of clients)await c.auth.signOut();
 for(const id of users){sql(`begin;delete from public.expense_drafts where user_id=${q(id)};delete from public.property_deletions where user_id=${q(id)};delete from public.expense_allocations where user_id=${q(id)};delete from public.expense_lines where user_id=${q(id)};delete from public.expense_invoices where user_id=${q(id)};delete from public.expense_classification_history where user_id=${q(id)};delete from public.expense_legacy_backup where user_id=${q(id)};delete from public.accounting_books where user_id=${q(id)};delete from public.property_documents where user_id=${q(id)};delete from public.audit_events where user_id=${q(id)};delete from public.opening_balances where user_id=${q(id)};delete from public.investment_projects where user_id=${q(id)};delete from public.property_baselines where user_id=${q(id)};delete from public.properties where user_id=${q(id)};commit;`);assert.ifError((await admin.auth.admin.deleteUser(id)).error);}
}
