import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {GET,PUT} from '../app/api/properties/route';
import {fresh,totals,type Property} from './model';
import {workflow,stages,prepareExpediente,normalizedApn} from './expediente';
import {GET as documentList,POST as uploadDocument} from '../app/api/documents/route';
import {GET as downloadDocument} from '../app/api/documents/download/route';
import {validateFile,MAX_FILE_BYTES,uploadForm} from './documents';
import {newComparable,emptyAnalysis,comparableSummary,comparableWarnings,validateAnalysis,type Comparable} from './comparables';
import {POST as scenarioPost,GET as scenarioGet} from '../app/api/scenarios/route';
import {emptyInvestment,calculateFlip,ENGINE_VERSION} from './investment';
import {newQuote,newCashPlan} from './financing';
import {newPlanB} from './plan-b';
import {POST as operationPost} from '../app/api/operations/route';
import {budgetTotals} from './operations';

const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
function prepare(query:string){let args:any[]=[];return {bind(...values:any[]){args=values;return this;},async all(){return {results:sql.prepare(query).all(...args)};},async first(){return sql.prepare(query).get(...args)??null;},async run(){return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};}
(globalThis as any).__testDb={prepare,async batch(statements:ReturnType<typeof prepare>[]){sql.exec('BEGIN');try{const result=[];for(const stmt of statements)result.push(await stmt.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};
(globalThis as any).__testUid='owner-a';
const origin='https://test.example';
const request=(path:string,body:unknown,method='PUT',from=origin)=>new Request(origin+path,{method,headers:{'Content-Type':'application/json',Origin:from},body:JSON.stringify(body)});
async function save(p:Property,status=200){const r=await PUT(request('/api/properties',{...p,editReason:'Revisión documentada de prueba'}));const b=await r.json() as any;assert.equal(r.status,status,JSON.stringify(b));return b;}
const draft=fresh();draft.workflow={stage:'Oportunidad',responsible:'Ana',planB:false};draft.workflowEdit={date:'2026-09-01',reason:'Alta de prueba'};draft.apn='00-123 A';
let p=(await save(draft)).property as Property;assert.equal(p.workflowHistory?.length,1);assert.equal(p.dataHistory?.find(h=>h.field==='8')?.source,'Inicial');
const baselineTotals=totals(p);
async function transition(stage:typeof stages[number],planB=false){p.workflow={...workflow(p),stage,planB};p.workflowEdit={date:'2026-09-02',reason:'Cambio a '+stage};p=(await save(p)).property;}
for(const stage of stages.filter(x=>x!=='Sin clasificar'&&x!=='Archivada'))await transition(stage,stage==='En venta');
assert.equal(p.workflowHistory?.find(h=>h.after.stage==='En venta')?.after.planB,true);
await transition('Archivada');assert.equal(p.workflow?.previousStage,'En renta');const count=p.workflowHistory!.length;
await transition(p.workflow!.previousStage!);assert.equal(p.workflow?.stage,'En renta');assert.equal(p.workflowHistory!.length,count+1);assert.deepEqual(totals(p),baselineTotals);
const forged={...p,workflowHistory:[],dataHistory:[],attomHistory:[]};p=(await save(forged)).property;assert.equal(p.workflowHistory!.length,count+1);
const stale=structuredClone(p);p.name='Cambio posterior';p=(await save(p)).property;await save(stale,409);
await save({...p,workflow:{...workflow(p),stage:'Vendida'},workflowEdit:{date:'2026-09-02',reason:''}},400);
await save({...p,workflow:{...workflow(p),stage:'Vendida'},workflowEdit:{date:'2099-01-01',reason:'Futuro'}},400);
await save({...p,workflow:{...workflow(p),stage:'Vendida'},workflowEdit:{date:'2026-02-30',reason:'Fecha inválida'}},400);
const crossOrigin=await PUT(request('/api/properties',p,'PUT','https://evil.example'));assert.equal(crossOrigin.status,403);
(globalThis as any).__testUid=null;assert.equal((await GET()).status,401);(globalThis as any).__testUid='owner-b';assert.equal(((await (await GET()).json()) as any).properties.length,0);await save(p,409);
(globalThis as any).__testUid='owner-a';
const duplicate={...draft,id:crypto.randomUUID(),apn:'00123a',name:'Otro expediente'};assert.equal((await save(duplicate)).duplicates[0].id,p.id);assert.equal(normalizedApn('001-23 A'),'00123A');
const otherCounty={...draft,id:crypto.randomUUID(),county:'Cobb'};assert.equal((await save(otherCounty)).duplicates.length,0);

// Retired integrations cannot be forged into a manual property update.
const retired={...p,attomImport:{receiptId:'obsolete',keys:['8']},attom:{at:'old',address:'prior',fields:{'8':1000}}};p=(await save(retired)).property;assert.equal((p as any).attom,undefined);assert.equal((p as any).attomImport,undefined);
// Existing records retain totals and original snapshots when first edited.
const legacy=fresh();legacy.id='legacy';(legacy as any).attom={at:'old-date',address:'legacy',fields:{'8':1000}};const original=JSON.stringify(legacy);sql.prepare('INSERT INTO properties VALUES(?,?,?,?)').run(legacy.id,'owner-a',original,'2026-09-01T00:00:00.000Z');
const migrated=(await save({...legacy,name:'Renombrada',updatedAt:'2026-09-01T00:00:00.000Z'})).property;assert.equal(migrated.workflow.stage,'Sin clasificar');assert.equal(migrated.workflowHistory.length,0);assert.equal(migrated.attom,undefined);assert.equal(sql.prepare('SELECT original_payload FROM property_baselines WHERE property_id=?').get('legacy')!.original_payload,original);
// A transaction error must not leave a newly-created property without its project.
sql.exec("CREATE TRIGGER abort_fixture BEFORE INSERT ON investment_projects WHEN NEW.property_id='fail' BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");
await save({...draft,id:'fail'},400);assert.equal(sql.prepare("SELECT COUNT(*) n FROM properties WHERE id='fail'").get()!.n,0);
assert.ok(!JSON.stringify(await (await GET()).json()).includes('attomImport'));

// HU-05: independent sale/rental units, evidence, conclusions and immutable snapshots.
const sale:Comparable={...newComparable('Venta'),address:'100 Fixture Ave',amount:300000,eventDate:'2026-09-01',observedAt:'2026-09-02',sqft:1500,condition:'Renovada',distance:0.4,source:'Contrato de prueba',status:'Vendido',adjustment:15000,adjustmentReason:'Diferencia de condición',selected:true};
const rent:Comparable={...sale,id:crypto.randomUUID(),kind:'Renta',status:'Rentado',amount:2200,adjustment:-100};
const analysis={...emptyAnalysis(),comparables:[sale,rent],arv:315000,rent:2100,arvReason:'Venta ajustada y tamaño similar',rentReason:'Contrato ajustado de referencia'};
assert.equal(comparableSummary(analysis,'Venta',1000).indicated,210000);assert.equal(comparableSummary(analysis,'Renta',1000).mean,2100);
validateAnalysis(analysis);assert.throws(()=>validateAnalysis({...analysis,arvReason:''}));assert.throws(()=>validateAnalysis({...analysis,comparables:[rent]}));
assert.throws(()=>validateAnalysis({...analysis,comparables:[{...sale,status:'Rentado'},rent]}));assert.throws(()=>validateAnalysis({...analysis,comparables:[{...sale,source:''},rent]}));
assert.throws(()=>validateAnalysis({...analysis,comparables:[{...sale,adjustmentReason:''},rent]}));assert.throws(()=>validateAnalysis({...analysis,comparables:[{...sale,url:'javascript:alert(1)'},rent]}));
assert.throws(()=>validateAnalysis({...analysis,comparables:[{...sale,eventDate:'2026-02-30'},rent]}));
assert.ok(comparableWarnings({...sale,eventDate:'2025-01-01',status:'Listado'},180,Date.parse('2026-09-07')).length>=2);
p.marketAnalysis=analysis;p=(await save(p)).property;assert.equal(p.marketHistory!.length,1);
const evidence=structuredClone(p.marketHistory![0]);p.marketAnalysis!.comparables[0].amount=320000;p=(await save(p)).property;assert.equal(p.marketHistory!.length,2);assert.deepEqual(p.marketHistory![0],evidence);
p=(await save({...p,marketHistory:[]})).property;assert.equal(p.marketHistory!.length,2);
p.marketAnalysis={...p.marketAnalysis!,arv:null,arvReason:'',comparables:[rent]};p=(await save(p)).property;assert.equal(p.marketHistory![0].analysis.comparables[0].amount,300000);

// HU-04: real handlers and SQLite, with only the R2 transport substituted.
const objects=new Map<string,Uint8Array>();let failPut=false;
(globalThis as any).__testBucket={async put(key:string,body:Uint8Array){if(failPut)throw Error('fixture storage failure');objects.set(key,body.slice());},async get(key:string){const value=objects.get(key);return value?{body:new Response(new Uint8Array(value)).body}:null;},async delete(key:string){objects.delete(key);}};
const pdf=new TextEncoder().encode('%PDF-1.4\nfixture\n%%EOF');
function fileRequest(opts:Record<string,string>={},content:Uint8Array=pdf,filename='term-sheet.pdf',from=origin){const f=new FormData();for(const [k,v] of Object.entries({propertyId:p.id,title:'Term sheet',category:'Term sheet',linkType:'Préstamo',linkRef:'HM-001',note:'Prueba',...opts}))f.set(k,v);f.set('file',new File([new Uint8Array(content)],filename,{type:'application/pdf'}));return new Request(origin+'/api/documents',{method:'POST',headers:{Origin:from},body:f});}
let r=await uploadDocument(fileRequest());assert.equal(r.status,201);const v1=await r.json() as any;assert.equal(objects.size,1);
let downloaded=await downloadDocument(new Request(origin+'/api/documents/download?id='+v1.id));assert.equal(downloaded.status,200);assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()),pdf);assert.ok(downloaded.headers.get('Content-Disposition')!.startsWith('attachment'));assert.equal(downloaded.headers.get('X-Content-Type-Options'),'nosniff');
r=await uploadDocument(fileRequest({groupId:v1.groupId,expectedVersion:'1',note:'Versión 2'}));assert.equal(r.status,201);const v2=await r.json() as any;assert.equal(v2.version,2);assert.equal(objects.size,2);
assert.equal((await uploadDocument(fileRequest({groupId:v1.groupId,expectedVersion:'1'}))).status,409);
const listed=await (await documentList(new Request(origin+'/api/documents?propertyId='+p.id))).json() as any;assert.equal(listed.documents.length,2);assert.ok(!JSON.stringify(listed).includes('object_key'));
assert.equal((await uploadDocument(fileRequest({},pdf,'file.exe'))).status,400);assert.equal((await uploadDocument(fileRequest({},new TextEncoder().encode('<html>'),'fake.pdf'))).status,400);
assert.equal((await uploadDocument(fileRequest({},pdf,'file.pdf','https://evil.example'))).status,403);
(globalThis as any).__testUid='owner-b';assert.equal((await documentList(new Request(origin+'/api/documents?propertyId='+p.id))).status,404);assert.equal((await downloadDocument(new Request(origin+'/api/documents/download?id='+v1.id))).status,404);assert.equal((await uploadDocument(fileRequest())).status,404);
(globalThis as any).__testUid=null;assert.equal((await downloadDocument(new Request(origin+'/api/documents/download?id='+v1.id))).status,401);(globalThis as any).__testUid='owner-a';
failPut=true;assert.equal((await uploadDocument(fileRequest())).status,400);failPut=false;assert.equal(objects.size,2);
sql.exec("CREATE TRIGGER abort_document BEFORE INSERT ON property_documents WHEN NEW.title='FAIL' BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");assert.equal((await uploadDocument(fileRequest({title:'FAIL'}))).status,409);assert.equal(objects.size,2);
assert.equal(sql.prepare('SELECT COUNT(*) n FROM property_documents').get()!.n,2);assert.throws(()=>sql.prepare('DELETE FROM properties WHERE id=?').run(p.id));
// Removing an analysis reference cannot remove its attachment or earlier versions.
p.marketAnalysis=emptyAnalysis();p=(await save(p)).property;assert.equal((await downloadDocument(new Request(origin+'/api/documents/download?id='+v1.id))).status,200);
assert.throws(()=>validateFile('empty.pdf',new Uint8Array()));assert.throws(()=>validateFile('huge.pdf',new Uint8Array(MAX_FILE_BYTES+1)));assert.throws(()=>validateFile('sheet.xlsx',pdf));
assert.equal(validateFile('../../safe.csv',new TextEncoder().encode('a,b\n1,2')).filename,'safe.csv');
await assert.rejects(uploadForm(new Request(origin+'/api/documents',{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary=fixture'},body:new Uint8Array(MAX_FILE_BYTES+65537)})));
console.log('HU-04/HU-05 passed: private uploads/downloads, versions, hashes/bytes, format and body limits, ownership/origin checks, failure cleanup, non-cascading records, separate sale/rent math, evidence validation, staleness/listing warnings and immutable conclusions.');

// HU-07: only server snapshots from the saved property can become a base.
p.rehab={mode:'Manual',manual:40000,rate:35,overlapReviewed:true};p.investment=emptyInvestment(p);p.investment.purchase=100000;p.investment.arv=250000;p.investment.purchaseDate='2026-01-01';p.investment.saleDate='2027-01-01';p.investment.costsReviewed=true;p=(await save(p)).property;
async function scenario(action:string,label='Base',sourceId?:string,status=201,updatedAt=p.updatedAt){const r=await scenarioPost(request('/api/scenarios',{propertyId:p.id,updatedAt,label,action,sourceId},'POST'));const b=await r.json() as any;assert.equal(r.status,status,JSON.stringify(b));return b;}
const approved=await scenario('approve');const stored=await (await scenarioGet(new Request(origin+'/api/scenarios?propertyId='+p.id+'&id='+approved.id))).json() as any;assert.equal(stored.snapshot.engine,ENGINE_VERSION);assert.equal(stored.snapshot.property.investment.purchase,100000);
const cloned=await scenario('duplicate','Conservador',approved.id);assert.notEqual(cloned.id,approved.id);
const oldVersion=p.updatedAt;p.investment!.purchase=120000;p.lines['1']={actual:60000};p=(await save(p)).property;
await scenario('save','stale',undefined,409,oldVersion);await scenario('approve','Intento de reemplazo',undefined,409);const latest=await scenario('save','Pronóstico');
const listResponse=await scenarioGet(new Request(origin+'/api/scenarios?propertyId='+p.id));const listing=await listResponse.json() as any;assert.equal(listing.baseId,approved.id);assert.equal(listing.scenarios.length,3);
const after=await (await scenarioGet(new Request(origin+'/api/scenarios?propertyId='+p.id+'&id='+approved.id))).json() as any;assert.deepEqual(after,stored);assert.ok(calculateFlip(p,p.investment!).totalCost>stored.snapshot.result.totalCost);
const copy=await (await scenarioGet(new Request(origin+'/api/scenarios?propertyId='+p.id+'&id='+cloned.id))).json() as any;assert.deepEqual(copy,stored);
const stressResponse=await scenarioPost(request('/api/scenarios',{propertyId:p.id,updatedAt:p.updatedAt,label:'Adverso',action:'stress',stressIndex:1},'POST'));assert.equal(stressResponse.status,201);const stressSaved=await stressResponse.json() as any;const stressDetail=await (await scenarioGet(new Request(origin+'/api/scenarios?propertyId='+p.id+'&id='+stressSaved.id))).json() as any;assert.equal(stressDetail.snapshot.property.rehab.mode,'Manual');assert.equal(stressDetail.snapshot.sourceStress.name,'Adverso');assert.ok(stressDetail.snapshot.result.profit<calculateFlip(p,p.investment!).profit);
(globalThis as any).__testUid='owner-b';assert.equal((await scenarioGet(new Request(origin+'/api/scenarios?propertyId='+p.id))).status,404);await scenario('duplicate','Ajeno',latest.id,404);(globalThis as any).__testUid=null;assert.equal((await scenarioGet(new Request(origin+'/api/scenarios?propertyId='+p.id))).status,401);(globalThis as any).__testUid='owner-a';
assert.equal((await scenarioPost(request('/api/scenarios',{propertyId:p.id,updatedAt:p.updatedAt,label:'CSRF',action:'save'},'POST','https://evil.example'))).status,403);
console.log('HU-07 passed: saved property/version check, frozen approved base, independent duplication, forecast differences, historical engine/inputs and user/origin isolation.');
// HU-10/12: terms and cash schedules persist inside the isolated, versioned property payload.
const q=newQuote(p.investment!.purchase!,calculateFlip(p,p.investment!).rehab,p.investment!.purchaseDate,p.investment!.saleDate);
q.status='Cotización';q.lender='Fixture lender';q.events=[{id:'fixture-draw',kind:'Draw',date:'2026-02-01',amount:1000,base:'USD',delayDays:15,note:'Reembolso'}];q.rehabReserve=1000;q.committed+=1000;q.maximum=q.committed;
p.investment!.financing={selectedId:q.id,quotes:[q]};p.investment!.cash=newCashPlan('2025-12-01','2028-01-01');p.investment!.cash.earnest=5000;p.investment!.cash.earnestDate='2025-12-15';p=(await save(p)).property;
const reloaded=(await (await GET()).json() as any).properties.find((x:Property)=>x.id===p.id);assert.deepEqual(reloaded.investment.financing,p.investment!.financing);assert.deepEqual(reloaded.investment.cash,p.investment!.cash);
const financedScenario=await scenario('save','Términos y caja');const financedSnapshot=await (await scenarioGet(new Request(origin+'/api/scenarios?propertyId='+p.id+'&id='+financedScenario.id))).json() as any;
assert.equal(financedSnapshot.snapshot.result.debt.drawn,1000);assert.equal(financedSnapshot.snapshot.property.investment.financing.quotes[0].lender,'Fixture lender');assert.ok(financedSnapshot.snapshot.result.cash.ledger.length);
const bad=structuredClone(p);bad.investment!.financing!.quotes[0].events[0].delayDays=-1;await save(bad,400);
const previousQuote=structuredClone(p.investment!.financing!.quotes[0]);p.investment!.financing!.quotes[0].rate=.18;p=(await save(p)).property;
const unchanged=await (await scenarioGet(new Request(origin+'/api/scenarios?propertyId='+p.id+'&id='+financedScenario.id))).json() as any;assert.deepEqual(unchanged,financedSnapshot);assert.notEqual(p.investment!.financing!.quotes[0].rate,previousQuote.rate);
const baseStill=await (await scenarioGet(new Request(origin+'/api/scenarios?propertyId='+p.id+'&id='+approved.id))).json() as any;assert.deepEqual(baseStill,stored);
p.investment!.financing!.quotes[0].maximum=1;p=(await save(p)).property;await scenario('approve','Límite excedido',undefined,400);
(globalThis as any).__testUid='owner-b';assert.ok(!(JSON.stringify(await (await GET()).json())).includes('Fixture lender'));assert.equal((await scenarioGet(new Request(origin+'/api/scenarios?propertyId='+p.id+'&id='+financedScenario.id))).status,404);(globalThis as any).__testUid='owner-a';
console.log('HU-10/HU-12 API passed: persisted terms/events/calendar, server validation, invalid-contract approval blocked, scenario history unchanged, original approved base preserved and account isolation.');
// HU-13/15: structured Plan B persists privately and is frozen with the analysis.
p.investment!.financing!.quotes[0].maximum=p.investment!.financing!.quotes[0].committed;
p.investment!.planBDetails=newPlanB(p.investment!.planB,2000,p.investment!.purchaseDate,p.investment!.saleDate);
p.investment!.planBDetails.rental.units=[{id:'planb-u1',name:'Principal',rent:1800},{id:'planb-u2',name:'Anexo',rent:700}];
p.investment!.planBDetails.refi.appraisal=250000;p.investment!.planBDetails.refi.requested=150000;
p=(await save(p)).property;
const planbRead=(await (await GET()).json() as any).properties.find((x:Property)=>x.id===p.id);assert.deepEqual(planbRead.investment.planBDetails,p.investment!.planBDetails);
const planbVersion=await scenario('save','Plan B de prueba');const planbSnapshot=await (await scenarioGet(new Request(origin+'/api/scenarios?propertyId='+p.id+'&id='+planbVersion.id))).json() as any;
assert.equal(planbSnapshot.snapshot.result.fullPlanB.rental.gross,2500);assert.equal(planbSnapshot.snapshot.result.fullPlanB.status,'Pendiente de revisión');assert.equal(planbSnapshot.snapshot.result.fullPlanB.availableProceeds,0);assert.equal(planbSnapshot.snapshot.result.fullPlanB.loan.rows.length,360);
const invalidPlanB=structuredClone(p);invalidPlanB.investment!.planBDetails!.refi.rate=-1;await save(invalidPlanB,400);
p.investment!.planBDetails!.rental.units[0].rent=1900;p=(await save(p)).property;
assert.deepEqual(await (await scenarioGet(new Request(origin+'/api/scenarios?propertyId='+p.id+'&id='+planbVersion.id))).json(),planbSnapshot);
const compactList=await (await scenarioGet(new Request(origin+'/api/scenarios?propertyId='+p.id))).json() as any;assert.equal(compactList.scenarios.find((x:any)=>x.id===planbVersion.id).result.fullPlanB.loan.rows.length,0);
(globalThis as any).__testUid='owner-b';assert.equal((await scenarioGet(new Request(origin+'/api/scenarios?propertyId='+p.id+'&id='+planbVersion.id))).status,404);(globalThis as any).__testUid='owner-a';
console.log('HU-13/HU-15 API passed: Plan B persistence, validation, pending funds excluded, full amortization snapshot, compact listing, immutable previous inputs and owner isolation.');
// HU-17/20: immutable operation events, real ownership/origin/version checks and financial effects.
async function operation(action:string,data:any=undefined,status=201,extra:any={}){const response=await operationPost(request('/api/operations',{propertyId:p.id,updatedAt:p.updatedAt,action,date:'2026-01-01',reason:'Fixture operation',data,...extra},'POST'));const body=await response.json() as any;assert.equal(response.status,status,JSON.stringify(body));if(response.status===201)p=body.property;return body;}
await operation('budget');const frozenBudget=structuredClone(p.operations!.budget!.base),paidBefore=JSON.stringify(p.lines);const totalBefore=calculateFlip(p,p.investment!).rehab;
await operation('budget',undefined,400);
await operation('diligence',{id:'fixture-title',name:'Título',owner:'Ana',due:'2026-02-01',critical:true,status:'Pendiente',documentId:'',note:'Revisar'});
await operation('diligence',{id:'fixture-title',name:'Título',owner:'Ana',due:'2026-02-01',critical:true,status:'Resuelto',documentId:'',note:'OK'},400);
await operation('diligence',{id:'fixture-title',name:'Título',owner:'Ana',due:'2026-02-01',critical:true,status:'Resuelto',documentId:v1.id,note:'Título revisado'});
assert.equal(p.operations!.diligenceHistory.length,2);
await operation('order',{lineId:'',scope:'Hallazgo de inspección',amount:5000,reserve:1000,findingId:'fixture-title',decisionReview:'Mantener adquisición con presupuesto actualizado'});
assert.deepEqual(p.operations!.budget!.base,frozenBudget);assert.equal(JSON.stringify(p.lines),paidBefore);assert.equal(calculateFlip(p,p.investment!).rehab,totalBefore+4000);
const pVersion=p.updatedAt;await operation('order',{lineId:'',scope:'Exceso',amount:5000,reserve:1e9,findingId:'',decisionReview:''},400);assert.equal(p.updatedAt,pVersion);
const internal={parentId:'',scenarioId:planbVersion.id,amount:120000,expires:'2026-02-01',terms:'Fixture cash terms',contingencies:'Inspección',decision:'Aprobar',availableCapital:1,minProfit:1e9,minMargin:.99,requirePlanB:true,exception:''};
await operation('offer',internal,400);await operation('offer',{...internal,exception:'Excepción documentada de prueba'});assert.ok(p.operations!.offers[0].violations.length);
const offerId=p.operations!.offers[0].id;await operation('offer',{...internal,parentId:offerId,decision:'Negociar',amount:110000});assert.equal(p.operations!.offers.length,2);
p=(await save({...p,operations:{offers:[],diligence:[],diligenceHistory:[]}})).property;assert.equal(p.operations!.offers.length,2);assert.equal(p.operations!.budget!.orders.length,1);
const loan=p.investment!.financing!.quotes[0];loan.status='Préstamo firmado';p=(await save(p)).property;
const realPrice=p.investment!.purchase!,funded=realPrice*loan.advance+loan.financedFees+loan.financedRetention,origination=loan.committed*loan.points+loan.fees;
const signed={date:'2026-01-01',price:realPrice,earnest:5000,earnestDate:'2025-12-15',lender:funded,capital:realPrice+1500+origination+loan.retention-5000-funded,loanId:loan.id,documentId:v1.id,reference:'SETTLEMENT FIXTURE',exception:'',replaceCosts:p.investment!.costs.map(x=>x.id),excludeLegacy:p.costs.map((_,i)=>i),lines:[{id:'cost',name:'Título real',kind:'Costo',direction:'Uso',amount:2000,refund:false},{id:'credit',name:'Crédito vendedor',kind:'Costo',direction:'Crédito',amount:500,refund:false},{id:'fee',name:'Puntos reales',kind:'Originación',direction:'Uso',amount:origination,refund:false},{id:'retained',name:'Reserva retenida',kind:'Reserva de interés',direction:'Uso',amount:loan.retention,refund:false}]};
await operation('closing',signed,400);await operation('closing',{...signed,capital:1},400,{confirm:true});assert.equal(p.operations!.closing,undefined);
await operation('closing',signed,201,{confirm:true});assert.equal(p.workflow!.stage,'Adquirida');assert.equal(p.operations!.closing!.difference,0);assert.equal(p.operations!.closing!.costAdjustment,1500);assert.equal(p.investment!.cash!.opening,0);assert.equal(p.investment!.cash!.contributions[0].amount,5000);
const real=calculateFlip(p,p.investment!);assert.equal(real.rows.find(x=>x.id==='actual-closing')!.total,1500);assert.equal(real.purchase,realPrice);
await operation('closing',signed,400,{confirm:true});p.investment!.purchase=1;p=(await save(p)).property;assert.equal(p.investment!.purchase,realPrice);assert.equal(p.operations!.closing!.reference,'SETTLEMENT FIXTURE');
assert.equal((await operationPost(request('/api/operations',{propertyId:p.id,updatedAt:'stale',action:'budget',date:'2026-01-01',reason:'stale'},'POST'))).status,409);
assert.equal((await operationPost(request('/api/operations',{propertyId:p.id,updatedAt:p.updatedAt,action:'budget'},'POST','https://evil.example'))).status,403);
(globalThis as any).__testUid='owner-b';await operation('budget',undefined,404);(globalThis as any).__testUid=null;assert.equal((await operationPost(request('/api/operations',{},'POST'))).status,401);(globalThis as any).__testUid='owner-a';
console.log('HU-17/HU-18/HU-19/HU-20 API passed: decisions and exceptions, owned evidence, diligence revisions, frozen base and reviewed changes, guarded histories, confirmed reconciled closing, real forecast and stage, no duplicate payments, stale/anonymous/cross-owner/origin checks.');
sql.close();console.log('HU-02/HU-03: workflow, Plan B, archive/recovery, immutable history, dates, conflicts, transaction rollback, user/origin isolation, duplicates, manual property data and retired integration compatibility passed.');
