import {rawDb} from '@/db';
import type {Book} from './accounting';
export function storedBook(b:Book){return {...b,invoices:[],...(b.classification?{classification:{...b.classification,invoiceHistory:[]}}:{}),invoiceStorage:1};}
export async function hydrateInvoices(uid:string,b:Book&{invoiceStorage?:number}){if(b.invoiceStorage!==1)return b;const db=rawDb();const [invoices,lines,allocations,history]=await Promise.all([
 db.prepare('SELECT id,payload FROM expense_invoices WHERE user_id=? ORDER BY position').bind(uid).all<{id:string;payload:string}>(),
 db.prepare('SELECT id,invoice_id,payload FROM expense_lines WHERE user_id=? ORDER BY position').bind(uid).all<{id:string;invoice_id:string;payload:string}>(),
 db.prepare('SELECT line_id,payload FROM expense_allocations WHERE user_id=? ORDER BY position').bind(uid).all<{line_id:string;payload:string}>(),
 db.prepare('SELECT payload FROM expense_classification_history WHERE user_id=? ORDER BY position').bind(uid).all<{payload:string}>()]);
 const splits=new Map<string,any[]>();for(const r of allocations.results){if(!splits.has(r.line_id))splits.set(r.line_id,[]);splits.get(r.line_id)!.push(JSON.parse(r.payload));}
 const byInvoice=new Map<string,any[]>();for(const r of lines.results){const l=JSON.parse(r.payload);if(l.classification)l.classification.splits=splits.get(r.id)??[];if(!byInvoice.has(r.invoice_id))byInvoice.set(r.invoice_id,[]);byInvoice.get(r.invoice_id)!.push(l);}
 b.invoices=invoices.results.map(r=>({...JSON.parse(r.payload),lines:byInvoice.get(r.id)??[]}));if(b.classification)b.classification.invoiceHistory=history.results.map(r=>JSON.parse(r.payload));delete b.invoiceStorage;return b;
}
// Statements share the journal CAS transaction. A losing writer changes no child record.
export async function invoiceWrites(uid:string,before:Book,after:Book,at:string){const db=rawDb(),row=await db.prepare('SELECT payload,updated_at FROM accounting_books WHERE user_id=?').bind(uid).first<{payload:string;updated_at:string}>(),migrate=!!row&&!JSON.parse(row.payload).invoiceStorage;
 const changed=after.invoices.filter(i=>migrate||JSON.stringify(i)!==JSON.stringify(before.invoices.find(x=>x.id===i.id)));
 const guard='EXISTS(SELECT 1 FROM accounting_books WHERE user_id=? AND updated_at=?)';const statements:any[]=[];
 if(migrate)statements.push(db.prepare('INSERT INTO expense_legacy_backup(user_id,payload,version,created_at) SELECT ?,?,?,? WHERE '+guard+' ON CONFLICT(user_id) DO NOTHING').bind(uid,row!.payload,row!.updated_at,at,uid,at));
 if(changed.length){const ids=JSON.stringify(changed.map(i=>i.id));
 statements.push(db.prepare('DELETE FROM expense_allocations WHERE user_id=? AND line_id IN(SELECT id FROM expense_lines WHERE user_id=? AND invoice_id IN(SELECT value FROM json_each(?))) AND '+guard).bind(uid,uid,ids,uid,at));
 statements.push(db.prepare('DELETE FROM expense_lines WHERE user_id=? AND invoice_id IN(SELECT value FROM json_each(?)) AND '+guard).bind(uid,ids,uid,at));
 const headers=changed.map(i=>{const head={...i,lines:[]};return {id:i.id,position:after.invoices.findIndex(x=>x.id===i.id),requestId:i.detail?.requestId||null,payload:JSON.stringify(head)};}),lines=changed.flatMap(i=>i.lines.map((l,position)=>({id:l.id,invoiceId:i.id,propertyId:l.propertyId,position,payload:JSON.stringify({...l,...(l.classification?{classification:{...l.classification,splits:[]}}:{})})}))),allocations=changed.flatMap(i=>i.lines.flatMap(l=>(l.classification?.splits??[]).map((s,position)=>({lineId:l.id,position,payload:JSON.stringify(s)}))));
 statements.push(db.prepare("INSERT INTO expense_invoices(user_id,id,position,request_id,payload) SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.position'),json_extract(value,'$.requestId'),json_extract(value,'$.payload') FROM json_each(?) WHERE "+guard+" ON CONFLICT(user_id,id) DO UPDATE SET payload=excluded.payload,position=excluded.position,request_id=excluded.request_id").bind(uid,JSON.stringify(headers),uid,at));
 statements.push(db.prepare("INSERT INTO expense_lines(user_id,id,invoice_id,property_id,position,payload) SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.invoiceId'),json_extract(value,'$.propertyId'),json_extract(value,'$.position'),json_extract(value,'$.payload') FROM json_each(?) WHERE "+guard).bind(uid,JSON.stringify(lines),uid,at));
 statements.push(db.prepare("INSERT INTO expense_allocations(user_id,line_id,position,payload) SELECT ?,json_extract(value,'$.lineId'),json_extract(value,'$.position'),json_extract(value,'$.payload') FROM json_each(?) WHERE "+guard).bind(uid,JSON.stringify(allocations),uid,at));}
 const history=(after.classification?.invoiceHistory??[]).map((h,position)=>({id:h.id,position,payload:JSON.stringify(h)})).filter(h=>migrate||!before.classification?.invoiceHistory.some(x=>x.id===h.id));
 if(history.length)statements.push(db.prepare("INSERT INTO expense_classification_history(user_id,id,position,payload) SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.position'),json_extract(value,'$.payload') FROM json_each(?) WHERE "+guard+" ON CONFLICT(user_id,id) DO NOTHING").bind(uid,JSON.stringify(history),uid,at));return statements;
}
