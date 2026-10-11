import assert from 'node:assert/strict';
import {decodeWorkspace,type WorkspaceSnapshot} from './workspace';
import {emptyBook} from '../accounting';
const base:WorkspaceSnapshot={properties:[],book:null,invoices:[],lines:[],allocations:[],history:[],baselines:[],opening:[]};
assert.deepEqual(decodeWorkspace(base).book,emptyBook());
const old={...base,book:{payload:{...emptyBook(),invoices:[{id:'legacy',lines:[]} as any]},updated_at:'2026-10-11T00:00:00Z'}};
assert.equal(decodeWorkspace(old).book.invoices[0].id,'legacy');
const b=emptyBook();b.classification={categories:[],products:[],centers:[],history:[],invoiceHistory:[],budgets:[]};
const source:WorkspaceSnapshot={...base,properties:[{id:'p',payload:{id:'wrong',name:'Test'},updated_at:'2026-10-11T00:00:00Z'}],book:{payload:{...b,invoiceStorage:1},updated_at:'2026-10-11T00:00:00Z'},
 invoices:Array.from({length:1201},(_,i)=>({id:'i'+i,payload:{number:String(i),lines:[]}})),
 lines:[{id:'l',invoice_id:'i0',property_id:'p',payload:{id:'wrong',propertyId:'wrong',classification:{splits:[]}}}],
 allocations:[{line_id:'l',payload:{centerId:'kitchen',subtotal:10,tax:1}}],history:[{payload:{id:'h'}}],
 baselines:[{property_id:'p',captured_at:'2026-10-11T00:00:00Z'}],opening:[{property_id:'p',amount:.1},{property_id:'p',amount:.2}]};
const before=JSON.stringify(source),r=decodeWorkspace(source);
assert.equal(r.book.invoices.length,1201);assert.equal(r.book.invoices[0].lines[0].id,'l');assert.equal(r.book.invoices[0].lines[0].propertyId,'p');assert.equal(r.book.invoices[0].lines[0].classification?.splits[0].centerId,'kitchen');assert.equal(r.book.classification?.invoiceHistory[0].id,'h');assert.equal(r.preservation.p.openingTotal,.3);assert.equal(r.properties[0].id,'p');assert.equal(JSON.stringify(source),before);
console.log('HU60 decoder: empty/legacy/normalized books, 1201 invoices, authoritative IDs, splits, history, exact opening cents and immutable source: PASS');
