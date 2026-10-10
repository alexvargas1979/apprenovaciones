import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'rehab-stories-'));
try{
 await build({entryPoints:[process.argv[2]??'lib/stories.test.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'test.mjs'),plugins:[{name:'test-transports',setup(b){
  b.onResolve({filter:/^@\/db$/},()=>({path:'db',namespace:'test'}));
  b.onResolve({filter:/^@\/app\/chatgpt-auth$/},()=>({path:'auth',namespace:'test'}));
  b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},({path})=>({contents:path==='db'?'export const rawDb=()=>globalThis.__testDb;':path==='auth'?'export const getChatGPTUser=async()=>globalThis.__testUid?{userId:globalThis.__testUid}:null;':'export const env={get FILES(){return globalThis.__testBucket;},CREDENTIAL_ENCRYPTION_KEY:btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))};',loader:'js'}));
 }}]});
 await import(pathToFileURL(join(dir,'test.mjs')).href);
}finally{await rm(dir,{recursive:true,force:true});}
