import {sharedUpload} from '@/lib/expense-upload';
import {expenseContext,accessGuard} from '@/lib/expense-access-server';
import {permit,scopeInvoice} from '@/lib/expense-access';
import {readBook} from '@/lib/accounting-server';
import {rawDb} from '@/db';
import {user,fail} from '@/lib/server';
import {fileBucket} from '@/lib/files';
import {uploadForm,validateFile,documentCategories,documentLinks,MAX_DOCUMENT_VERSIONS} from '@/lib/documents';
const columns='id,group_id AS groupId,property_id AS propertyId,version,filename,mime,size,sha256,title,category,link_type AS linkType,link_ref AS linkRef,note,created_at AS createdAt';
export async function GET(req:Request){try{const uid=await user(),propertyId=new URL(req.url).searchParams.get('propertyId');const db=rawDb();
 if(!propertyId||!await db.prepare('SELECT id FROM properties WHERE id=? AND user_id=?').bind(propertyId,uid).first())return Response.json({error:'Propiedad no encontrada.'},{status:404});
 const rows=await db.prepare(`SELECT ${columns} FROM property_documents WHERE property_id=? AND user_id=? ORDER BY created_at DESC,version DESC`).bind(propertyId,uid).all();
 return Response.json({documents:rows.results},{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e);}}
export async function POST(req:Request){try{const actor=await user(req),db=rawDb(),form=await uploadForm(req),ctx=await expenseContext(actor,form.get('grantId')),uid=ctx?.owner??actor;if(ctx)permit(ctx,'upload');
 const get=(key:string,max=200)=>{const v=form.get(key);if(typeof v!=='string'||v.length>max)throw Error('Revise '+key);return v.trim();};
 const propertyId=get('propertyId',80);if(!await db.prepare('SELECT id FROM properties WHERE id=? AND user_id=?').bind(propertyId,uid).first())return Response.json({error:'Propiedad no encontrada.'},{status:404});
 const title=get('title'),category=get('category'),linkType=get('linkType'),linkRef=get('linkRef'),note=get('note',1000);
 if(!title||!documentCategories.includes(category)||!documentLinks.includes(linkType)||(linkType!=='Expediente'&&!linkRef))throw Error('Indica título, categoría y referencia del documento.');
 if(ctx&&(!ctx.grant.propertyIds.includes(propertyId)||category!=='Factura'||linkType!=='Factura'||form.get('groupId')))throw Error('FORBIDDEN');
 const file=form.get('file');if(!(file instanceof File))throw Error('Selecciona un archivo.');
 const bytes=new Uint8Array(await file.arrayBuffer()),format=validateFile(file.name,bytes);if(ctx)return sharedUpload(ctx,propertyId,linkRef,format.filename,format.mime,bytes);
 const groupInput=form.get('groupId');let groupId=crypto.randomUUID() as string,version=1;
 if(groupInput){if(typeof groupInput!=='string'||groupInput.length>80)throw Error('Documento inválido.');
  const existing=await db.prepare('SELECT version FROM property_documents WHERE group_id=? AND property_id=? AND user_id=? ORDER BY version DESC LIMIT 1').bind(groupInput,propertyId,uid).first<{version:number}>();
  if(!existing)return Response.json({error:'Documento no encontrado.'},{status:404});
  if(Number(form.get('expectedVersion'))!==existing.version)return Response.json({error:'Hay una nueva versión. Actualiza los documentos antes de cargar.'},{status:409});groupId=groupInput;version=existing.version+1;
 }
 const count=await db.prepare('SELECT COUNT(*) AS n FROM property_documents WHERE property_id=? AND user_id=?').bind(propertyId,uid).first<{n:number}>();if(count!.n>=MAX_DOCUMENT_VERSIONS)throw Error('Límite de '+MAX_DOCUMENT_VERSIONS+' archivos/versiones por expediente alcanzado.');
 const id=crypto.randomUUID(),objectKey='documents/'+uid+'/'+propertyId+'/'+id,at=new Date().toISOString();
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 const deduplicate=form.get('deduplicate')==='true';if(deduplicate){const existing=await db.prepare('SELECT id,group_id AS groupId,version FROM property_documents WHERE user_id=? AND property_id=? AND sha256=? ORDER BY created_at LIMIT 1').bind(uid,propertyId,sha256).first();if(existing)return Response.json({...existing,duplicate:true});}
 const ag=accessGuard(ctx);const bucket=fileBucket();await bucket.put(objectKey,bytes,{httpMetadata:{contentType:format.mime}});
 try{const result=await db.prepare(`INSERT INTO property_documents(id,group_id,property_id,user_id,version,object_key,filename,mime,size,sha256,title,category,link_type,link_ref,note,created_at)
  SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM property_documents WHERE property_id=? AND user_id=?)<? AND (?=0 OR NOT EXISTS(SELECT 1 FROM property_documents WHERE user_id=? AND property_id=? AND sha256=?)) AND ${ag.sql}`).bind(id,groupId,propertyId,uid,version,objectKey,format.filename,format.mime,bytes.length,sha256,title,category,linkType,linkRef,ctx?'Cargado por '+actor+' · '+note:note,at,propertyId,uid,MAX_DOCUMENT_VERSIONS,deduplicate?1:0,uid,propertyId,sha256,...ag.args).run();if(!result.meta.changes)throw Error('limit');}
 catch{try{await bucket.delete(objectKey);}catch{}return Response.json({error:'No se guardó el archivo: pudo cambiar la versión o alcanzarse el límite. Actualiza la lista y vuelve a intentar.'},{status:409});}
 return Response.json({id,groupId,version},{status:201});
}catch(e){return fail(e);}}
