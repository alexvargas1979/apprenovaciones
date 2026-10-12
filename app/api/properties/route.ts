import {saveProperty} from '@/lib/postgres/property-server';
import {authConfig} from '@/lib/auth/config';
import {readPostgresWorkspace} from '@/lib/postgres/read-server';
import {storedBook} from '@/lib/expense-storage';
import {withoutRetiredImport} from '@/lib/retired-import';
import {deletionBlock,removePropertyMetadata,referencesProperty,cleanupDeletedFiles} from '@/lib/property-deletion';
import {auditWrite,auditProperty} from '@/lib/audit';
import {guardLifecycle} from '@/lib/lifecycle-actions';
import {guardDeliveryProperty} from '@/lib/delivery-actions';
import {readBook,attachExecution} from '@/lib/accounting-server';
import { rawDb } from "@/db";
import { user,fail } from "@/lib/server";
import { validateProperty } from "@/lib/model";
import {preserveProperties,preservationSummary} from '@/lib/preservation';
import {prepareExpediente,duplicates} from '@/lib/expediente';

export async function GET(){try{if(authConfig().provider==='supabase'){const data=await readPostgresWorkspace();return Response.json({properties:data.properties.map(p=>attachExecution(p,data)),preservation:data.preservation,readOnly:true},{headers:{'Cache-Control':'no-store'}});}const uid=await user();const db=rawDb();await cleanupDeletedFiles(uid);
  const result=await db.prepare("SELECT payload,updated_at FROM properties WHERE user_id=? ORDER BY updated_at DESC").bind(uid).all<{payload:string;updated_at:string}>();
  const book=await readBook(uid);
  return Response.json({properties:result.results.map(r=>attachExecution({...withoutRetiredImport(JSON.parse(r.payload)),updatedAt:r.updated_at},book)),
    preservation:await preservationSummary(db,uid)},{headers:{"Cache-Control":"no-store"}});
}catch(e){return fail(e);}}

export async function PUT(req:Request){if(authConfig().provider==='supabase')return saveProperty(req);try{
  const uid=await user(req);const text=await req.text();if(text.length>150000)throw Error("Propiedad demasiado grande");
  const parsed=JSON.parse(text),reason=typeof parsed.editReason==='string'?parsed.editReason.trim():'';delete parsed.editReason;const input=validateProperty(withoutRetiredImport(parsed));const db=rawDb();if(await db.prepare('SELECT id FROM property_deletions WHERE id=?').bind(input.id).first())return Response.json({error:'Esta propiedad fue eliminada. Crea un expediente nuevo.'},{status:409});
  const previous=await db.prepare('SELECT payload,updated_at FROM properties WHERE id=? AND user_id=?').bind(input.id,uid).first<{payload:string;updated_at:string}>();
  if((previous?.updated_at??null)!==(input.updatedAt??null))return Response.json({error:'Esta propiedad cambió en otra ventana. Vuelve a abrirla antes de guardar.'},{status:409});
  const at=new Date(Math.max(Date.now(),previous?Date.parse(previous.updated_at)+1:0)).toISOString();
  const p=validateProperty(prepareExpediente(input,previous?{...withoutRetiredImport(JSON.parse(previous.payload)),updatedAt:previous.updated_at}:null,uid,at));
  const financialChanged=previous&&JSON.stringify(auditProperty(JSON.parse(previous.payload)))!==JSON.stringify(auditProperty(p));if(financialChanged&&(p.operations?.budget||await db.prepare('SELECT property_id FROM analysis_baselines WHERE property_id=? AND user_id=?').bind(p.id,uid).first())&&(!reason||reason.length>1000))throw Error('Indica el motivo del cambio: el expediente tiene una aprobación.');
  const book=await readBook(uid),projected=attachExecution(p,book);
  guardDeliveryProperty(p,book.book);guardLifecycle(p,book.book);for(const [id,v] of Object.entries(projected.execution!.included))if((p.lines[id]?.actual??0)<v)throw Error('El saldo manual no puede ser menor que los comprobantes conciliados.');
  // Preserve any existing legacy row before its first edit, including older clients.
  await preserveProperties(db,uid,p.id);
  const write=p.updatedAt?db.prepare("UPDATE properties SET payload=?,updated_at=? WHERE id=? AND user_id=? AND updated_at=? AND COALESCE((SELECT updated_at FROM accounting_books WHERE user_id=?),'')=?")
    .bind(JSON.stringify(p),at,p.id,uid,p.updatedAt,uid,book.version):db.prepare("INSERT INTO properties(id,user_id,payload,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING")
    .bind(p.id,uid,JSON.stringify(p),at);
  const [result]=await db.batch([write,db.prepare(`INSERT INTO investment_projects(property_id,user_id,schema_version,origin,created_at)
    SELECT id,user_id,1,'new',? FROM properties WHERE id=? AND user_id=? AND updated_at=?
    ON CONFLICT(property_id) DO NOTHING`).bind(at,p.id,uid,at),auditWrite(uid,p.id,'property',at,reason||input.workflowEdit?.reason||'Edición de expediente',previous?auditProperty(JSON.parse(previous.payload)):null,auditProperty(p),'EXISTS(SELECT 1 FROM properties WHERE id=? AND user_id=? AND updated_at=?)',[p.id,uid,at])]);
  if(!result.meta.changes)return Response.json({error:"Esta propiedad cambió en otra ventana. Vuelve a abrirla antes de guardar."},{status:409});
  const others=await db.prepare('SELECT payload FROM properties WHERE user_id=? AND id<>?').bind(uid,p.id).all<{payload:string}>();
  return Response.json({updatedAt:at,property:attachExecution({...p,updatedAt:at},book),duplicates:duplicates(p,others.results.map(r=>JSON.parse(r.payload))).map(x=>({id:x.id,name:x.name}))});
}catch(e){return fail(e);}}

