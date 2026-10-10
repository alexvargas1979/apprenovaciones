import {withoutRetiredImport} from './retired-import';
import {hydrateInvoices} from './expense-storage';
import {projectExecution} from './delivery';
import {rawDb} from '@/db';
import {emptyBook,executionFor,type Book} from './accounting';
import type {Property} from './model';
export async function readBook(uid:string){for(let attempt=0;attempt<3;attempt++){const row=await rawDb().prepare('SELECT payload,updated_at FROM accounting_books WHERE user_id=?').bind(uid).first<{payload:string;updated_at:string}>();if(!row)return {book:emptyBook(),version:''};const book=await hydrateInvoices(uid,JSON.parse(row.payload));const current=await rawDb().prepare('SELECT updated_at FROM accounting_books WHERE user_id=?').bind(uid).first<{updated_at:string}>();if(current?.updated_at===row.updated_at)return {book:book as Book,version:row.updated_at};}throw Error('La contabilidad cambió durante la lectura. Reintenta.');}
export const attachExecution=(p:Property,b:{book:Book;version:string}):Property=>({...withoutRetiredImport(p),execution:projectExecution(p,b.book,b.version)});
