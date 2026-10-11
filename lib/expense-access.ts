import type {Book,Invoice,InvoiceLine} from './accounting';import {invoiceTotal,emptyBook} from './accounting';import {classificationBook,lineClassification} from './classification';import type {TeamGrant} from './team';import type {Property} from './model';import type {Audit} from './operations';
export const expensePermissions=['upload','draft','classify','review','approve','pay'] as const;
export const expensePermissionLabels={upload:'Cargar comprobantes',draft:'Crear y editar borradores',classify:'Clasificar gastos',review:'Revisar y devolver',approve:'Aprobar facturas',pay:'Registrar pagos realizados'};
export type ExpenseGrant={permissions:typeof expensePermissions[number][];centerIds:string[];allCenters:boolean;maxAmount:number};
export type ExpensePolicy={separateDuties:boolean;approvalLimit:number;overBudgetLimit:number};
export const defaultExpensePolicy:ExpensePolicy={separateDuties:false,approvalLimit:0,overBudgetLimit:0};
export type ExpenseContext={owner:string;actor:string;grantId:string;version:string;grant:TeamGrant;access:ExpenseGrant};
export function validateExpenseGrant(x:ExpenseGrant,g:TeamGrant,b:Book){if(!x||!Array.isArray(x.permissions)||new Set(x.permissions).size!==x.permissions.length||!x.permissions.every(p=>expensePermissions.includes(p))||typeof x.allCenters!=='boolean'||!Array.isArray(x.centerIds)||x.centerIds.length>300||!x.centerIds.every(id=>classificationBook(b).centers.some(c=>c.id===id&&g.propertyIds.includes(c.propertyId)))||!Number.isFinite(x.maxAmount)||x.maxAmount<0||x.maxAmount>1e9)throw Error('Revisa permisos de gastos, centros y límite de importe.');if(!x.allCenters&&!x.centerIds.length&&x.permissions.length)throw Error('Selecciona centros o autoriza todos explícitamente.');}
// Resolve credit ancestry before inspecting centers; empty/malformed splits never
// mean universal permission. Match the fail-closed PostgreSQL read boundary.
export function scopeInvoice(b:Book,i:Invoice,c:ExpenseContext){
 if(c.grant.status!=='Activo'||!c.access.permissions.some(p=>expensePermissions.includes(p)))return false;
 return i.lines.length>0&&i.lines.every(l=>{
  if(!c.grant.propertyIds.includes(l.propertyId))return false;
  if(c.access.allCenters===true)return true;
  const seen=new Set<string>();let source=l;
  while(source.sourceLineId){
   if(seen.has(source.id)||seen.size>=40)return false;
   seen.add(source.id);const parent=b.invoices.flatMap(invoice=>invoice.lines).find(line=>line.id===source.sourceLineId);
   if(!parent)return false;source=parent;
  }
  const splits=lineClassification(b,source).splits;
  return Array.isArray(splits)&&splits.length>0&&splits.every(s=>typeof s?.centerId==='string'&&c.access.centerIds.includes(s.centerId));
 });
}
export function permit(c:ExpenseContext,permission:typeof expensePermissions[number]){if(!c.access.permissions.includes(permission))throw Error('FORBIDDEN');}
export function expenseProjection(b:Book,c:ExpenseContext):Book {const cb=classificationBook(b),view=emptyBook();view.suppliers=b.suppliers.map(s=>({...s,contact:'',phone:'',email:'',address:'',note:''}));view.invoices=b.invoices.filter(i=>scopeInvoice(b,i,c));view.classification={...cb,centers:cb.centers.filter(x=>c.grant.propertyIds.includes(x.propertyId)&&(c.access.allCenters||c.access.centerIds.includes(x.id))),history:[],invoiceHistory:cb.invoiceHistory.filter(h=>view.invoices.some(i=>i.id===h.invoiceId)),budgets:[]};const ids=new Set(view.invoices.map(i=>i.id));const moves=b.movements.filter(m=>ids.has(m.invoiceId));view.movements=b.movements.filter(m=>ids.has(m.invoiceId)||m.kind==='Reverso'&&moves.some(x=>x.id===m.sourceId)).map(m=>({...m,account:'',reference:'',documentId:'',reason:''}));view.releases=b.releases.filter(r=>ids.has(r.invoiceId));view.procurement={orders:[],receipts:[]};return view;}
export function safeExpenseProperty(p:Property):Property{return {id:p.id,name:p.name,county:p.county,values:{},lines:{},updatedAt:p.updatedAt} as Property;}
export function approvalGate(b:Book,i:Book['invoices'][number],actor:string,context:ExpenseContext|null,properties:Property[]){const policy=b.expensePolicy??defaultExpensePolicy;if(policy.separateDuties&&i.actor===actor)throw Error('La separación de funciones impide aprobar una factura propia.');if(context){permit(context,'approve');if(!scopeInvoice(b,i,context))throw Error('FORBIDDEN');const limits=[context.access.maxAmount,policy.approvalLimit];if(limits.some(limit=>invoiceTotal(i)>limit))throw Error('El importe requiere aprobación del propietario.');for(const p of properties.filter(p=>i.lines.some(l=>l.propertyId===p.id))){const base=p.operations?.budget;if(!base)throw Error('Sin presupuesto aprobado: requiere al propietario.');const budget=base.base.total+base.orders.reduce((s,o)=>s+o.amount,0);const incurred=b.invoices.filter(x=>!x.void&&x.approval).reduce((s,x)=>s+x.lines.filter(l=>l.propertyId===p.id).reduce((n,l)=>n+(l.subtotal+l.tax)*(x.creditFor?-1:1),0),0);const incoming=i.lines.filter(l=>l.propertyId===p.id).reduce((s,l)=>s+l.subtotal+l.tax,0);if(incurred+incoming>budget+policy.overBudgetLimit)throw Error('El sobrecosto requiere aprobación del propietario.');}}}
export type DraftReview={createdBy:string;history:(Audit&{status:string})[];review?:Audit};
