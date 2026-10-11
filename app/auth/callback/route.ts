import {authClient} from '@/lib/auth/supabase';
import {authConfig} from '@/lib/auth/config';
export async function GET(req:Request){
 const c=authConfig();if(c.provider!=='supabase')return new Response('No disponible',{status:404});
 const code=new URL(req.url).searchParams.get('code');
 const valid=code&&code.length<2048&&!((await (await authClient()).auth.exchangeCodeForSession(code)).error);
 return new Response(null,{status:303,headers:{Location:c.origin+(valid?'/cuenta?message=verified':'/ingresar?error=link'),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
}
