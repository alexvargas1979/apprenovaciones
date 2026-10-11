import {createClient} from '@supabase/supabase-js';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:3000';
const cli=process.env.SUPABASE_CLI??'supabase';
const status=JSON.parse(execFileSync(cli,['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
assert.equal(status.API_URL,'http://127.0.0.1:54321');
const admin=createClient(status.API_URL,status.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const suffix=randomUUID(),email=`hu56-${suffix}@example.invalid`,password=randomBytes(24).toString('hex'),newPassword=randomBytes(24).toString('hex');
const users=[];let checks=0;
const pass=label=>{checks++;console.log('PASS '+label);};
class Browser{
 jar=new Map();
 async request(path,body,extra={}){
  const headers={cookie:[...this.jar].map(([k,v])=>`${k}=${v}`).join('; '),...extra};
  if(body){headers.origin??=origin;headers['content-type']='application/x-www-form-urlencoded';}
  const r=await fetch(origin+path,{method:body?'POST':'GET',headers,body:body?new URLSearchParams(body):undefined,redirect:'manual'});
  for(const item of r.headers.getSetCookie()){const [pair]=item.split(';');const pos=pair.indexOf('=');const name=pair.slice(0,pos),value=pair.slice(pos+1);if(!value)this.jar.delete(name);else this.jar.set(name,value);}
  return r;
 }
 expire(badRefresh=false){
  const pairs=[...this.jar].filter(([k])=>k.includes('-auth-token')).sort(([a],[b])=>a.localeCompare(b));assert(pairs.length);
  const value=pairs.map(([,v])=>decodeURIComponent(v)).join('');assert(value.startsWith('base64-'));
  const data=JSON.parse(Buffer.from(value.slice(7),'base64url').toString());data.expires_at=1;if(badRefresh)data.refresh_token='invalid-refresh';
  const encoded='base64-'+Buffer.from(JSON.stringify(data)).toString('base64url');const base=pairs[0][0].replace(/\.\d+$/,'');pairs.forEach(([k])=>this.jar.delete(k));this.jar.set(base,encoded);
 }
}
async function mailLink(address){
 for(let n=0;n<15;n++){
  const list=await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json();
  const mail=list.messages?.find(m=>m.To?.some(to=>to.Address===address));
  if(mail){const detail=await (await fetch('http://127.0.0.1:54324/api/v1/message/'+mail.ID)).json();const html=detail.HTML??'';const match=html.match(/href="([^"]*\/auth\/confirm[^\"]*)"/);if(match)return new URL(match[1].replaceAll('&amp;','&'));}
  await new Promise(r=>setTimeout(r,200));
 }
 throw Error('Local email was not captured');
}
try{
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);users.push(created.data.user.id);
 const browser=new Browser();
 const pending=await admin.auth.admin.createUser({email:`hu56-pending-${suffix}@example.invalid`,password,email_confirm:false});assert.ifError(pending.error);users.push(pending.data.user.id);
 let pendingResponse=await browser.request('/auth/login',{email:pending.data.user.email,password});assert(pendingResponse.headers.get('location').includes('error=credentials'));pass('unconfirmed email rejected');
 let r=await browser.request('/api/properties',null,{'oai-authenticated-user-id':users[0],'oai-authenticated-user-email':email});assert.equal(r.status,401);pass('ChatGPT headers cannot impersonate Supabase');
 r=await browser.request('/');assert.equal(r.status,307);assert(new URL(r.headers.get('location'),origin).pathname==='/ingresar');pass('private page redirects anonymous visitor');
 r=await browser.request('/auth/login',{email,password},{origin:'https://untrusted.example'});assert.equal(r.status,403);pass('cross-origin login denied');
 r=await browser.request('/auth/login',{email,password:'incorrect'});assert(r.headers.get('location').includes('error=credentials'));pass('wrong password rejected');
 r=await browser.request('/auth/login',{email,password,next:'//untrusted.example'});assert.equal(r.status,303);assert.equal(r.headers.get('location'),origin+'/cuenta');assert(r.headers.getSetCookie().every(c=>/HttpOnly/i.test(c)&&/SameSite=Lax/i.test(c)));pass('login with HttpOnly cookies and safe redirect');
 r=await browser.request('/cuenta');assert.equal(r.status,200);assert((await r.text()).includes(email));pass('SSR account renders verified identity');
 r=await browser.request('/auth/session');assert.equal(r.status,200);assert.equal((await r.json()).userId,users[0]);assert(r.headers.get('cache-control').includes('no-store'));pass('server session and no-store');
 r=await browser.request('/api/properties');assert.equal(r.status,503);pass('unmigrated identity cannot access legacy data');
 browser.expire();r=await browser.request('/auth/session');assert.equal(r.status,200);assert(r.headers.getSetCookie().length);pass('expired session metadata refreshes cookies');
 browser.expire();r=await browser.request('/cuenta');assert.equal(r.status,200);assert(r.headers.getSetCookie().length);assert((await r.text()).includes(email));pass('middleware forwards refreshed cookies to SSR');
 browser.expire(true);r=await browser.request('/auth/session');assert.equal(r.status,401);pass('invalid refresh token rejects session');
 await browser.request('/auth/login',{email,password});
 r=await browser.request('/auth/logout',{});assert.equal(r.status,303);r=await browser.request('/auth/session');assert.equal(r.status,401);pass('logout clears session');
 r=await browser.request('/auth/callback?code=invalid&next=//untrusted.example');assert.equal(r.headers.get('location'),origin+'/ingresar?error=link');pass('invalid PKCE callback denied');
 r=await browser.request('/auth/verify',{type:'recovery',token_hash:'expired-invalid'});assert(r.headers.get('location').includes('error=link'));pass('invalid email link denied');
 const expired=await admin.auth.admin.generateLink({type:'recovery',email});assert.ifError(expired.error);
 execFileSync('docker',['exec','supabase_db_apprenovaciones-local','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',`update auth.users set recovery_sent_at=now()-interval '2 hours' where id='${users[0]}'`],{stdio:'pipe'});
 r=await browser.request('/auth/verify',{type:'recovery',token_hash:expired.data.properties.hashed_token});assert(r.headers.get('location').includes('error=link'));pass('expired recovery link rejected');
 r=await browser.request('/auth/recover',{email});assert.equal(r.status,303);const link=await mailLink(email);assert.equal(link.origin,origin);pass('recovery email delivered only to local mailbox');
 r=await browser.request('/auth/verify',Object.fromEntries(link.searchParams));assert.equal(r.headers.get('location'),origin+'/cuenta?message=verified');pass('recovery email verifies session');
 r=await (new Browser()).request('/auth/verify',Object.fromEntries(link.searchParams));assert(r.headers.get('location').includes('error=link'));pass('used email link rejected');
 r=await browser.request('/auth/password',{password:'short',confirm:'short'});assert(r.headers.get('location').includes('error=password'));pass('weak password rejected');
 r=await browser.request('/auth/password',{password:newPassword,confirm:newPassword});assert.equal(r.headers.get('location'),origin+'/ingresar?message=password');
 r=await browser.request('/auth/login',{email,password});assert(r.headers.get('location').includes('error=credentials'));
 r=await browser.request('/auth/login',{email,password:newPassword});assert.equal(r.headers.get('location'),origin+'/cuenta');pass('password changed and previous password rejected');
 const inviteEmail=`hu56-invite-${suffix}@example.invalid`;const invite=await admin.auth.admin.inviteUserByEmail(inviteEmail);assert.ifError(invite.error);users.push(invite.data.user.id);
 const inviteLink=await mailLink(inviteEmail);const invited=new Browser();r=await invited.request('/auth/verify',Object.fromEntries(inviteLink.searchParams));assert.equal(r.headers.get('location'),origin+'/cuenta?message=verified');pass('invitation confirms email without public signup');
 await browser.request('/auth/logout',{});await invited.request('/auth/logout',{});
 console.log(JSON.stringify({checks,production_modified:false}));
}finally{
 for(const id of users){const deleted=await admin.auth.admin.deleteUser(id);assert.ifError(deleted.error);}
}
