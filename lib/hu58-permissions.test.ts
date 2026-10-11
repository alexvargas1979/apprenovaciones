import assert from 'node:assert/strict';
import {teamProperty,teamRoles,type TeamGrant} from './team';
import {scopeInvoice,permit,expensePermissions,type ExpenseContext} from './expense-access';
import {emptyBook,type Book} from './accounting';
import {fresh} from './model';
const p=fresh(),book=emptyBook();p.name='Synthetic';p.values['5']='Synthetic address';
const grant:TeamGrant={name:'Synthetic',email:'test@example.invalid',role:'Contratista',propertyIds:[p.id],taskIds:['assigned'],status:'Activo',expires:''};
book.delivery={[p.id]:{tasks:[{id:'assigned',name:'Allowed',note:'PRIVATE'},{id:'hidden',name:'Hidden'}]} as any};
let checks=0;
for(const role of teamRoles){
 const view=teamProperty(p,book,{...grant,role});
 assert.equal(view.role,role);assert(!JSON.stringify(view).includes('PRIVATE'));
 if(role==='Contratista'){assert('tasks' in view);assert.deepEqual(view.tasks.map(t=>t.id),['assigned']);assert(!('budget' in view));}
 if(role==='Responsable de obra'){assert('tasks' in view);assert.equal(view.tasks.length,2);assert('budget' in view);assert(!('analysis' in view));}
 if(role==='Analista'){assert('analysis' in view);assert('budget' in view);assert(!('tasks' in view));}
 if(role==='Administración'){assert('invoices' in view);assert(!('analysis' in view));}
 checks++;
}
for(const status of ['Invitación','Por aprobar','Revocado'] as const){assert.throws(()=>teamProperty(p,book,{...grant,status}));checks++;}
assert.throws(()=>teamProperty(p,book,{...grant,role:'Unknown' as any}));checks++;
const invoice={id:'i',lines:[{id:'l',propertyId:p.id,subtotal:10,tax:0,sourceLineId:'',classification:{splits:[{centerId:'kitchen',subtotal:10,tax:0}]}}]} as unknown as Book['invoices'][number];
book.invoices=[invoice];
const ctx:ExpenseContext={owner:'a',actor:'m',grantId:'g',version:'1',grant,access:{permissions:['draft'],allCenters:false,centerIds:['kitchen'],maxAmount:10}};
assert(scopeInvoice(book,invoice,ctx));checks++;
for(const permission of expensePermissions){const c={...ctx,access:{...ctx.access,permissions:[permission]}};permit(c,permission);for(const denied of expensePermissions.filter(p=>p!==permission))assert.throws(()=>permit(c,denied));checks++;}
for(const status of ['Invitación','Por aprobar','Revocado'] as const){assert(!scopeInvoice(book,invoice,{...ctx,grant:{...grant,status}}));checks++;}
assert(!scopeInvoice(book,invoice,{...ctx,access:{...ctx.access,permissions:[]}}));checks++;
invoice.lines[0].classification!.splits=[];assert(!scopeInvoice(book,invoice,ctx));checks++;
invoice.lines[0].sourceLineId='missing';assert(!scopeInvoice(book,invoice,ctx));checks++;
invoice.lines[0].sourceLineId='l';assert(!scopeInvoice(book,invoice,ctx));checks++;
invoice.lines[0].sourceLineId='';invoice.lines[0].classification!.splits=[{centerId:'patio',name:'Patio',subtotal:10,tax:0}];assert(!scopeInvoice(book,invoice,ctx));checks++;
assert(scopeInvoice(book,invoice,{...ctx,access:{...ctx.access,allCenters:true}}));checks++;
assert(!scopeInvoice(book,invoice,{...ctx,grant:{...grant,propertyIds:[]},access:{...ctx.access,allCenters:true}}));checks++;
console.log(JSON.stringify({checks,postgres_integration:false}));
