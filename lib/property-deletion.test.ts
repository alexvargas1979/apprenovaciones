import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {GET,PUT,DELETE as deleteRoute} from '../app/api/properties/route';
import {GET as download} from '../app/api/documents/download/route';
import {fresh} from './model';
import {emptyBook} from './accounting';
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
assert.equal(sql.prepare("SELECT name FROM sqlite_master WHERE name IN ('settings','attom_receipts')").all().length,0);
function prepare(query:string){let args:any[]=[];return {bind(...a:any[]){args=a;return this;},async first(){return sql.prepare(query).get(...args)??null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};}
let race=false;(globalThis as any).__testDb={prepare,async batch(statements:any[]){if(race){race=false;sql.prepare('UPDATE accounting_books SET updated_at=? WHERE user_id=?').run('2026-10-02T00:00:00.000Z','owner');}sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};(globalThis as any).__testUid='owner';
async function DELETE(req:Request){const r=await deleteRoute(req);return r;}
const origin='https://test.example';const request=(method:string,data:any,from=origin)=>new Request(origin+'/api/properties',{method,headers:{Origin:from},body:JSON.stringify(data)});
async function seed(name:string){const p=fresh();p.name=name;p.workflow={stage:'Oportunidad',responsible:'Prueba',planB:false};p.workflowEdit={date:'2026-10-01',reason:'Alta de prueba'};const r=await PUT(request('PUT',p));assert.equal(r.status,200,await r.clone().text());return (await r.json() as any).property;}
const p=await seed('Eliminar prueba'),other=await seed('Conservar prueba');
const args={id:p.id,updatedAt:p.updatedAt,confirmName:p.name};
assert.equal((await DELETE(request('DELETE',{...args,confirmName:'incorrecto'}))).status,400);
assert.equal((await DELETE(request('DELETE',args,'https://foreign.example'))).status,403);
assert.equal((await DELETE(request('DELETE',{...args,updatedAt:'stale'}))).status,409);
(globalThis as any).__testUid='other';assert.equal((await DELETE(request('DELETE',args))).status,404);(globalThis as any).__testUid='owner';
const book=emptyBook();book.suppliers.push({id:'shared-vendor',name:'Conservar proveedor',contact:'Persona',phone:'123',email:'',address:'',note:'',idempotency:'',actor:'owner',date:'2026-10-01',at:'2026-10-01',reason:'Prueba'} as any);
sql.prepare('INSERT INTO accounting_books VALUES(?,?,?)').run('owner',JSON.stringify(book),'2026-10-01T00:00:00.000Z');
race=true;assert.equal((await DELETE(request('DELETE',args))).status,409);assert.ok(sql.prepare('SELECT id FROM properties WHERE id=?').get(p.id));assert.equal(sql.prepare('SELECT id FROM property_deletions').all().length,0);
book.quotes.push({propertyId:p.id} as any);sql.prepare('UPDATE accounting_books SET payload=?').run(JSON.stringify(book));assert.equal((await DELETE(request('DELETE',args))).status,409);book.quotes=[];sql.prepare('UPDATE accounting_books SET payload=?').run(JSON.stringify(book));
sql.prepare('INSERT INTO property_documents VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('doc','doc',p.id,'owner',1,'object-one','photo.jpg','image/jpeg',20,'hash','Foto','Foto','Expediente','','','2026-10-01');
sql.prepare('INSERT INTO analysis_scenarios VALUES(?,?,?,?,?,?,?)').run('scenario',p.id,'owner','Base',null,'{}','2026-10-01');sql.prepare('INSERT INTO analysis_baselines VALUES(?,?,?,?)').run(p.id,'owner','scenario','2026-10-01');
sql.prepare('INSERT INTO expense_drafts VALUES(?,?,?,?,?,?)').run('owner','draft-other',other.id,'Borrador',JSON.stringify({invoice:{lines:[{propertyId:p.id}]}}),'v1');assert.equal((await DELETE(request('DELETE',args))).status,409);sql.prepare('DELETE FROM expense_drafts WHERE id=?').run('draft-other');
sql.prepare('INSERT INTO expense_drafts VALUES(?,?,?,?,?,?)').run('owner','draft-own',p.id,'Borrador',JSON.stringify({invoice:{lines:[{propertyId:p.id}]}}),'v1');
sql.prepare('INSERT INTO team_members VALUES(?,?,?,?,?,?)').run('grant','owner','member','token-hash',JSON.stringify({propertyIds:[p.id,other.id]}),'2026-10-01');
let failFiles=true;const deleted:string[]=[];(globalThis as any).__testBucket={async delete(keys:string[]){if(failFiles)throw Error('Storage temporarily unavailable');deleted.push(...keys);}};
let response=await DELETE(request('DELETE',args));assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json() as any).cleanupPending,true);assert.equal(sql.prepare('SELECT id FROM properties WHERE id=?').get(p.id),undefined);assert.ok(sql.prepare('SELECT id FROM properties WHERE id=?').get(other.id));assert.equal(sql.prepare('SELECT id FROM property_documents WHERE id=?').get('doc'),undefined);assert.equal(sql.prepare('SELECT id FROM expense_drafts WHERE id=?').get('draft-own'),undefined);assert.equal(sql.prepare('SELECT id FROM analysis_scenarios WHERE id=?').get('scenario'),undefined);assert.deepEqual(JSON.parse(sql.prepare('SELECT payload FROM team_members').get()!.payload as string).propertyIds,[other.id]);assert.equal(JSON.parse(sql.prepare('SELECT payload FROM accounting_books').get()!.payload as string).suppliers[0].id,'shared-vendor');
assert.equal((await PUT(request('PUT',{...p,updatedAt:undefined}))).status,409);assert.equal((await download(new Request(origin+'/api/documents/download?id=doc'))).status,404);
failFiles=false;response=await GET();assert.equal(response.status,200);assert.deepEqual(deleted,['object-one']);assert.equal(sql.prepare('SELECT object_keys FROM property_deletions').get()!.object_keys,'[]');assert.equal((await DELETE(request('DELETE',args))).status,404);
assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);console.log('Deletion OK: exact-name confirmation, origin/owner/version checks, concurrency rollback, linked accounting and mixed drafts blocked, exclusive records/files removed, R2 retry, other property/vendor/grant retained and resurrection rejected. Retired credential tables absent.');
