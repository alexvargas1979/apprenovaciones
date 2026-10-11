import {createClient} from '@supabase/supabase-js';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const cli=process.env.SUPABASE_CLI??'supabase',origin='http://127.0.0.1:3000';
const cfg=JSON.parse(execFileSync(cli,['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));assert.equal(cfg.API_URL,'http://127.0.0.1:54321');
const admin=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),users=[],cookies=[],clients=[],prefix='hu60-scenario-'+randomUUID();
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
const sql=s=>execFileSync('docker',['exec','-i','supabase_db_apprenovaciones-local','psql','-X','-q','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input:s,encoding:'utf8',stdio:['pipe','pipe','pipe']});
let checks=0;const pass=s=>{checks++;console.log('PASS '+s);};
const patch=(data,cookie=cookies[0],from=origin)=>fetch(origin+'/api/scenarios/duplicate',{method:'POST',headers:{cookie:cookie??'',origin:from,'content-type':'application/json'},body:JSON.stringify(data)});
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
 const id=prefix+'-p',source=prefix+'-source',version='2026-10-11T00:00:00Z',body={propertyId:id,sourceId:source,version,bookVersion:null,label:'Copy',requestId:randomUUID()};
 sql(`insert into public.properties values (${q(id)},${q(users[0])},'{}',${q(version)});
 insert into public.analysis_scenarios(id,property_id,user_id,label,payload,created_at) values (${q(source)},${q(id)},${q(users[0])},'Original','{"engine":"historical","result":{"profit":123.45}}',now());
 insert into public.analysis_baselines values (${q(id)},${q(users[0])},${q(source)},now());`);
 assert.equal((await patch(body,'')).status,401);pass('anonymous denied');
 assert.equal((await patch(body,cookies[0],'https://untrusted.example')).status,403);pass('cross-origin denied');
 assert.equal((await patch(body,cookies[1])).status,403);pass('other owner denied');
 assert.equal((await patch({...body,label:''})).status,400);pass('label required');
 assert.equal((await patch({...body,payload:{result:{profit:999}}})).status,400);pass('client cannot inject calculated snapshot');
 let r=await patch(body);assert.equal(r.status,201,await r.clone().text());const saved=await r.json();pass('copy committed');
 r=await patch(body);assert.equal(r.status,200);const replay=await r.json();assert.equal(replay.id,saved.id);assert(replay.replayed);pass('retry returns same scenario');
 assert.equal((await patch({...body,label:'Changed'})).status,409);pass('same request with different content denied');
 assert.equal((await patch({...body,version:'2026-10-10T00:00:00Z',requestId:randomUUID()})).status,409);pass('stale property denied');
 const same={...body,requestId:randomUUID(),label:'Simultaneous'};
 const twice=await Promise.all([patch(same),patch(same)]);assert.deepEqual(twice.map(r=>r.status).sort(),[200,201]);const results=await Promise.all(twice.map(r=>r.json()));assert.equal(results[0].id,results[1].id);pass('simultaneous retry creates one copy');
 sql(`insert into public.analysis_scenarios(id,property_id,user_id,label,payload,created_at) select ${q(prefix)}||'-fill-'||n,${q(id)},${q(users[0])},'Fill','{}',now() from generate_series(1,46)n;`);
 const race=await Promise.all(['Last A','Last B'].map(label=>patch({...body,label,requestId:randomUUID()})));assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);pass('concurrent copies respect limit of 50');
 const stored=JSON.parse(sql(`select jsonb_build_object('count',(select count(*) from public.analysis_scenarios where property_id=${q(id)}),'copies',(select count(*) from public.analysis_scenarios where source_id=${q(source)}),'same',(select bool_and(payload='{"engine":"historical","result":{"profit":123.45}}'::jsonb) from public.analysis_scenarios where source_id=${q(source)}),'baseline',(select scenario_id from public.analysis_baselines where property_id=${q(id)}),'audits',(select count(*) from public.audit_events where property_id=${q(id)}));`));
 assert.equal(stored.count,50);assert.equal(stored.copies,3);assert.equal(stored.audits,3);assert.equal(stored.baseline,source);assert(stored.same);pass('snapshots, provenance and approved baseline preserved');
 assert((await clients[0].from('analysis_scenarios').insert({id:randomUUID(),property_id:id,user_id:users[0],label:'Bypass',payload:{},created_at:version})).error);pass('direct insert still denied');
 }
 console.log(JSON.stringify({checks,production_modified:false}));
}finally{
 for(const cookie of cookies)await fetch(origin+'/auth/logout',{method:'POST',headers:{cookie,origin},redirect:'manual'});
 for(const c of clients)await c.auth.signOut();
 for(const id of users){sql(`begin;delete from public.audit_events where user_id=${q(id)};delete from public.analysis_baselines where user_id=${q(id)};delete from public.analysis_scenarios where user_id=${q(id)};delete from public.accounting_books where user_id=${q(id)};delete from public.opening_balances where user_id=${q(id)};delete from public.investment_projects where user_id=${q(id)};delete from public.property_baselines where user_id=${q(id)};delete from public.properties where user_id=${q(id)};commit;`);assert.ifError((await admin.auth.admin.deleteUser(id)).error);}
}
