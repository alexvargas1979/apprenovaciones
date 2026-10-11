import type {Property} from './model';
import {catalog,lineTotal,n} from './model';
import type {Book} from './accounting';
import {invoiceRows} from './accounting';
import {delivery} from './delivery';
import {budgetTotals} from './operations';
import {calculateFlip} from './investment';
export const teamRoles=['Analista','Responsable de obra','Administración','Contratista'] as const;
export type TeamGrant={expenses?:import("./expense-access").ExpenseGrant;name:string;email:string;role:typeof teamRoles[number];propertyIds:string[];taskIds:string[];status:'Invitación'|'Por aprobar'|'Activo'|'Revocado';expires:string;claimName?:string;claimEmail?:string};
export function validateGrant(g:TeamGrant,ps:Property[],book:Book){if(!g||!teamRoles.includes(g.role)||typeof g.name!=='string'||!g.name.trim()||g.name.length>150||typeof g.email!=='string'||g.email.length>200||!/^\S+@\S+\.\S+$/.test(g.email)||!Array.isArray(g.propertyIds)||!g.propertyIds.length||g.propertyIds.length>100||new Set(g.propertyIds).size!==g.propertyIds.length||!g.propertyIds.every(id=>ps.some(p=>p.id===id))||!Array.isArray(g.taskIds)||g.taskIds.length>300||!g.taskIds.every(id=>g.propertyIds.some(pid=>delivery(book,pid).tasks.some(t=>t.id===id))))throw Error('Revisa destinatario, rol, propiedades y tareas autorizadas.');if(g.role==='Contratista'&&!g.taskIds.length)throw Error('Asigna al menos una tarea al contratista.');}
// Explicit projections: never pass the owner property, book, document links or credit evaluation to members.
export function teamProperty(p:Property,book:Book,g:TeamGrant){if(!teamRoles.includes(g.role)||g.status!=='Activo'||!g.propertyIds.includes(p.id))throw Error('Acceso no autorizado.');const base={id:p.id,name:p.name,address:String(p.values['5']??''),county:p.county,role:g.role};
 const tasks=delivery(book,p.id).tasks.filter(t=>g.role!=='Contratista'||g.taskIds.includes(t.id)).map(t=>({id:t.id,name:t.name,kind:t.kind,start:t.start,end:t.end,actualStart:t.actualStart,actualEnd:t.actualEnd,progress:t.progress}));
 if(g.role==='Contratista')return {...base,tasks};
 const budget={mode:p.rehab?.mode??'Detallada',approved:budgetTotals(p),lines:catalog.map(c=>({name:c.item,...lineTotal(p,c)})).filter(x=>x.active)};
 if(g.role==='Responsable de obra')return {...base,tasks,budget};
 if(g.role==='Administración')return {...base,invoices:invoiceRows(book).filter(r=>r.line.propertyId===p.id&&r.invoice.approval).map(r=>({number:r.invoice.number,date:r.invoice.date,due:r.invoice.due,description:r.line.description,net:r.net,paid:r.paid,balance:r.balance}))};
 const a=p.investment,r=a?calculateFlip(p,a):null;
 return {...base,sqft:n(p,'8'),bedrooms:n(p,'9'),budget,analysis:a&&r?{purchase:r.purchase,arv:r.arv,purchaseDate:a.purchaseDate,saleDate:r.saleDate,rehab:r.rehab,totalCost:r.totalCost,profit:r.profit,margin:r.margin}:null,comparables:p.marketAnalysis?.comparables.filter(c=>c.selected).map(c=>({address:c.address,kind:c.kind,status:c.status,amount:c.amount,sqft:c.sqft,eventDate:c.eventDate,source:c.source}))??[]};
}
export async function tokenHash(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
