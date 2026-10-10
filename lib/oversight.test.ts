import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {GET,POST} from '../app/api/accounting/route';
import {GET as propertiesGet,PUT as propertiesPut} from '../app/api/properties/route';
import {fresh,totals,type Property} from './model';
import {newQuote} from './financing';
import {newPlanB} from './plan-b';
import {delivery,taskSchedule,costToComplete,projectExecution,saleResult,exitReview,emptyDelivery} from './delivery';
import {emptyInvestment,calculateFlip} from './investment';
import {emptyOperations,freezeBudget} from './operations';
import {emptyBook,accountingSummary,invoiceRows,currentQuote,advanceBalance,cents,type Book,type Invoice,type Movement} from './accounting';
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const file of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+file,'utf8').replaceAll('--> statement-breakpoint',''));
let concurrent=false;
function prepare(query:string){let args:any[]=[];return {bind(...v:any[]){args=v;return this;},async all(){return {results:sql.prepare(query).all(...args)};},async first(){return sql.prepare(query).get(...args)??null;},async run(){if(concurrent&&query.startsWith('UPDATE accounting_books')){concurrent=false;sql.prepare('UPDATE properties SET updated_at=? WHERE id=?').run('changed',p.id);}return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};}
(globalThis as any).__testDb={prepare,async batch(stmts:ReturnType<typeof prepare>[]){sql.exec('BEGIN');try{const result=[];for(const s of stmts)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};(globalThis as any).__testUid='owner-a';
const origin='https://test.example',audit={id:'base',date:'2026-09-01',at:'2026-09-01T00:00:00.000Z',actor:'owner-a',reason:'Base'};
function property(name:string){const p=fresh();p.name=name;p.workflow={stage:'Obra',responsible:'Ana',planB:false};p.rehab={mode:'Manual',rate:null,manual:1000,overlapReviewed:true};p.investment=emptyInvestment(p);Object.assign(p.investment,{purchase:100000,arv:150000,purchaseDate:'2026-08-01',saleDate:'2027-02-01',costsReviewed:true});p.investment.loan.type='Efectivo';p.operations=emptyOperations();p.operations.budget=freezeBudget(p,audit);p.lines['1']={actual:100};p.updatedAt=audit.at;sql.prepare('INSERT INTO properties(id,user_id,payload,updated_at) VALUES(?,?,?,?)').run(p.id,'owner-a',JSON.stringify(p),p.updatedAt);return p;}
const p=property('A'),p2=property('B');
for(const prop of [p,p2]){prop.operations!.closing={date:'2026-08-01',price:100000,loanId:'',costAdjustment:0,replaceCosts:[],excludeLegacy:[],lines:[],lender:90000,earnest:0,capital:10000,deposit:0,depositRefund:0} as any;sql.prepare('UPDATE properties SET payload=? WHERE id=?').run(JSON.stringify(prop),prop.id);}
const loan=newQuote(100000,1000,'2026-08-01','2027-12-01');loan.status='Préstamo firmado';loan.rehabReserve=2000;loan.committed=92000;loan.maximum=92000;loan.events=[{id:'old-forecast',date:'2026-08-10',kind:'Draw',amount:1000,base:'USD',delayDays:0,note:'Pronóstico anterior'}];p.investment!.loan.type='Hard money';p.investment!.financing={selectedId:loan.id,quotes:[loan]};p.investment!.costs.find(c=>c.name==='Comisión de venta')!.value=5000;Object.assign(p.operations!.closing!,{loanId:loan.id,id:'closed-test',earnestDate:'2026-08-01',before:{investment:structuredClone(p.investment)}});sql.prepare('UPDATE properties SET payload=? WHERE id=?').run(JSON.stringify(p),p.id);
function doc(pid:string,id:string,owner='owner-a'){sql.prepare('INSERT INTO property_documents(id,group_id,property_id,user_id,version,object_key,filename,mime,size,sha256,title,category,link_type,link_ref,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,id,pid,owner,1,id,'doc.pdf','application/pdf',20,'sha','Documento','Otros','','','',audit.at);}
doc(p.id,'doc-a');doc(p2.id,'doc-b');
let book:Book=emptyBook(),version='';const request=(action:string,data:any,ver=version,from=origin)=>new Request(origin+'/api/accounting',{method:'POST',headers:{Origin:from,'Content-Type':'application/json'},body:JSON.stringify({action,data,version:ver,date:'2026-09-02',reason:'Prueba documentada'})});
async function act(action:string,data:any,status=201){const before=JSON.stringify(book),v=version,r=await POST(request(action,data)),b=await r.json() as any;assert.equal(r.status,status,JSON.stringify(b));if(status===201){book=b.book;version=b.version;}else{const stored=await (await GET()).json() as any;assert.equal(stored.version,v);assert.equal(JSON.stringify(stored.book),before);}return b;}


const life=(action:string,data:any,status=201,pid=p.id)=>act('lifecycle:'+action,{...data,propertyId:pid},status);
const {lifecycle,leaseStatement,occupancy,saleActual,rentalReport,restrictedDeposits}=await import('./lifecycle');
const closeSale={price:150000,credits:1000,commission:9000,fees:1000,principal:90000,interest:2000,holdback:1000,cash:46000,priorCost:120000,capital:30000,costNote:'Compra, obra y tenencia reconciliadas; principal separado.',account:'Banco',reference:'SALE1',documentId:'doc-b'};
await life('sale',{...closeSale,cash:46001},400,p2.id);
await life('sale',closeSale,201,p2.id);assert.equal(saleActual(book,p2.id)!.profit,17000);assert.equal(accountingSummary(book,p2.id,'2026-09-02').cash,46000);
await life('sale',{...closeSale,holdback:0,cash:47000,reference:'SALE2'},201,p2.id);assert.equal(lifecycle(book,p2.id).sales.length,2);assert.equal(accountingSummary(book,p2.id,'2026-09-02').cash,47000,'Correction adds difference only');
const rf={lender:'Conventional',appraisal:160000,principal:110000,rate:.0725,years:30,fees:3000,escrow:2000,payoffPrincipal:90000,payoffInterest:2000,cash:13000,firstPayment:'2026-10-01',conditions:'Terms verified',account:'Banco',reference:'REFI1',documentId:'doc-a'};
await life('refi',{...rf,stage:'Cierre'},400);
for(const stage of ['Solicitud','Condiciones','Tasación','Aprobación'])await life('refi',{...rf,stage});
await life('refi',{...rf,stage:'Cierre',cash:13001},400);await life('refi',{...rf,stage:'Cierre'});
assert.equal(lifecycle(book,p.id).payoffs.length,0,'Closing alone does not confirm payoff');assert.equal(accountingSummary(book,p.id,'2026-09-02').cash,13000);
await life('payoff',{principal:90001,interest:2000,documentId:'doc-a',account:'Escrow',reference:'PAYOFF'},400);
await life('payoff',{principal:90000,interest:2000,documentId:'doc-a',account:'Escrow',reference:'PAYOFF'});assert.equal(accountingSummary(book,p.id,'2026-09-02').cash,13000,'Payoff retained at close not second expense');
await life('first-payment',{principal:200,interest:600,escrow:200,documentId:'doc-a',account:'Banco',reference:'FIRST'});assert.equal(accountingSummary(book,p.id,'2026-09-02').cash,12000);
const checks=['Seguro landlord vigente','Requisitos locales y HOA revisados','Habitabilidad e inspecciones','Reparaciones y limpieza','Gestión y contrato de administración revisados'];
const prep={unit:'Casa',status:'Disponible',available:'2026-09-02',owner:'Ana',insurance:'Landlord new policy',insuranceExpiry:'2027-09-01',requirements:'Municipality and HOA reviewed',checks,documentId:'doc-a'};
await life('readiness',{...prep,checks:[]},400);await life('readiness',{...prep,documentId:'doc-b'},400);await life('readiness',prep);
const ls={unit:'Casa',tenant:'Tenant',start:'2026-09-02',end:'2027-08-31',rent:1000,dueDay:2,deposit:1000,rules:'Locally reviewed rules',reviewedBy:'Reviewer',documentId:'doc-a'};
await life('lease',ls);await life('lease',ls,400);const lid=lifecycle(book,p.id).leases[0].id;assert.equal(occupancy(lifecycle(book,p.id),'Casa','2026-09-02'),'Ocupada');
const rent=(kind:string,amount:number,sourceId='',reference='',status=201)=>life('rent',{leaseId:lid,kind,amount,sourceId,reference,account:'Bank rent',documentId:'doc-a',due:'2026-09-02',period:'2026-09'},status);
await rent('Cargo',1000);const cid=lifecycle(book,p.id).rent[0].id;await rent('Cargo',1000,'','',400);await rent('Ajuste',-100,cid);await rent('Cobro',400,cid,'RENT1');await rent('Cobro',600,cid,'OVER',400);await rent('Depósito recibido',1000,'','DEP1');assert.equal(leaseStatement(lifecycle(book,p.id),lid).income,400);assert.equal(restrictedDeposits(book,p.id),1000);
await rent('Depósito aplicado',500,cid);await rent('Depósito devuelto',500,'','REFUND');assert.equal(leaseStatement(lifecycle(book,p.id),lid).balance,0);assert.equal(restrictedDeposits(book,p.id),0);await rent('Depósito devuelto',1,'','OVERREFUND',400);await rent('Reverso',0,cid,'',400);const depId=lifecycle(book,p.id).rent.find(r=>r.kind==='Depósito recibido')!.id;await rent('Reverso',0,depId,'',400);
await act('supplier',{id:'vendor',name:'Plumber',contact:'Ana',phone:'555',email:'',address:'',note:''});
const inv={declaredTotal:300,supplierId:'vendor',number:'RENT-INV',due:'2026-09-02',documentId:'doc-a',documentPropertyId:p.id,contractId:'',creditFor:'',duplicateReason:'',lines:[{id:'rental-line',propertyId:p.id,bucket:'rental:operating',category:'Otros',description:'Repair',subtotal:300,tax:0,retention:0,included:0,sourceLineId:''}]};await act('invoice',inv);const iid=book.invoices.at(-1)!.id;await act('approve',{id:iid});
const order={id:'order1',name:'Repair',unit:'Casa',supplierId:'vendor',due:'2026-09-02',renewal:'2027-09-01',status:'Terminada',classification:'Operativo',start:'2026-09-01',end:'2026-09-30',lineIds:['rental-line'],escrow:false,documentId:'doc-a'};
await life('maintenance',order);await life('maintenance',{...order,id:'duplicate'},400);assert.equal(rentalReport(book,p.id,'2026-09-01','2026-09-15').operating,150);assert.equal(rentalReport(book,p.id,'2026-09-01','2026-09-30').income,900);assert.equal(projectExecution(p,book,'','2026-09-02').costs['rental:operating'],undefined,'Rental cost not added to historical flip');
await life('maintenance',{...order,escrow:true},400);
const paymentData={kind:'Pago',propertyId:p.id,supplierId:'vendor',invoiceId:iid,lineId:'rental-line',sourceId:'',amount:300,account:'Banco',reference:'FIRST',documentId:'doc-a'};await act('movement',paymentData,400);await act('movement',{...paymentData,account:'Escrow',reference:'TAX-PAID'});await life('maintenance',{...order,escrow:true});assert.equal(rentalReport(book,p.id,'2026-09-01','2026-09-30').operating,300,'Escrow payment does not add expense again');
const later={...inv,declaredTotal:200,number:'SALE-LATER',documentId:'doc-b',documentPropertyId:p2.id,lines:[{...inv.lines[0],id:'sale-later-line',propertyId:p2.id,bucket:'extra:Venta',subtotal:200}]};await act('invoice',later);await act('approve',{id:book.invoices.at(-1)!.id});assert.equal(saleActual(book,p2.id)!.profit,16800,'Post-closing invoice reduces actual profit');
const cashBefore=accountingSummary(book,p.id,'2026-09-02').cash;await life('reserve',{amount:500,from:'Operating',to:'Reserve',reference:'TRANSFER',documentId:'doc-a'});assert.equal(accountingSummary(book,p.id,'2026-09-02').cash,cashBefore,'Internal reserve transfer is not expense');

const {oversight,portfolioRows,bankLedger,rentalMonths,mortgageActual,csvExport}=await import('./oversight');
const {GET:oversightGet}=await import('../app/api/oversight/route');
const {POST:importPost}=await import('../app/api/import-workbook/route');
const {inspectWorkbook}=await import('./workbook-import');
const {redact}=await import('./audit');
const over=(action:string,data:any,status=201)=>act('oversight:'+action,{...data,propertyId:p.id},status);
await over('holding',{title:'Holding LLC',basis:120000,value:160000,reserve:100,documentId:'doc-a'});
const monthly=rentalMonths(p,book,'2026-09-01','2026-09-30')[0];assert.equal(monthly.effective,900);assert.equal(monthly.noi,600);assert.equal(monthly.reserve,100);assert.equal(monthly.principal,200);assert.equal(monthly.service,800);
await over('account',{name:'Ops X',kind:'Libre',balance:1000,documentId:'doc-a'});await over('account',{name:'Ops Y',kind:'Reserva',balance:1000,documentId:'doc-a'});
await over('transfer',{fromPropertyId:p.id,toPropertyId:p.id,from:'Ops X',to:'Ops Y',amount:100,reference:'TX',documentId:'doc-a'});assert.equal(bankLedger(book).filter(e=>e.reference==='TX').reduce((s,e)=>s+e.amount,0),0,'Internal transfer eliminates in consolidation');
await over('payment',{principal:100,interest:100,escrow:0,account:'Ops X',reference:'PMT2',documentId:'doc-a'});assert.equal(mortgageActual(p,book,'2026-09-02')!.principal,109700);assert.equal(portfolioRows([p],book,'2026-09-02')[0].debt,109700,'Paid hard money is excluded; no double debt');
await over('rental-exit',{price:180000,selling:10000,dateExit:'2027-09-02'});const saved=oversight(book).sales[0].result;assert.equal(saved.refiCapitalReturned,13000);assert.equal(saved.basis,120000);assert.equal(saved.unrealized,40000);assert.ok(saved.profit!<60000,'Refi cash is not profit');
const csv='date,amount,description,id\n2026-09-02,-100,Transfer,TX1\n2026-09-02,-200,Payment,PMT2';const mapping={date:0,amount:1,description:2,id:3,dateFormat:'ISO',decimal:'.'};
await over('bank-import',{account:'Ops X',csv,mapping,delimiter:','});await over('bank-import',{account:'Ops X',csv,mapping,delimiter:','},400);assert.equal(oversight(book).bankRows.length,2);
await over('bank-import',{account:'Ops X',csv:csv.replace('-100','-101'),mapping,delimiter:','},400);
const bs=oversight(book).bankRows,led=bankLedger(book);await over('match',{bankId:bs[0].id,ledgerId:led.find(e=>e.reference==='PMT2')!.id},400);
await over('match',{bankId:bs[0].id,ledgerId:led.find(e=>e.reference==='TX'&&e.account==='Ops X')!.id});await over('match',{bankId:bs[1].id,ledgerId:led.find(e=>e.reference==='PMT2')!.id});
await over('reconcile',{account:'Ops X',start:'2026-09-01',end:'2026-09-02',opening:1000,closing:701,documentId:'doc-a'},400);await over('reconcile',{account:'Ops X',start:'2026-09-01',end:'2026-09-02',opening:1000,closing:700,documentId:'doc-a'});await over('unmatch',{bankId:bs[0].id},400);
const original=(await (await propertiesGet()).json() as any).properties.find((x:any)=>x.id===p.id);original.investment.arv+=1000;
const putRequest=(value:any)=>new Request(origin+'/api/properties',{method:'PUT',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(value)});
assert.equal((await propertiesPut(putRequest(original))).status,400,'Approved amounts need reason');const changed=await propertiesPut(putRequest({...original,editReason:'Updated supported ARV'}));assert.equal(changed.status,200,await changed.text());
const exportResponse=await oversightGet(new Request(origin+'/api/oversight?export=csv'));assert.equal(exportResponse.status,200);const exported=await exportResponse.text();assert.ok(exported.includes('Deuda principal'));assert.ok(!exported.includes('encrypted_key'));assert.ok(csvExport([['=HYPERLINK("bad")']]).includes("'=HYPERLINK"));assert.deepEqual(redact({apiKey:'secret',nested:{password:'secret',amount:3}}),{nested:{amount:3}});
const auditResponse=await (await oversightGet(new Request(origin+'/api/oversight'))).json() as any;assert.ok(auditResponse.audit.some((e:any)=>e.changes.some((c:any)=>c.field==='investment.arv'&&c.before!==c.after)));
const workbookPath=process.env.REHAB_TEST_WORKBOOK;
if(workbookPath){const file=readFileSync(workbookPath).toString('base64'),preview=await inspectWorkbook(file);assert.equal(preview.cells.purchase.value,95000);assert.equal(preview.cells.rent.value,3500);assert.equal(preview.cells.advance.formula,'D25*90%');assert.ok(preview.h01&&preview.h02);
 const imp={action:'commit',file,name:'Imported test draft',responsible:'Ana',purchaseDate:'2026-09-01',budget:'Estimador',manual:0,advance:85500,reserve:70070,commitment:155570,maximum:168000,interestBasis:'Utilizado',pointsBase:'Compromiso',reason:'H01 H02 reviewed',reviewed:true};
 const req=(x:any)=>new Request(origin+'/api/import-workbook',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(x)});
 assert.equal((await importPost(req({...imp,reviewed:false}))).status,400);const response=await importPost(req(imp)),data=await response.json() as any;assert.equal(response.status,201,JSON.stringify(data));assert.equal(data.property.rehab.manual,44590);assert.equal(data.property.investment.financing.quotes[0].rate,.0975);assert.equal((await importPost(req(imp))).status,409,'Repeated workbook creates no second property');}
(globalThis as any).__testUid='owner-b';assert.equal((await oversightGet(new Request(origin+'/api/oversight?propertyId='+p.id))).status,404);(globalThis as any).__testUid='owner-a';
console.log('HU-34–38: monthly rent/debt, portfolio transfers, CSV mapping/dedup/matching/reconciliation, server audit/reasons/export isolation and optional original workbook import passed');
