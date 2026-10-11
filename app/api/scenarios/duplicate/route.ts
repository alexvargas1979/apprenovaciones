import {env} from 'cloudflare:workers';
import {authConfig} from '@/lib/auth/config';
import {getAppUser} from '@/lib/auth/identity';
import {authClient} from '@/lib/auth/supabase';
import {fail} from '@/lib/server';
export async function POST(req:Request){try{
 if(!await getAppUser())throw Error('AUTH');const c=authConfig();
 if(c.provider!=='supabase'||(env as unknown as Record<string,string>).REHAB_POSTGRES_WRITE_PREVIEW!=='1'||new URL(c.url).origin!=='http://127.0.0.1:54321'||!['127.0.0.1','localhost'].includes(new URL(c.origin).hostname))throw Error('MIGRATION_PENDING');
 if(req.headers.get('origin')!==c.origin||new URL(req.url).origin!==c.origin)throw Error('ORIGIN');
 const text=await req.text();if(text.length>6000)throw Error('Solicitud demasiado grande.');const b=JSON.parse(text);
 const stamp=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/;
 if(!b||typeof b!=='object'||Array.isArray(b)||Object.keys(b).some(k=>!['propertyId','sourceId','version','bookVersion','label','requestId'].includes(k))||!['propertyId','sourceId','version','label','requestId'].every(k=>typeof b[k]==='string')||!stamp.test(b.version)||!(b.bookVersion===null||typeof b.bookVersion==='string'&&stamp.test(b.bookVersion)))throw Error('Revisa propiedad, origen, etiqueta y versiones.');
 const {data,error}=await (await authClient()).rpc('duplicate_owned_scenario',{property_id:b.propertyId,source_id:b.sourceId,expected_version:b.version,expected_book_version:b.bookVersion,label:b.label,request_id:b.requestId});
 if(error){const status=error.code==='40001'?409:error.code==='42501'?403:['22023','22P02','22007','22008'].includes(error.code)?400:500;return Response.json({error:status===409?'Cambió el expediente, la contabilidad o la solicitud, o se alcanzó el límite de 50 versiones. Actualiza antes de reintentar.':status===403?'Propiedad o escenario no disponible para tu cuenta.':status===400?'Revisa etiqueta, identificadores y versiones.':'No se pudo duplicar el escenario; no se aplicó parcialmente.'},{status,headers:{'Cache-Control':'no-store'}});}
 return Response.json(data,{status:data.replayed?200:201,headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e);}}
