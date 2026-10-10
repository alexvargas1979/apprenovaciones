// Synthetic local-only infrastructure test. No real records, external mail or hosted project access.
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const config=readFileSync(new URL('../../supabase/config.toml',import.meta.url),'utf8');
assert.match(config,/^project_id = "apprenovaciones-local"$/m,'Unexpected local project');
const cli=['exec','--yes','--cache','/private/tmp/rehab-npm-cache','--package=supabase@2.120.0','--','supabase','status','-o','json'];
const output=execFileSync('npm',cli,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const status=JSON.parse(output.slice(output.indexOf('{')));
const url=new URL(status.API_URL);
assert.equal(url.hostname,'127.0.0.1','Refusing non-local Supabase');
assert.equal(url.port,'54321');
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
const admin=createClient(url.href,status.SECRET_KEY||status.SERVICE_ROLE_KEY,options);
const client=createClient(url.href,status.PUBLISHABLE_KEY||status.ANON_KEY,options);
const anon=createClient(url.href,status.PUBLISHABLE_KEY||status.ANON_KEY,options);
function ok(result,label){if(result.error)throw new Error(label+' failed ('+(result.error.code||result.error.status||result.error.statusCode||'unknown')+')');return result.data;}
const id=randomUUID(), bucket='migration-smoke-'+id, email='migration-'+id+'@example.invalid',password=randomBytes(32).toString('base64url');
let userId,createdBucket=false,uploaded=false,signedIn=false;
const checks=[];
try{
 const signup=await anon.auth.signUp({email:'blocked-'+email,password});assert.equal(signup.error?.code,'signup_disabled');checks.push('public_signup_denied');
 const user=ok(await admin.auth.admin.createUser({email,password,email_confirm:true}),'create synthetic local user');userId=user.user.id;
 assert.ok((await client.auth.signInWithPassword({email,password:'incorrect-fixture-password'})).error);checks.push('wrong_password_denied');
 const login=ok(await client.auth.signInWithPassword({email,password}),'login');signedIn=true;assert.equal(login.user.id,userId);checks.push('password_login');
 assert.equal(ok(await client.auth.getUser(),'verified identity').user.id,userId);checks.push('server_verified_identity');
 const refreshed=ok(await client.auth.refreshSession(),'refresh');assert.ok(refreshed.session?.refresh_token);assert.equal(refreshed.user.id,userId);checks.push('refresh_session');
 ok(await admin.storage.createBucket(bucket,{public:false,fileSizeLimit:10485760,allowedMimeTypes:['text/plain']}),'create bucket');createdBucket=true;
 const bytes=Buffer.from('Synthetic migration fixture. No property data.');
 ok(await admin.storage.from(bucket).upload('fixture.txt',bytes,{contentType:'text/plain',upsert:false}),'upload');uploaded=true;
 assert.ok((await anon.storage.from(bucket).download('fixture.txt')).error);checks.push('anonymous_download_denied');
 assert.ok((await client.storage.from(bucket).download('fixture.txt')).error);checks.push('ungranted_user_download_denied');
 const blob=ok(await admin.storage.from(bucket).download('fixture.txt'),'download');assert.equal(createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex'),createHash('sha256').update(bytes).digest('hex'));checks.push('file_sha256_matches');
 const signed=ok(await admin.storage.from(bucket).createSignedUrl('fixture.txt',60),'signed URL');assert.equal(new URL(signed.signedUrl).origin,url.origin);
 const response=await fetch(signed.signedUrl,{redirect:'error'});assert.equal(response.status,200);assert.equal(await response.text(),bytes.toString());checks.push('signed_download');
 ok(await client.auth.signOut(),'signout');signedIn=false;assert.ok((await client.auth.getUser()).error);checks.push('logout');
}finally{
 if(signedIn)ok(await client.auth.signOut(),'cleanup signout');
 if(uploaded)ok(await admin.storage.from(bucket).remove(['fixture.txt']),'cleanup file');
 if(createdBucket)ok(await admin.storage.deleteBucket(bucket),'cleanup bucket');
 if(userId)ok(await admin.auth.admin.deleteUser(userId),'cleanup user');
}
console.log(JSON.stringify({environment:'local-only',checks,cleanup:'completed',app_ssr_validated:false,production_modified:false}));