export async function DELETE(req:Request){try{
 const uid=await user(req),raw=await req.text();if(raw.length>2000)throw Error('Solicitud demasiado grande.');const input=JSON.parse(raw),db=rawDb();if(typeof input.id!=='string'||typeof input.updatedAt!=='string'||typeof input.confirmName!=='string')throw Error('Confirma la propiedad que deseas eliminar.');
 const row=await db.prepare('SELECT payload,updated_at FROM properties WHERE id=? AND user_id=?').bind(input.id,uid).first<{payload:string;updated_at:string}>();if(!row)return Response.json({error:'Propiedad no encontrada.'},{status:404});const p=JSON.parse(row.payload);if(input.confirmName!==p.name)throw Error('Escribe exactamente el nombre de la propiedad para confirmar.');if(input.updatedAt!==row.updated_at)return Response.json({error:'La propiedad cambió. Actualiza antes de eliminar.'},{status:409});
 const old=await readBook(uid),blocked=deletionBlock(p,old.book);if(blocked)return Response.json({error:blocked+' Archívala desde Expediente para conservar su contabilidad.',canArchive:true},{status:409});
 const docs=await db.prepare('SELECT id FROM property_documents WHERE property_id=? AND user_id=?').bind(p.id,uid).all<{id:string}>();const docIds=docs.results.map(d=>d.id);const includesDoc=(v:unknown):boolean=>Array.isArray(v)?v.some(includesDoc):v&&typeof v==='object'?Object.values(v).some(includesDoc):typeof v==='string'&&docIds.includes(v);if(includesDoc(old.book.invoices)||includesDoc(old.book.oversight))return Response.json({error:'Hay comprobantes utilizados en otros registros contables. Archiva la propiedad.'},{status:409});
 const drafts=await db.prepare('SELECT id,updated_at,property_id,payload FROM expense_drafts WHERE user_id=?').bind(uid).all<{id:string;updated_at:string;property_id:string;payload:string}>();if(drafts.results.some(d=>{const v=JSON.parse(d.payload);return d.property_id!==p.id&&(referencesProperty(v,p.id)||includesDoc(v))||d.property_id===p.id&&v.invoice?.lines?.some((l:any)=>l.propertyId!==p.id);}))return Response.json({error:'Un borrador distribuye gastos o documentos entre propiedades. Revisa esa distribución antes de eliminar.'},{status:409});
 const at=new Date(Math.max(Date.now(),Date.parse(old.version||'1970-01-01')+1)).toISOString(),token=crypto.randomUUID(),guard='EXISTS(SELECT 1 FROM property_deletions WHERE id=? AND user_id=? AND version=?)',args=[p.id,uid,token];
 const rawBook=await db.prepare('SELECT payload FROM accounting_books WHERE user_id=?').bind(uid).first<{payload:string}>(),next=removePropertyMetadata(old.book,p.id),payload=JSON.stringify(rawBook&&JSON.parse(rawBook.payload).invoiceStorage===1?storedBook(next):next);
 const first=db.prepare("INSERT INTO property_deletions(id,user_id,name,version,deleted_at,object_keys) SELECT id,user_id,json_extract(payload,'$.name'),?,?,(SELECT json_group_array(object_key) FROM property_documents WHERE property_id=? AND user_id=?) FROM properties WHERE id=? AND user_id=? AND updated_at=? AND COALESCE((SELECT updated_at FROM accounting_books WHERE user_id=?),'')=? AND NOT EXISTS(SELECT 1 FROM expense_drafts d WHERE d.user_id=? AND NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE json_extract(j.value,'$.id')=d.id AND json_extract(j.value,'$.updated_at')=d.updated_at)) ON CONFLICT(id) DO NOTHING").bind(token,at,p.id,uid,p.id,uid,input.updatedAt,uid,old.version,uid,JSON.stringify(drafts.results.map(d=>({id:d.id,updated_at:d.updated_at}))));
 const statements=[first];if(old.version)statements.push(db.prepare('UPDATE accounting_books SET payload=?,updated_at=? WHERE user_id=? AND updated_at=? AND '+guard).bind(payload,at,uid,old.version,...args));
 for(const table of ['team_contributions','expense_drafts','expense_reports','workbook_imports','analysis_baselines','analysis_scenarios','investment_projects','property_documents'])statements.push(db.prepare(`DELETE FROM ${table} WHERE property_id=? AND ${table==='team_contributions'?'owner_id':'user_id'}=? AND `+guard).bind(p.id,uid,...args));
 statements.push(db.prepare('DELETE FROM opening_balances WHERE property_id=? AND '+guard).bind(p.id,...args),db.prepare('DELETE FROM property_baselines WHERE property_id=? AND user_id=? AND '+guard).bind(p.id,uid,...args));
 // Drop only this property's grants, preserving every other property scope.
 statements.push(db.prepare("UPDATE team_members SET payload=json_set(payload,'$.propertyIds',json(COALESCE((SELECT json_group_array(value) FROM json_each(team_members.payload,'$.propertyIds') WHERE value<>?),'[]'))),updated_at=? WHERE owner_id=? AND "+guard).bind(p.id,at,uid,...args));
 statements.push(db.prepare('DELETE FROM properties WHERE id=? AND user_id=? AND updated_at=? AND '+guard).bind(p.id,uid,input.updatedAt,...args),auditWrite(uid,p.id,'property:delete',at,'Eliminación confirmada por nombre',{id:p.id,name:p.name},{deleted:true},guard,args));
 const result=await db.batch(statements);if(!result[0].meta.changes)return Response.json({error:'Cambió la propiedad o la contabilidad. Actualiza antes de eliminar.'},{status:409});const cleanupPending=await cleanupDeletedFiles(uid);return Response.json({deleted:true,id:p.id,cleanupPending:cleanupPending>0,message:cleanupPending?'Propiedad eliminada. La limpieza de archivos se reintentará al actualizar la lista.':'Propiedad y archivos eliminados.'});
}catch(e){return fail(e);}}
