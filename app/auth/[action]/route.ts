import {authClient} from '@/lib/auth/supabase';
import {authConfig} from '@/lib/auth/config';
import {safeReturnPath} from '@/lib/auth/paths';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const c=authConfig();if(c.provider!=='supabase')return new Response('No disponible',{status:404});
 const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
 const go=(path:string)=>new Response(null,{status:303,headers:{...headers,Location:c.origin+path}});
 if(req.headers.get('origin')!==c.origin)return new Response('Solicitud no permitida',{status:403,headers});
 if(Number(req.headers.get('content-length')??0)>16000)return new Response('Solicitud demasiado grande',{status:413,headers});
 const text=await req.text();if(text.length>16000)return new Response('Solicitud demasiado grande',{status:413,headers});
 const form=new URLSearchParams(text),action=new URL(req.url).pathname.split('/').pop();
 if(!['login','logout','recover','password','verify'].includes(action??''))return new Response('No encontrado',{status:404,headers});
 const client=await authClient();
 if(action==='logout'){const {error}=await client.auth.signOut({scope:'global'});if(error)return go('/cuenta?error=logout');return go('/ingresar?message=logout');}
 if(action==='recover'){
  const email=(form.get('email')??'').trim();if(email.length<255&&email.includes('@'))await client.auth.resetPasswordForEmail(email,{redirectTo:c.origin+'/auth/callback'});
  return go('/recuperar?message=sent'); // Identical response whether the account exists or not.
 }
 if(action==='verify'){
  const type=form.get('type'),token=form.get('token_hash');
  if(!token||token.length>512||!['invite','recovery','email','signup'].includes(type??''))return go('/ingresar?error=link');
  const {error}=await client.auth.verifyOtp({token_hash:token,type:type as 'invite'|'recovery'|'email'|'signup'});
  return go(error?'/ingresar?error=link':'/cuenta?message=verified');
 }
 const password=form.get('password')??'';
 if(action==='password'){
  const {data,error}=await client.auth.getUser();if(error||!data.user?.email_confirmed_at)return go('/ingresar?error=session');
  if(password.length<12||password.length>128||password!==form.get('confirm'))return go('/cuenta?error=password');
  const updated=await client.auth.updateUser({password});if(updated.error)return go('/cuenta?error=password');
  const signedOut=await client.auth.signOut({scope:'global'});if(signedOut.error)return go('/cuenta?error=logout');
  return go('/ingresar?message=password');
 }
 const email=(form.get('email')??'').trim();
 if(!email||email.length>254||!password||password.length>128)return go('/ingresar?error=credentials');
 const {data,error}=await client.auth.signInWithPassword({email,password});
 if(error||!data.user?.email_confirmed_at)return go('/ingresar?error=credentials');
 return go(safeReturnPath(form.get('next')));
}
export async function GET(req:Request){
 if(new URL(req.url).pathname!=='/auth/session')return new Response('Método no permitido',{status:405});
 if(authConfig().provider!=='supabase')return new Response('No disponible',{status:404});
 const {data,error}=await (await authClient()).auth.getUser();
 return Response.json(error||!data.user?.email_confirmed_at?{authenticated:false}:{authenticated:true,userId:data.user.id,email:data.user.email},{status:error||!data.user?.email_confirmed_at?401:200,headers:{'Cache-Control':'private, no-store'}});
}
