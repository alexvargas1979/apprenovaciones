import {createClient} from '@supabase/supabase-js';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const cli=process.env.SUPABASE_CLI??'supabase';
const status=JSON.parse(execFileSync(cli,['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(status.API_URL,'http://127.0.0.1:54321');
const key=status.PUBLISHABLE_KEY??status.ANON_KEY;
const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[],clients=[];let checks=0;const prefix='hu58-'+randomUUID();
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
function sql(s){return execFileSync('docker',['exec','-i','supabase_db_apprenovaciones-local','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input:s,encoding:'utf8',stdio:['pipe','pipe','pipe']});}
const pass=name=>{checks++;console.log('PASS '+name);};
let A,B,M,p1,p2,p3,g,i1,i2,ih,ic;
try{
 for(let n=0;n<3;n++){
  const email=`${prefix}-${n}@example.invalid`,password=randomBytes(24).toString('hex');
  const r=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(r.error);users.push(r.data.user.id);
  const c=createClient(status.API_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});assert.ifError((await c.auth.signInWithPassword({email,password})).error);clients.push(c);
 }
 [A,B,M]=users;[p1,p2,p3,g,i1,i2,ih,ic]=['p1','p2','p3','g','i1','i2','ih','ic'].map(x=>prefix+'-'+x);
 const prop=(id,uid)=>`(${q(id)},${q(uid)},${q(JSON.stringify({name:id,county:'Fulton',values:{5:'Synthetic address'},creditAssessment:'PRIVATE-CREDIT'}))},now())`;
 const line=(id,inv,pid,source='')=>`(${q(A)},${q(prefix+'-'+id)},${q(inv)},${q(pid)},0,${q(JSON.stringify({description:'Synthetic expense',subtotal:10,tax:1,retention:0,included:0,classification:{splits:[]},sourceLineId:source}))})`;
 sql(`begin;
 insert into public.properties(id,user_id,payload,updated_at) values ${prop(p1,A)},${prop(p2,A)},${prop(p3,B)};
 insert into public.accounting_books(user_id,payload,updated_at) values (${q(A)},${q(JSON.stringify({bank:'PRIVATE-BANK',delivery:{[p1]:{tasks:[{id:'t1',name:'Allowed task',note:'SECRET-NOTE'},{id:'t2',name:'Hidden task'}]}}}))},now());
 insert into public.team_members(id,owner_id,member_id,token_hash,payload,updated_at) values (${q(g)},${q(A)},${q(M)},${q(prefix)},${q(JSON.stringify({role:'Contratista',status:'Activo',propertyIds:[p1],taskIds:['t1'],expenses:{permissions:['draft'],allCenters:false,centerIds:['kitchen'],maxAmount:100}}))},now());
 insert into public.expense_invoices(user_id,id,position,payload) values ${[i1,i2,ih,ic].map((id,n)=>`(${q(A)},${q(id)},${n},'${JSON.stringify({declaredTotal:22,number:'TEST',date:'2026-10-10',due:'2026-11-10',detail:{attachments:[{documentId:'PRIVATE-DOCUMENT'}]}})}')`).join(',')};
 insert into public.expense_lines(user_id,id,invoice_id,property_id,position,payload) values ${line('l1',i1,p1)},${line('l21',i2,p1)},${line('l22',i2,p2)},${line('lh',ih,p1)},${line('lc',ic,p1,prefix+'-lh')};
 insert into public.expense_allocations(user_id,line_id,position,payload) values ${['l1','l21','l22','lh','lc'].map(id=>`(${q(A)},${q(prefix+'-'+id)},0,'{"centerId":"kitchen","subtotal":10,"tax":1}')`).join(',')};
 insert into public.expense_classification_history(user_id,id,position,payload) values (${q(A)},${q(prefix+'-hist')},0,${q(JSON.stringify({lineId:prefix+'-lh',value:{splits:[{centerId:'patio'}]}}))});
 commit;`);
 // Notify only schema cache, not user state; the endpoint may have cached the new RPC names.
 sql("notify pgrst,'reload schema';");
 const [a,b,m]=clients,anon=createClient(status.API_URL,key,{auth:{persistSession:false}});
 let r=await anon.from('properties').select('id');assert(r.error);pass('anonymous table access denied');
 r=await a.from('properties').select('id').in('id',[p1,p2,p3]);assert.ifError(r.error);assert.deepEqual(r.data.map(x=>x.id).sort(),[p1,p2].sort());pass('owner A reads only own properties');
 r=await b.from('properties').select('id').in('id',[p1,p2,p3]);assert.ifError(r.error);assert.deepEqual(r.data.map(x=>x.id),[p3]);pass('owner B remains isolated');
 for(const table of ['properties','accounting_books','expense_invoices','expense_lines','expense_allocations','team_members','property_documents']){r=await m.from(table).select('*');assert.ifError(r.error);assert.equal(r.data.length,0);}pass('collaborator cannot read raw books, invoices, files or grants');
 r=await m.rpc('shared_property_summary',{grant_id:g,property_id:p1});assert.ifError(r.error);assert.equal(r.data.id,p1);assert.equal(r.data.tasks.length,1);assert.equal(r.data.tasks[0].id,'t1');assert(!JSON.stringify(r.data).includes('PRIVATE'));assert(!JSON.stringify(r.data).includes('SECRET'));pass('contractor projection contains only assigned task and safe fields');
 r=await m.rpc('shared_property_summary',{grant_id:g,property_id:p2});assert.ifError(r.error);assert.equal(r.data,null);pass('unassigned property denied');
 r=await b.rpc('shared_property_summary',{grant_id:g,property_id:p1});assert.ifError(r.error);assert.equal(r.data,null);pass('another owner cannot impersonate collaborator');
 r=await m.rpc('shared_invoice_summary',{grant_id:g,invoice_id:i1});assert.ifError(r.error);assert.equal(r.data.total,11);assert(!JSON.stringify(r.data).includes('PRIVATE-DOCUMENT'));pass('authorized invoice summary excludes document references');
 r=await m.rpc('shared_invoice_summary',{grant_id:g,invoice_id:i2});assert.ifError(r.error);assert.equal(r.data,null);pass('partially authorized multiproperty invoice denied entirely');
 r=await m.rpc('shared_invoice_summary',{grant_id:g,invoice_id:ih});assert.ifError(r.error);assert.equal(r.data,null);pass('latest center reclassification overrides old allocations');
 r=await m.rpc('shared_invoice_summary',{grant_id:g,invoice_id:ic});assert.ifError(r.error);assert.equal(r.data,null);pass('credit inherits source center restrictions');
 sql(`update public.team_members set payload=jsonb_set(payload,'{expenses,allCenters}','true') where id=${q(g)};`);
 r=await m.rpc('shared_invoice_summary',{grant_id:g,invoice_id:ih});assert.ifError(r.error);assert.equal(r.data.total,11);pass('explicit all-centers grant permits summary');
 r=await m.rpc('shared_invoice_summary',{grant_id:g,invoice_id:i2});assert.ifError(r.error);assert.equal(r.data,null);pass('all-centers never expands property scope');
 sql(`update public.team_members set payload=jsonb_set(payload,'{status}','"Revocado"') where id=${q(g)};`);
 for(const [rpc,args] of [['shared_property_summary',{grant_id:g,property_id:p1}],['shared_invoice_summary',{grant_id:g,invoice_id:i1}]]){r=await m.rpc(rpc,args);assert.ifError(r.error);assert.equal(r.data,null);}pass('revocation effective immediately with same access token');
 r=await a.from('properties').update({payload:{name:'bypass'}}).eq('id',p1);assert(r.error);pass('direct writes blocked even for owner');
 r=await m.from('team_members').update({member_id:A}).eq('id',g);assert(r.error);pass('collaborator cannot change identity or permissions');
 r=await anon.rpc('shared_property_summary',{grant_id:g,property_id:p1});assert(r.error);pass('anonymous RPC denied');
 // Temporarily grant in an isolated transaction to exercise dormant WITH CHECK policies.
 const detail=sql(`begin;grant update on public.properties to authenticated;set local role authenticated;select set_config('request.jwt.claim.sub',${q(A)},true);
 do $test$ begin
 begin update public.properties set user_id=${q(B)} where id=${q(p1)};raise exception 'owner reassignment unexpectedly succeeded';exception when insufficient_privilege then null;end;
 update public.properties set payload='{}' where id=${q(p3)};
 if found then raise exception 'cross owner update unexpectedly succeeded';end if;
 end $test$;reset role;rollback;`);assert(detail.includes('ROLLBACK'));pass('UPDATE USING and WITH CHECK reject cross-owner changes');
 console.log(JSON.stringify({checks,production_modified:false}));
}finally{
 for(const c of clients)await c.auth.signOut();
 if(A){sql(`begin;
 delete from public.expense_classification_history where user_id=${q(A)};
 delete from public.expense_allocations where user_id=${q(A)};
 delete from public.expense_lines where user_id=${q(A)};
 delete from public.expense_invoices where user_id=${q(A)};
 delete from public.team_members where owner_id=${q(A)};
 delete from public.accounting_books where user_id=${q(A)};
 delete from public.properties where user_id in (${q(A)},${q(B)});
 commit;`);}
 for(const id of users){const r=await admin.auth.admin.deleteUser(id);assert.ifError(r.error);}
}
