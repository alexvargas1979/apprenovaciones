import {createClient} from '@supabase/supabase-js';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const cli=process.env.SUPABASE_CLI??'supabase',origin='http://127.0.0.1:3000';
const cfg=JSON.parse(execFileSync(cli,['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));assert.equal(cfg.API_URL,'http://127.0.0.1:54321');
const admin=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),users=[],sessions=[],prefix='hu60-'+randomUUID();
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
const sql=s=>execFileSync('docker',['exec','-i','supabase_db_apprenovaciones-local','psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input:s,encoding:'utf8',stdio:['pipe','pipe','pipe']});
let checks=0;const pass=s=>{console.log('PASS '+s);checks++;};
try{
 sql("notify pgrst,'reload schema';");
 for(let n=0;n<2;n++){
  const email=prefix+n+'@example.invalid',password=randomBytes(24).toString('hex');const u=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(u.error);users.push(u.data.user.id);
  const login=await fetch(origin+'/auth/login',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email,password}),redirect:'manual'});assert.equal(login.status,303);
  sessions.push(login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '));
 }
 const [a,b]=users,p=prefix+'-p',p2=prefix+'-p2';
 sql(`insert into public.properties(id,user_id,payload,updated_at) values (${q(p)},${q(a)},'{"name":"Owner A","values":{},"lines":{}}',now()),(${q(p2)},${q(b)},'{"name":"Owner B","values":{},"lines":{}}',now());
 insert into public.accounting_books(user_id,payload,updated_at) values (${q(a)},'{"invoiceStorage":1,"invoices":[],"suppliers":[],"movements":[],"releases":[],"contracts":[],"quotes":[]}',now());
 insert into public.expense_invoices(user_id,id,position,payload) select ${q(a)},${q(prefix)}||'-invoice-'||n,n,jsonb_build_object('id',${q(prefix)}||'-invoice-'||n,'declaredTotal',0.3,'number',n) from generate_series(1,1201)n;
 insert into public.expense_lines(user_id,id,invoice_id,property_id,position,payload) values (${q(a)},${q(prefix+'-line')},${q(prefix+'-invoice-1')},${q(p)},0,'{"subtotal":0.10,"tax":0.20,"retention":0,"included":0,"classification":{"splits":[]}}');
 insert into public.expense_allocations(user_id,line_id,position,payload) values (${q(a)},${q(prefix+'-line')},0,'{"centerId":"kitchen","subtotal":0.10,"tax":0.20}');`);
 const get=(path,cookie)=>fetch(origin+path,{headers:cookie?{cookie}:undefined});
 for(const path of ['/api/properties','/api/accounting']){assert.equal((await get(path)).status,401);pass('anonymous denied '+path);}
 for(const [idx,id] of [[0,p],[1,p2]]){const r=await get('/api/properties',sessions[idx]);assert.equal(r.status,200,await r.clone().text());const data=await r.json();assert.equal(data.readOnly,true);assert.deepEqual(data.properties.map(p=>p.id),[id]);assert(r.headers.get('cache-control')?.split(',').map(s=>s.trim()).includes('no-store'));pass('HTTP owner isolation '+idx);}
 let r=await get('/api/accounting',sessions[0]);assert.equal(r.status,200);const data=await r.json();assert.equal(data.book.invoices.length,1201);assert.equal(data.book.invoices[0].lines[0].classification.splits[0].centerId,'kitchen');assert.equal(data.book.invoices[0].lines[0].propertyId,p);pass('1201 invoices are not truncated and allocations hydrate');
 r=await get('/api/accounting',sessions[1]);assert.equal((await r.json()).book.invoices.length,0);pass('empty owner book cannot inherit another account');
 assert.equal((await get('/api/accounting?grantId=unknown',sessions[0])).status,503);pass('collaborator path remains explicitly gated');
 for(const [path,method] of [['/api/properties','PUT'],['/api/properties','DELETE'],['/api/accounting','POST']]){const r=await fetch(origin+path,{method,headers:{cookie:sessions[0],origin,'content-type':'application/json'},body:'{}'});assert.equal(r.status,503);pass('writes stay gated '+method+' '+path);}
 const anon=createClient(cfg.API_URL,cfg.PUBLISHABLE_KEY??cfg.ANON_KEY,{auth:{persistSession:false}});assert((await anon.rpc('owner_workspace_snapshot')).error);pass('anonymous direct RPC denied');
 console.log(JSON.stringify({checks,production_modified:false}));
}finally{
 for(const cookie of sessions)await fetch(origin+'/auth/logout',{method:'POST',headers:{cookie,origin},redirect:'manual'});
 for(const id of users){sql(`begin;delete from public.expense_allocations where user_id=${q(id)};delete from public.expense_lines where user_id=${q(id)};delete from public.expense_invoices where user_id=${q(id)};delete from public.accounting_books where user_id=${q(id)};delete from public.properties where user_id=${q(id)};commit;`);assert.ifError((await admin.auth.admin.deleteUser(id)).error);}
}
