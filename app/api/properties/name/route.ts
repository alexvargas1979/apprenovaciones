import {env} from 'cloudflare:workers';
import {authConfig} from '@/lib/auth/config';
import {getAppUser} from '@/lib/auth/identity';
import {authClient} from '@/lib/auth/supabase';
import {fail} from '@/lib/server';

/** Narrow, local HU-60 transaction. General property PUT remains blocked. */
export async function PATCH(req:Request){try{
 const actor=await getAppUser();if(!actor)throw Error('AUTH');
 const c=authConfig();
 if(c.provider!=='supabase'||(env as unknown as Record<string,string>).REHAB_POSTGRES_WRITE_PREVIEW!=='1'||new URL(c.url).origin!=='http://127.0.0.1:54321'||!['127.0.0.1','localhost'].includes(new URL(c.origin).hostname))throw Error('MIGRATION_PENDING');
 if(req.headers.get('origin')!==c.origin||new URL(req.url).origin!==c.origin)throw Error('ORIGIN');
 const text=await req.text();if(text.length>6000)throw Error('Solicitud demasiado grande.');const body=JSON.parse(text);
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['id','version','name','reason','requestId'].includes(k))||!['id','version','name','reason','requestId'].every(k=>typeof body[k]==='string'))throw Error('Revisa nombre, versión, motivo e identificador de solicitud.');
 // Require an explicit timezone. Preserve PostgreSQL microseconds; never round via Date.
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(body.version))throw Error('Versión inválida. Actualiza la propiedad.');
 const {data,error}=await (await authClient()).rpc('rename_owned_property',{property_id:body.id,expected_version:body.version,new_name:body.name,reason:body.reason,request_id:body.requestId});
 if(error){const status=error.code==='40001'?409:error.code==='42501'?403:['22023','22P02','22007','22008'].includes(error.code)?400:500;return Response.json({error:status===409?'La propiedad o la solicitud cambió. Actualiza antes de reintentar.':status===403?'Propiedad no disponible para tu cuenta.':status===400?'Revisa el nombre, motivo y versión de la propiedad.':'No se pudo guardar el cambio; no se aplicó parcialmente.'},{status,headers:{'Cache-Control':'no-store'}});}
 return Response.json(data,{headers:{'Cache-Control':'no-store'}});
}catch(e){return fail(e);}}
