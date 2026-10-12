import {createClient} from '@supabase/supabase-js';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
const cfg=JSON.parse(execFileSync(process.env.SUPABASE_CLI??'supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(cfg.API_URL,'http://127.0.0.1:54321');
const origin='http://127.0.0.1:3000',prefix='hu60-owner-'+randomUUID(),users=[],cookies=[],clients=[];
const admin=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
const sql=s=>execFileSync('docker',['exec','-i','supabase_db_apprenovaciones-local','psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input:s,encoding:'utf8',stdio:['pipe','pipe','pipe']});
const bundle=await build({stdin:{contents:`export {fresh} from './lib/model'; export {emptyInvestment} from './lib/investment'; export {emptyOperations,freezeBudget} from './lib/operations'; export {accountingSummary} from './lib/accounting';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {fresh,emptyInvestment,emptyOperations,freezeBudget,accountingSummary}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
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
  for(const [path,method] of [['/api/properties','PUT'],['/api/accounting','POST'],['/api/operations','POST']]){assert.equal((await request(path,{},method)).status,503);pass(path+' disabled by default');}
 }else{
 let p=fresh();p.name='Synthetic owner';p.workflow={stage:'Análisis',responsible:'Ana',planB:false};p.workflowEdit={reason:'Synthetic creation',date};p.id=prefix+'-p';p.rehab={mode:'Manual',manual:20000,rate:null,overlapReviewed:true};p.investment=emptyInvestment(p);Object.assign(p.investment,{purchase:100000,arv:150000,purchaseDate:'2026-08-01',saleDate:'2027-02-01',costsReviewed:true});p.investment.loan.type='Efectivo';
 const input={...p,requestId:randomUUID()};
 assert.equal((await request('/api/properties',input,'PUT','')).status,401);pass('anonymous denied');
 assert.equal((await request('/api/properties',input,'PUT',cookies[0],'https://bad.example')).status,403);pass('foreign origin denied');
 let r=await put(input);assert.equal(r.status,200,await r.clone().text());p=(await r.json()).property;pass('create full property with user session');
 r=await put(input);assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).replayed,true);pass('retry after lost response does not recreate');
 assert.equal((await put({...input,name:'Different'})).status,409);pass('request reuse with different contents conflicts');
 assert.equal((await request('/api/properties',{...p,name:'Other owner',requestId:randomUUID()},'PUT',cookies[1])).status,409);pass('other owner cannot edit');
 const race=await Promise.all(['Race A','Race B'].map(name=>put({...p,name,requestId:randomUUID()})));assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);p=(await race.find(r=>r.status===200).json()).property;pass('simultaneous property edits have one winner');
 assert((await clients[0].rpc('commit_validated_owner_change',{message:'{}',signature:'fake'})).error);pass('direct unsigned mutation rejected');
 assert((await clients[0].from('properties').update({payload:{name:'bypass'}}).eq('id',p.id)).error);pass('direct table update denied');
 const budgetRequest={propertyId:p.id,updatedAt:p.updatedAt,action:'budget',data:{},date,reason:'Synthetic budget',requestId:randomUUID()};
 r=await request('/api/operations',budgetRequest);assert.equal(r.status,201,await r.clone().text());p=(await r.json()).property;assert(p.operations.budget.base.total>0);const frozen=structuredClone(p.operations.budget.base);pass('budget approval persists immutable base');
 r=await request('/api/operations',budgetRequest);assert.equal(r.status,201,await r.clone().text());assert.equal((await r.json()).replayed,true);pass('budget retry is idempotent');
 const orderRequest={propertyId:p.id,updatedAt:p.updatedAt,action:'order',data:{lineId:'',scope:'Extra work',amount:500,reserve:0,findingId:'',decisionReview:''},date,reason:'Synthetic order',requestId:randomUUID()};
 r=await request('/api/operations',orderRequest);assert.equal(r.status,201,await r.clone().text());p=(await r.json()).property;assert.equal(p.operations.budget.orders.length,1);assert.deepEqual(p.operations.budget.base,frozen);pass('change order preserves approved budget base');
 r=await request('/api/operations',{...orderRequest,requestId:randomUUID()});assert.equal(r.status,409);pass('stale operation rejected');
 const supplier={id:prefix+'-vendor',name:'Test vendor',contact:'Ana',phone:'555',email:'',address:'',note:''};
 const supplierRequest={action:'supplier',data:supplier,version,date,reason:'Synthetic test',requestId:randomUUID()};
 r=await request('/api/accounting',supplierRequest);assert.equal(r.status,201,await r.clone().text());({book,version}=await r.json());pass('supplier commits with audit');
 r=await request('/api/accounting',supplierRequest);assert.equal(r.status,201,await r.clone().text());assert.equal((await r.json()).replayed,true);pass('supplier retry is idempotent');
 const same={action:'supplier',data:{...supplier,name:'Updated vendor'},version,date,reason:'Same concurrent request',requestId:randomUUID()};
 const sameResults=await Promise.all([request('/api/accounting',same),request('/api/accounting',same)]);assert(sameResults.every(r=>r.status===201));const [s1,s2]=await Promise.all(sameResults.map(r=>r.json()));assert.deepEqual(s1.book,s2.book);assert.equal(s1.version,s2.version);({book,version}=s1);pass('concurrent identical commands return the persisted book');
 const doc=prefix+'-doc';
 sql(`insert into public.property_documents(id,group_id,property_id,user_id,version,object_key,filename,mime,size,sha256,title,category,link_type,link_ref,note,created_at) values(${q(doc)},${q(doc)},${q(p.id)},${q(users[0])},1,${q(doc)},'synthetic.pdf','application/pdf',20,repeat('a',64),'Test','Otros','','','',now());`);
 const invoice={declaredTotal:1000,supplierId:supplier.id,number:'INV-1',due:date,documentId:doc,documentPropertyId:p.id,contractId:'',creditFor:'',duplicateReason:'',lines:[{id:prefix+'-line',propertyId:p.id,bucket:'line:1',category:'Materiales',description:'Materials',subtotal:1000,tax:0,retention:0,included:0,sourceLineId:''}]};
 await act('invoice',{...invoice,declaredTotal:999},400);pass('invalid invoice rejected without mutation');
 await act('invoice',invoice);assert.equal(book.invoices.length,1);const iid=book.invoices[0].id;pass('invoice and normalized lines saved');
 await act('approve',{id:iid});assert.equal(accountingSummary(book,p.id,date).approved,1000);pass('approval reflected in actual expenses');
 await act('movement',{kind:'Pago',propertyId:p.id,supplierId:supplier.id,invoiceId:iid,lineId:invoice.lines[0].id,sourceId:'',amount:250,account:'Test account',reference:'PAY-1',documentId:doc});assert.equal(accountingSummary(book,p.id,date).paid,250);pass('partial payment and balance recorded');
 const reload=await (await request('/api/accounting',undefined,'GET')).json();assert.deepEqual(reload.book,book);assert.equal(reload.version,version);pass('reloaded normalized book retains payment and invoice');
 const before=version;
 sql(`create function public.hu60_owner_fail_test() returns trigger language plpgsql as $$begin if new.user_id=${q(users[0])} then raise exception 'synthetic audit failure';end if;return new;end$$;create trigger hu60_owner_fail_test before insert on public.audit_events for each row execute function public.hu60_owner_fail_test();`);
 try{await act('supplier',{...supplier,name:'Must roll back'},500);}finally{sql('drop trigger hu60_owner_fail_test on public.audit_events;drop function public.hu60_owner_fail_test();');}
 const rolled=await (await request('/api/accounting',undefined,'GET')).json();assert.equal(rolled.version,before);assert.deepEqual(rolled.book,book);pass('audit failure rolls back book and normalized invoices');
 const other=await (await request('/api/accounting',undefined,'GET',cookies[1])).json();assert.equal(other.book.invoices.length,0);pass('other account cannot read expenses');
 const collision={...input,id:prefix+'-collision',requestId:randomUUID()};
 const collisions=await Promise.all([request('/api/properties',collision,'PUT',cookies[0]),request('/api/properties',{...collision,name:'Second owner'},'PUT',cookies[1])]);assert.deepEqual(collisions.map(r=>r.status).sort(),[200,403]);pass('simultaneous creation cannot overwrite another owner');
 const deleted=prefix+'-deleted';sql(`insert into public.property_deletions values(${q(deleted)},${q(users[0])},'Deleted','old',now(),'[]');`);
 assert.equal((await put({...input,id:deleted,requestId:randomUUID()})).status,403);pass('deleted property cannot be recreated');
 }
 console.log(JSON.stringify({checks,production_modified:false}));
}finally{
 for(const cookie of cookies)await fetch(origin+'/auth/logout',{method:'POST',headers:{cookie,origin},redirect:'manual'});
 for(const c of clients)await c.auth.signOut();
 for(const id of users){sql(`begin;delete from public.property_deletions where user_id=${q(id)};delete from public.expense_allocations where user_id=${q(id)};delete from public.expense_lines where user_id=${q(id)};delete from public.expense_invoices where user_id=${q(id)};delete from public.expense_classification_history where user_id=${q(id)};delete from public.expense_legacy_backup where user_id=${q(id)};delete from public.accounting_books where user_id=${q(id)};delete from public.property_documents where user_id=${q(id)};delete from public.audit_events where user_id=${q(id)};delete from public.opening_balances where user_id=${q(id)};delete from public.investment_projects where user_id=${q(id)};delete from public.property_baselines where user_id=${q(id)};delete from public.properties where user_id=${q(id)};commit;`);assert.ifError((await admin.auth.admin.deleteUser(id)).error);}
}
