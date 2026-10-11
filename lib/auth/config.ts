import { env } from 'cloudflare:workers';
export function authConfig(){
 const e=env as unknown as Record<string,string|undefined>;
 const provider=e.REHAB_AUTH_PROVIDER??'sites';
 if(provider!=='sites'&&provider!=='supabase')throw Error('Proveedor de acceso no válido.');
 if(provider==='sites')return {provider} as const;
 const url=e.SUPABASE_URL,key=e.SUPABASE_PUBLISHABLE_KEY,origin=e.REHAB_APP_ORIGIN;
 if(!url||!key||!origin)throw Error('Falta configurar Supabase Auth.');
 const parsed=new URL(origin),api=new URL(url);
 const local=(u:URL)=>['127.0.0.1','localhost'].includes(u.hostname);
 if((parsed.protocol!=='https:'&&!(local(parsed)&&parsed.protocol==='http:'))||(api.protocol!=='https:'&&!(local(api)&&api.protocol==='http:'))||parsed.origin!==origin||key.startsWith('sb_secret_'))throw Error('Configuración de acceso no válida.');
 // Legacy anonymous keys are accepted only for the local CLI stack.
 if(!key.startsWith('sb_publishable_')&&!local(api))throw Error('Usa una clave publicable de Supabase.');
 return {provider,url,key,origin,secure:parsed.protocol==='https:'} as const;
}
