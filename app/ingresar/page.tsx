import AuthShell from '../auth-shell';
import {authConfig} from '@/lib/auth/config';
import {chatGPTSignInPath} from '../chatgpt-auth';
import {safeReturnPath} from '@/lib/auth/paths';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string>>}){
 const q=await searchParams;if(authConfig().provider==='sites')return <AuthShell title="Iniciar sesión"><a href={chatGPTSignInPath('/')}>Continuar con ChatGPT</a></AuthShell>;
 const error=q.error==='link'?'El enlace no es válido, ya se utilizó o caducó. Solicita uno nuevo.':q.error==='session'?'Tu sesión terminó. Inicia sesión otra vez.':'No pudimos iniciar sesión. Revisa tu correo, contraseña y confirmación del correo.';
 return <AuthShell title="Bienvenido de nuevo"><p>Ingresa para administrar tus propiedades.</p>{q.error&&<p role="alert" className="auth-alert">{error}</p>}{q.message&&<p role="status">{q.message==='password'?'Contraseña actualizada. Inicia sesión con tu nueva contraseña.':'Has cerrado la sesión.'}</p>}<form method="post" action="/auth/login"><input type="hidden" name="next" value={safeReturnPath(q.next)}/><label>Correo electrónico<input type="email" name="email" autoComplete="username" required maxLength={254}/></label><label>Contraseña<input type="password" name="password" autoComplete="current-password" required maxLength={128}/></label><button type="submit">Iniciar sesión</button></form><a href="/recuperar">Olvidé mi contraseña</a><p className="auth-muted">El acceso es por invitación. Solicita tu cuenta al administrador.</p></AuthShell>;
}
