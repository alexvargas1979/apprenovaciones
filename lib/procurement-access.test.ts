import {POST as recurringPost} from '../app/api/expense-recurring/route';
import {costAlerts,recurringDraft} from './expense-control';
import {readBook} from './accounting-server';
import {storedBook,invoiceWrites} from './expense-storage';
import {PDFDocument} from 'pdf-lib';
import {validateAttachmentPages} from './invoice-pages-server';
import {purchaseRows,purchaseIssues} from './procurement';
import {costToComplete} from './delivery';
import {POST as teamPost} from '../app/api/team/route';
import {compareCuts} from './expense-comparison';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {GET,POST} from '../app/api/accounting/route';
import {fresh,type Property} from './model';
import {emptyInvestment} from './investment';
import {emptyOperations,freezeBudget} from './operations';
import {emptyBook,accountingSummary,type Book,type Invoice,cents} from './accounting';
import {POST as draftPost,GET as draftGet} from '../app/api/invoice-drafts/route';
import {POST as reportPost,GET as reportGet} from '../app/api/expense-reports/route';
import {POST as uploadPost} from '../app/api/documents/route';
import {GET as downloadGet} from '../app/api/documents/download/route';
import {defaultDetail,termsDue,lineSubtotal,type InvoiceDraft} from './invoices';
import {comparison} from './expense-comparison';
import {classificationBook,lineClassification,percentageSplits,mappingFor,budgetSources} from './classification';
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+f,'utf8').replaceAll('--> statement-breakpoint',''));
let concurrent=false;
function prepare(query:string){let args:any[]=[];return {bind(...v:any[]){args=v;return this;},async all(){return {results:sql.prepare(query).all(...args)};},async first(){return sql.prepare(query).get(...args)??null;},async run(){if(concurrent&&query.startsWith('UPDATE accounting_books')){concurrent=false;sql.prepare('UPDATE properties SET updated_at=? WHERE id=?').run('changed',p.id);}return {meta:{changes:Number(sql.prepare(query).run(...args).changes)}};}};}
(globalThis as any).__testDb={prepare,async batch(stmts:any[]){sql.exec('BEGIN');try{const out=[];for(const s of stmts)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};(globalThis as any).__testUid='owner-a';
const audit={id:'base',date:'2026-09-01',at:'2026-09-01T00:00:00Z',actor:'owner-a',reason:'Base'};
function property(name:string){const p=fresh();p.name=name;p.rehab={mode:'Manual',rate:null,manual:1000,overlapReviewed:true};p.investment=emptyInvestment(p);Object.assign(p.investment,{purchase:100000,arv:150000,purchaseDate:'2026-08-01',saleDate:'2027-02-01',costsReviewed:true});p.investment.loan.type='Efectivo';p.operations=emptyOperations();p.operations.budget=freezeBudget(p,audit);p.updatedAt=audit.at;sql.prepare('INSERT INTO properties(id,user_id,payload,updated_at) VALUES(?,?,?,?)').run(p.id,'owner-a',JSON.stringify(p),p.updatedAt);return p;}
const p=property('Cocina A'),p2=property('Casa B'),original=JSON.stringify(p.operations?.budget),origin='https://test.example';
sql.prepare('INSERT INTO property_documents(id,group_id,property_id,user_id,version,object_key,filename,mime,size,sha256,title,category,link_type,link_ref,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('doc','doc',p.id,'owner-a',1,'doc','invoice.pdf','application/pdf',20,'hash','Factura','Otros','','','',audit.at);
let book:Book=emptyBook(),version='';
function request(action:string,data:any,v=version){return new Request(origin+'/api/accounting',{method:'POST',headers:{Origin:origin},body:JSON.stringify({action,data,version:v,date:'2026-10-01',reason:'Prueba HU-41 / HU-42'})});}
async function act(action:string,data:any,status=201){const before=JSON.stringify(book),v=version,r=await POST(request(action,data)),b=await r.json() as any;assert.equal(r.status,status,JSON.stringify(b));if(status===201){book=b.book;version=b.version;}else{const stored=await (await GET()).json() as any;assert.equal(stored.version,v);assert.equal(JSON.stringify(stored.book),before);}return b;}
await act('supplier',{id:'vendor',name:'Proveedor',contact:'Ana',phone:'555',email:'',address:'',note:''});
await act('classification:center',{id:'kitchen',propertyId:p.id,name:'Cocina',active:true});
const order={propertyId:p.id,supplierId:'vendor',reference:'OC-10',contractId:'',lines:[{id:'po-line',description:'Unidades',productId:'',centerId:'kitchen',bucket:'line:1',quantity:10,unit:'unidad',unitPrice:100}]};
await act('purchase:save',order);const oid=book.procurement!.orders[0].id;
assert.equal(costToComplete(p,book,'2026-10-01').pending,0);
await act('purchase:approve',{id:oid});assert.equal(costToComplete(p,book,'2026-10-01').pending,1000);
await act('purchase:receive',{orderId:oid,responsible:'Ana',documentId:'doc',lines:[{lineId:'po-line',received:6,damaged:1,note:'Una dañada, faltan cuatro aceptadas'}]});assert.equal(purchaseRows(book)[0].toReceive,4);
const detail=defaultDetail('poinvoice','2026-09-15');detail.attachments=[{documentId:'doc',propertyId:p.id,pages:'',kind:'Factura'}];
const invoice:Invoice={detail,supplierId:'vendor',number:'PO-INVOICE',declaredTotal:800,due:termsDue(detail),documentId:'doc',documentPropertyId:p.id,contractId:'',creditFor:'',duplicateReason:'',lines:[{id:'po-invoice-line',propertyId:p.id,bucket:'line:1',category:'Materiales',description:'Ocho unidades',subtotal:800,tax:0,retention:0,included:0,sourceLineId:'',purchase:[{orderId:oid,lineId:'po-line',quantity:8,amount:800}],detail:{mode:'Cantidad',quantity:8,unit:'unidad',unitPrice:100,discount:0,charges:0}}]};
invoice.lines[0].classification={...lineClassification(book,invoice.lines[0]),splits:[{centerId:'kitchen',name:'Cocina',subtotal:800,tax:0}]};
assert.ok(purchaseIssues(book,invoice).some(s=>s.includes('2 unidades')));
await act('invoice',invoice);const iid=book.invoices.at(-1)!.id;await act('approve',{id:iid},400);await act('approve',{id:iid,purchaseException:'Acepto anticipo de dos unidades aún no recibidas'});assert.equal(costToComplete(p,book,'2026-10-01').pending,200);assert.equal(costToComplete(p,book,'2026-10-01').direct,1000);
await act('purchase:save',{...order,id:oid,lines:[{...order.lines[0],quantity:5}]});await act('purchase:approve',{id:oid},400);assert.equal(purchaseRows(book)[0].line.quantity,10);
// Contract-backed orders reuse and consume the contract, without adding a second commitment.
await act('quote',{propertyId:p.id,supplierId:'vendor',contractId:'',scope:'Otra partida',reference:'Contract',documentId:'doc',retention:0,lines:[{bucket:'line:2',amount:500}],milestones:[{name:'Entrega',date:'2026-10-01',amount:500}]});await act('accept',{id:book.quotes.at(-1)!.id});const cid=book.contracts.at(-1)!.id;
await act('purchase:save',{...order,reference:'OC-CONTRACT',contractId:cid,lines:[{...order.lines[0],id:'contract-line',bucket:'line:2',quantity:5}]});await act('purchase:approve',{id:book.procurement!.orders.at(-1)!.id});assert.equal(costToComplete(p,book,'2026-10-01').pending,700);
// Opt-in grant. Existing role alone has no expense permission.
let grant:any={name:'Capturista',email:'test@example.test',role:'Administración',propertyIds:[p.id],taskIds:[],status:'Activo',expires:'2027-01-01'};
function grantSave(){sql.prepare('INSERT INTO team_members(id,owner_id,member_id,token_hash,payload,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').run('grant','owner-a','member','hash-grant',JSON.stringify(grant),crypto.randomUUID());}
grantSave();(globalThis as any).__testUid='member';assert.equal((await GET(new Request(origin+'/api/accounting?grantId=grant'))).status,403);
grant.expenses={permissions:['draft','classify','upload'],centerIds:['kitchen'],allCenters:false,maxAmount:100};grantSave();
let response=await GET(new Request(origin+'/api/accounting?grantId=grant'));assert.equal(response.status,200);let projection=await response.json() as any;assert.equal(projection.properties.length,1);assert.equal(projection.properties[0].investment,undefined);assert.deepEqual(projection.book.movements,[]);
const draftInvoice=structuredClone(invoice);draftInvoice.detail={...detail,requestId:'team-draft',noOrderReason:'Compra directa'};draftInvoice.number='TEAM-DRAFT';draftInvoice.lines=[{...draftInvoice.lines[0],id:'team-line',purchase:undefined}];
let draft:any={id:'team-draft',propertyId:p.id,status:'Borrador',invoice:draftInvoice,note:'captura',updatedAt:''};
const dr=(d:any)=>new Request(origin+'/api/invoice-drafts',{method:'POST',headers:{Origin:origin},body:JSON.stringify({...d,grantId:'grant'})});
response=await draftPost(dr(draft));assert.equal(response.status,201,await response.clone().text());draft=(await response.json() as any).draft;
const attempt=(action:string,data:any)=>POST(new Request(origin+'/api/accounting',{method:'POST',headers:{Origin:origin},body:JSON.stringify({grantId:'grant',action,data,version,date:'2026-10-01',reason:'Prueba de permisos'})}));
assert.equal((await attempt('approve',{id:iid})).status,403);assert.equal((await attempt('movement',{kind:'Pago',invoiceId:iid})).status,403);assert.equal((await draftPost(dr({...draft,propertyId:p2.id,invoice:{...draft.invoice,lines:[{...draft.invoice.lines[0],propertyId:p2.id}]}}))).status,403);
// Review and correction are audited; stale edits fail and cannot forge a reviewed flag.
grant.expenses.permissions.push('review');grantSave();response=await draftPost(dr({...draft,status:'En revisión'}));draft=(await response.json() as any).draft;response=await draftPost(dr({...draft,reviewAction:'review',observation:'Verificado contra el original'}));assert.equal(response.status,201);draft=(await response.json() as any).draft;assert.ok(draft.workflow.review);
const stale=structuredClone(draft);response=await draftPost(dr({...draft,invoice:{...draft.invoice,number:'TEAM-CORRECTED'}}));assert.equal(response.status,201);draft=(await response.json() as any).draft;assert.equal(draft.workflow.review,undefined);assert.equal(draft.status,'Borrador');assert.equal((await draftPost(dr(stale))).status,409);
// File access follows invoice scope, not merely the property grant.
const files=new Map<string,Uint8Array>();files.set('doc',new TextEncoder().encode('%PDF-1.4 test'));(globalThis as any).__testBucket={put:async(k:string,v:Uint8Array)=>{files.set(k,v);},delete:async(k:string)=>{files.delete(k);},get:async(k:string)=>{const v=files.get(k);return v?{body:new Response(new Uint8Array(v)).body}:null;}};
assert.equal((await downloadGet(new Request(origin+'/api/documents/download?id=doc&grantId=grant'))).status,200);
grant.expenses.permissions=['upload'];grantSave();const f=new FormData();for(const [k,v] of Object.entries({grantId:'grant',propertyId:p.id,title:'Photo',category:'Factura',linkType:'Factura',linkRef:draft.id,note:'Test',deduplicate:'true'}))f.set(k,v);f.set('file',new File([new Uint8Array([137,80,78,71,13,10,26,10,7])],'receipt.png',{type:'image/png'}));response=await uploadPost(new Request(origin+'/api/documents',{method:'POST',headers:{Origin:origin},body:f}));assert.equal(response.status,201,await response.clone().text());const upload=await response.json() as any;assert.ok(upload.draft.invoice.detail.attachments.some((a:any)=>a.documentId===upload.id));assert.equal((await downloadGet(new Request(origin+'/api/documents/download?id='+upload.id+'&grantId=grant'))).status,200);
// Revocation closes reads, writes, and files, including direct API calls.
grant.status='Revocado';grantSave();assert.equal((await GET(new Request(origin+'/api/accounting?grantId=grant'))).status,403);assert.equal((await draftGet(new Request(origin+'/api/invoice-drafts?propertyId='+p.id+'&grantId=grant'))).status,403);assert.equal((await draftPost(dr(draft))).status,403);assert.equal((await downloadGet(new Request(origin+'/api/documents/download?id=doc&grantId=grant'))).status,403);
(globalThis as any).__testUid='owner-a';
await act('expense-policy',{separateDuties:true,approvalLimit:100,overBudgetLimit:0});
const own={...invoice,detail:{...invoice.detail!,requestId:'self-check',noOrderReason:'Compra directa'},number:'SELF-CHECK',duplicateReason:'Prueba controlada',lines:[{...invoice.lines[0],id:'self-line',purchase:undefined}]};await act('invoice',own);await act('approve',{id:book.invoices.at(-1)!.id},400);
const before=comparison([p],book,'2026-10-01T00:00:00Z'),after=structuredClone(before);after.generatedAt='2026-10-02T00:00:00Z';after.entries[0].current+=100;assert.equal(compareCuts(before,after)[0].changes.current,100);assert.equal(compareCuts(before,before).length,0);
console.log('HU-47/48 OK: recepción 6/factura 8, compromiso sin duplicar, revisiones, permisos opt-in, scope, carga independiente, revocación, revisión invalidada, CAS y separación de funciones.');

const pdf=await PDFDocument.create();pdf.addPage();pdf.addPage();files.set('doc',await pdf.save());await validateAttachmentPages('owner-a',{...invoice,detail:{...invoice.detail!,attachments:[{documentId:'doc',propertyId:p.id,pages:'1-2',kind:'Factura'}]}});await assert.rejects(()=>validateAttachmentPages('owner-a',{...invoice,detail:{...invoice.detail!,attachments:[{documentId:'doc',propertyId:p.id,pages:'3',kind:'Factura'}]}}),/no existe/);
grant.status='Activo';grant.expenses.permissions=['approve'];grant.expenses.maxAmount=100;grantSave();(globalThis as any).__testUid='member';assert.equal((await attempt('approve',{id:book.invoices.at(-1)!.id})).status,400);
console.log('PDF: rango real 1–2 aceptado, página 3 rechazada; umbral delegado bloquea aprobación.');

// Dedicated payment evidence may be attached after approval without rewriting the invoice.
grant.expenses.permissions=['upload','pay'];grantSave();const receipt=new FormData();for(const [k,v] of Object.entries({grantId:'grant',propertyId:p.id,title:'Paid receipt',category:'Factura',linkType:'Factura',linkRef:iid,note:'Payment',deduplicate:'true'}))receipt.set(k,v);receipt.set('file',new File([new Uint8Array(await pdf.save())],'payment.pdf',{type:'application/pdf'}));response=await uploadPost(new Request(origin+'/api/documents',{method:'POST',headers:{Origin:origin},body:receipt}));assert.equal(response.status,201,await response.clone().text());const evidence=await response.json() as any;assert.equal((await downloadGet(new Request(origin+'/api/documents/download?id='+evidence.id+'&grantId=grant'))).status,200);response=await attempt('movement',{kind:'Pago',propertyId:p.id,supplierId:'vendor',invoiceId:iid,lineId:'po-invoice-line',sourceId:'',amount:100,account:'Medio de prueba',reference:'SHARED-PAYMENT',documentId:evidence.id});assert.equal(response.status,201,await response.clone().text());projection=await (await GET(new Request(origin+'/api/accounting?grantId=grant'))).json() as any;assert.equal(projection.book.movements.at(-1).account,'');assert.equal(accountingSummary(projection.book,p.id,'2026-10-01').paid,100);
console.log('Pago delegado y recibo posterior a aprobación: persiste, concilia y oculta cuentas completas.');

// HU-51/52: use real routes, journal CAS and normalized invoice storage.
(globalThis as any).__testUid='owner-a';{const state=await readBook('owner-a');book=state.book;version=state.version;}
await act('expense-policy',{separateDuties:false,approvalLimit:100,overBudgetLimit:0});
await act('expense:policy',{propertyId:p.id,percent:5,amount:25});
const alerts=costAlerts(p,book,'2026-10-01');assert.equal(alerts.policy.amount,25);const alert=alerts.alerts[0];assert.ok(alert);
await act('expense:review',{propertyId:p.id,key:alert.key,signature:alert.signature,status:'Revisado',cause:'Precio',responsible:'Encargado',documentId:''},400);
await act('expense:review',{propertyId:p.id,key:alert.key,signature:alert.signature,status:'Revisado',cause:'Precio',responsible:'Encargado',documentId:'doc'});
assert.equal(costAlerts(p,book,'2026-10-01').alerts.find(a=>a.key===alert.key)?.review?.cause,'Precio');
await act('expense:review',{propertyId:p.id,key:alert.key,signature:'stale',status:'Resuelto',cause:'Sin determinar',responsible:'Encargado',documentId:''},400);
const templateInvoice=structuredClone(own);templateInvoice.lines[0].subtotal=100;templateInvoice.lines[0].detail={mode:'Cantidad',quantity:1,unit:'unidad',unitPrice:100,discount:0,charges:0};templateInvoice.lines[0].classification=undefined;templateInvoice.declaredTotal=100;
const template={id:'monthly-power',propertyId:p.id,name:'Servicio eléctrico',frequency:'Mensual',start:'2026-08-31',end:'2026-12-31',active:true,invoice:templateInvoice};
await act('expense:template',template);
const recurringRequest=(period:string)=>new Request(origin+'/api/expense-recurring',{method:'POST',headers:{Origin:origin},body:JSON.stringify({templateId:template.id,period})});
response=await recurringPost(recurringRequest('2026-09-30'));assert.equal(response.status,201,await response.clone().text());const generated=await response.json() as any;
assert.equal((await recurringPost(recurringRequest('2026-09-30'))).status,409);
assert.equal((await recurringPost(recurringRequest('2026-09-29'))).status,400);
assert.equal((await recurringPost(recurringRequest('2027-01-31'))).status,400);
const savedPeriod=JSON.parse(sql.prepare('SELECT payload FROM expense_drafts WHERE id=?').get(generated.id)!.payload as string);assert.equal(savedPeriod.invoice.declaredTotal,100);assert.equal(savedPeriod.invoice.detail.attachments.length,0);
await act('expense:template',{...template,invoice:{...templateInvoice,lines:[{...templateInvoice.lines[0],subtotal:200,detail:{...templateInvoice.lines[0].detail!,unitPrice:200}}]}});
assert.equal(JSON.parse(sql.prepare('SELECT payload FROM expense_drafts WHERE id=?').get(generated.id)!.payload as string).invoice.declaredTotal,100);
const altered={...savedPeriod,updatedAt:sql.prepare('SELECT updated_at FROM expense_drafts WHERE id=?').get(generated.id)!.updated_at,invoice:{...savedPeriod.invoice,detail:{...savedPeriod.invoice.detail,recurring:undefined}}};assert.equal((await draftPost(new Request(origin+'/api/invoice-drafts',{method:'POST',headers:{Origin:origin},body:JSON.stringify(altered)}))).status,400);
const reimb=structuredClone(templateInvoice);reimb.number='PERSONAL-100';reimb.lines[0].id='personal-line';reimb.detail={...reimb.detail!,requestId:'personal-100',reimbursement:{buyer:'Trabajador',beneficiary:'Trabajador',paidDate:'2026-10-01',paymentDocumentId:'doc'},attachments:[{documentId:'doc',propertyId:p.id,pages:'',kind:'Factura'},{documentId:'doc',propertyId:p.id,pages:'1',kind:'Recibo de pago'}]};
const actualBefore=accountingSummary(book,p.id,'2026-10-01').approved;await act('invoice',reimb);const personalId=book.invoices.at(-1)!.id;await act('approve',{id:personalId});assert.equal(accountingSummary(book,p.id,'2026-10-01').approved-actualBefore,100);
const pay={kind:'Pago',propertyId:p.id,supplierId:'vendor',invoiceId:personalId,lineId:'personal-line',sourceId:'',amount:100,account:'Cuenta obra',reference:'REIMBURSE-100',documentId:'doc'};await act('movement',pay);assert.equal(accountingSummary(book,p.id,'2026-10-01').approved-actualBefore,100);assert.equal(book.invoices.find(i=>i.id===personalId)?.detail?.reimbursement?.beneficiary,'Trabajador');await act('movement',pay,400);
console.log('HU-51/52 OK: alertas documentadas, stale bloqueado, fin de mes, período único, tarifa histórica, origen inmutable y reembolso de $100 sin duplicar costo.');

// Local storage ceiling: hydrate 2,000 normalized invoices without embedding them in journal JSON.
const baseState=await readBook('owner-a'),scaled=structuredClone(baseState.book);while(scaled.invoices.length<2000){const n=scaled.invoices.length,copy=structuredClone(scaled.invoices[0]);copy.id='volume-'+n;copy.detail={...copy.detail!,requestId:'volume-request-'+n};copy.lines=copy.lines.map((l,k)=>({...l,id:'volume-line-'+n+'-'+k}));scaled.invoices.push(copy);}const volumeVersion='2026-10-09T23:59:59.000Z',writes=await invoiceWrites('owner-a',baseState.book,scaled,volumeVersion);await (globalThis as any).__testDb.batch([prepare('UPDATE accounting_books SET payload=?,updated_at=? WHERE user_id=?').bind(JSON.stringify(storedBook(scaled)),volumeVersion,'owner-a'),...writes]);const hydrated=await readBook('owner-a');assert.equal(hydrated.book.invoices.length,2000);assert.equal(hydrated.book.invoices.at(-1)!.lines[0].id,scaled.invoices.at(-1)!.lines[0].id);assert.ok(JSON.stringify(storedBook(scaled)).length<900000);console.log('Volumen local: 2,000 facturas normalizadas conservan IDs y líneas; libro sin facturas incrustadas.');
