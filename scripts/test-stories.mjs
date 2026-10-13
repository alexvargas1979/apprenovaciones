import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'rehab-stories-'));
try{
 await build({entryPoints:[process.argv[2]??'lib/stories.test.ts'],bundle:true,platform:'node',format:'esm',outfile:join(dir,'test.mjs'),plugins:[{name:'test-transports',setup(b){
  b.onResolve({filter:/^@\/lib\/postgres\/reports-server$/},()=>({path:'reports',namespace:'test'}));
  b.onResolve({filter:/^@\/lib\/postgres\/drafts-server$/},()=>({path:'drafts',namespace:'test'}));
  b.onResolve({filter:/^@\/lib\/postgres\/operations-write-server$/},()=>({path:'operations-write',namespace:'test'}));
  b.onResolve({filter:/^@\/lib\/postgres\/accounting-write-server$/},()=>({path:'accounting-write',namespace:'test'}));
  b.onResolve({filter:/^@\/lib\/postgres\/property-server$/},()=>({path:'property-server',namespace:'test'}));
  b.onResolve({filter:/^@\/lib\/postgres\/read-server$/},()=>({path:'postgres-read',namespace:'test'}));
  b.onResolve({filter:/^@\/db$/},()=>({path:'db',namespace:'test'}));
  b.onResolve({filter:/^@\/(app\/chatgpt-auth|lib\/auth\/identity)$/},()=>({path:'auth',namespace:'test'}));
  b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'test'}));
  b.onLoad({filter:/.*/,namespace:'test'},({path})=>({contents:path==='reports'?'export const readOversight=async()=>{throw Error("MIGRATION_PENDING")};export const readExpenseReports=readOversight;export const saveExpenseReport=readOversight;export const downloadPropertyReport=readOversight;':path==='drafts'?'export const readDrafts=async()=>{throw Error("MIGRATION_PENDING")};export const writeDraft=readDrafts;export const generateRecurring=readDrafts;':path==='operations-write'?'export const writeOperation=async()=>{throw Error("MIGRATION_PENDING")};':path==='accounting-write'?'export const writeAccounting=async()=>{throw Error("MIGRATION_PENDING")};':path==='property-server'?'export const saveProperty=async()=>{throw Error("MIGRATION_PENDING")};':path==='postgres-read'?'export const readPostgresWorkspace=async()=>{throw Error("MIGRATION_PENDING")};':path==='db'?'export const rawDb=()=>globalThis.__testDb;':path==='auth'?'export const getAppUser=async()=>globalThis.__testUid?{userId:globalThis.__testUid}:null; export const getChatGPTUser=getAppUser;':'export const env={get FILES(){return globalThis.__testBucket;},CREDENTIAL_ENCRYPTION_KEY:btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))};',loader:'js'}));
 }}]});
 await import(pathToFileURL(join(dir,'test.mjs')).href);
}finally{await rm(dir,{recursive:true,force:true});}
