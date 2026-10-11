import {emptyBook,type Book,type InvoiceLine} from '../accounting';
import type {Property} from '../model';
import type {PreservationSummary} from '../preservation';

type PayloadRow={id:string;payload:Record<string,any>};
export type WorkspaceSnapshot={
 properties:(PayloadRow&{updated_at:string})[];
 book:{payload:Book&{invoiceStorage?:number};updated_at:string}|null;
 invoices:PayloadRow[];lines:(PayloadRow&{invoice_id:string;property_id:string})[];
 allocations:{line_id:string;payload:any}[];history:{payload:any}[];
 baselines:{property_id:string;captured_at:string}[];opening:{property_id:string;amount:number}[];
};
/** Decode one MVCC snapshot. Never mix separate paginated REST reads. */
export function decodeWorkspace(source:WorkspaceSnapshot){
 const s=structuredClone(source),book:Book&{invoiceStorage?:number}=s.book?.payload??emptyBook();
 if(book.invoiceStorage===1){
  const splits=new Map<string,any[]>(),lines=new Map<string,any[]>();
  for(const a of s.allocations)splits.set(a.line_id,[...(splits.get(a.line_id)??[]),a.payload]);
  for(const r of s.lines){const l={...r.payload,id:r.id,propertyId:r.property_id} as InvoiceLine;if(l.classification)l.classification={...l.classification,splits:splits.get(r.id)??[]};lines.set(r.invoice_id,[...(lines.get(r.invoice_id)??[]),l]);}
  book.invoices=s.invoices.map(r=>({...r.payload,id:r.id,lines:lines.get(r.id)??[]})) as Book['invoices'];
  if(book.classification)book.classification.invoiceHistory=s.history.map(h=>h.payload);
  delete book.invoiceStorage;
 }
 const properties=s.properties.map(r=>({...r.payload,id:r.id,updatedAt:r.updated_at}) as Property);
 const ids=new Set(properties.map(p=>p.id)),preservation:Record<string,PreservationSummary>={};
 for(const b of s.baselines){if(!ids.has(b.property_id))continue;const balances=s.opening.filter(o=>o.property_id===b.property_id);preservation[b.property_id]={capturedAt:b.captured_at,balanceCount:balances.length,openingTotal:balances.reduce((sum,o)=>sum+Math.round(Number(o.amount)*100),0)/100};}
 return {properties,book:book as Book,version:s.book?.updated_at??'',preservation};
}
