import {createClient} from '@supabase/supabase-js';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const cli=process.env.SUPABASE_CLI??'supabase',origin='http://127.0.0.1:3000';
const cfg=JSON.parse(execFileSync(cli,['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));assert.equal(cfg.API_URL,'http://127.0.0.1:54321');
const admin=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),users=[],cookies=[],clients=[],prefix='hu60-write-'+randomUUID();
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
const sql=s=>execFileSync('docker',['exec','-i','supabase_db_apprenovaciones-local','psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input:s,encoding:'utf8',stdio:['pipe','pipe','pipe']});
let checks=0;const pass=s=>{checks++;console.log('PASS '+s);};
const patch=(data,cookie=cookies[0],from=origin)=>fetch(origin+'/api/properties/name',{method:'PATCH',headers:{cookie:cookie??'',origin:from,'content-type':'application/json'},body:JSON.stringify(data)});
try{
 sql("notify pgrst,'reload schema';");
 for(let i=0;i<2;i++){
  const email=prefix+i+'@example.invalid',password=randomBytes(24).toString('hex');const u=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(u.error);users.push(u.data.user.id);
  const login=await fetch(origin+'/auth/login',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email,password}),redirect:'manual'});assert.equal(login.status,303);cookies.push(login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '));
  const c=createClient(cfg.API_URL,cfg.PUBLISHABLE_KEY??cfg.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});assert.ifError((await c.auth.signInWithPassword({email,password})).error);clients.push(c);
 }
 if(process.argv.includes('--expect-disabled')){
  assert.equal((await patch({id:prefix+'-missing',version:'2026-10-11T00:00:00Z',name:'Disabled',reason:'Test',requestId:randomUUID()})).status,503);pass('write preview disabled by default');
 }else{
 const id=prefix+'-p',version='2026-10-11T00:00:00Z',body={id,version,name:'New name',reason:'Synthetic correction',requestId:randomUUID()};
 sql(`insert into public.properties values (${q(id)},${q(users[0])},'{"name":"Original","lines":{"1":{"actual":0.30}},"investment":{"purchase":100000}}',${q(version)});`);
 assert.equal((await patch(body,'')).status,401);pass('anonymous HTTP denied');
 assert.equal((await patch(body,cookies[0],'https://untrusted.example')).status,403);pass('cross-origin denied');
 assert.equal((await patch({...body,actor:users[1]})).status,400);pass('forged actor input rejected');
 assert.equal((await patch(body,cookies[1])).status,403);pass('other owner cannot rename');
 assert.equal((await patch({...body,reason:''})).status,400);pass('reason required');
 let r=await patch(body);assert.equal(r.status,200,await r.clone().text());let saved=await r.json();assert.equal(saved.name,body.name);assert.equal(saved.replayed,false);pass('HTTP write commits');
 r=await patch({...body,version:'2026-10-10T20:00:00-04:00'});assert.equal(r.status,200);assert.equal((await r.json()).replayed,true);pass('equivalent timezone retry idempotent');
 assert.equal((await patch({...body,name:'Different'})).status,409);pass('reused request with different body denied');
 assert.equal((await patch({...body,requestId:randomUUID(),name:'Stale'})).status,409);pass('stale version denied');
 const race=await Promise.all(['Race A','Race B'].map(name=>patch({...body,version:saved.updatedAt,name,requestId:randomUUID()})));
 assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);saved=await race.find(r=>r.status===200).json();pass('concurrent edits have one winner');
 const duplicate={...body,version:saved.updatedAt,name:'Duplicate request',requestId:randomUUID()};
 const twice=await Promise.all([patch(duplicate),patch(duplicate)]);assert(twice.every(r=>r.status===200));const responses=await Promise.all(twice.map(r=>r.json()));assert.deepEqual(responses.map(r=>r.replayed).sort(),[false,true]);pass('simultaneous same request commits once');
 const stored=JSON.parse(sql(`select jsonb_build_object('audits',(select count(*) from public.audit_events where property_id=${q(id)}),'original',(select original_payload::jsonb->>'name' from public.property_baselines where property_id=${q(id)}),'amount',(select amount from public.opening_balances where property_id=${q(id)}),'payload',(select payload from public.properties where id=${q(id)}));`));
 assert.equal(stored.audits,3);assert.equal(stored.original,'Original');assert.equal(stored.amount,.3);assert.equal(stored.payload.investment.purchase,100000);assert(stored.payload.dataHistory.every(h=>h.actor===users[0]));pass('audit, initial baseline, amount and financial fields preserved');
 assert((await clients[0].from('properties').update({payload:{name:'Bypass'}}).eq('id',id)).error);pass('direct table update still denied');
 const anon=createClient(cfg.API_URL,cfg.PUBLISHABLE_KEY??cfg.ANON_KEY,{auth:{persistSession:false}});assert((await anon.rpc('rename_owned_property',{property_id:id,expected_version:version,new_name:'Bad',reason:'Test',request_id:randomUUID()})).error);pass('anonymous direct RPC denied');
 assert.equal((await fetch(origin+'/api/accounting',{method:'POST',headers:{cookie:cookies[0],origin,'content-type':'application/json'},body:'{}'})).status,503);pass('general financial writes remain gated');
 }
 console.log(JSON.stringify({checks,production_modified:false}));
}finally{
 for(const cookie of cookies)await fetch(origin+'/auth/logout',{method:'POST',headers:{cookie,origin},redirect:'manual'});
 for(const c of clients)await c.auth.signOut();
 for(const id of users){sql(`begin;delete from public.audit_events where user_id=${q(id)};delete from public.opening_balances where user_id=${q(id)};delete from public.investment_projects where user_id=${q(id)};delete from public.property_baselines where user_id=${q(id)};delete from public.properties where user_id=${q(id)};commit;`);assert.ifError((await admin.auth.admin.deleteUser(id)).error);}
}
