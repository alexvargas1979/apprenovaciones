import {redirect} from 'next/navigation';
import {authConfig} from '@/lib/auth/config';
import AuthShell from '../auth-shell';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string>>}){if(authConfig().provider==='sites')redirect('/ingresar');const q=await searchParams;return <AuthShell title="Recuperar contraseña"><p>Te enviaremos un enlace para elegir una nueva contraseña.</p>{q.message&&<p role="status">Si existe una cuenta con ese correo, recibirás las instrucciones. Revisa también la carpeta de correo no deseado.</p>}<form method="post" action="/auth/recover"><label>Correo electrónico<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><button type="submit">Enviar instrucciones</button></form><a href="/ingresar">Volver a iniciar sesión</a></AuthShell>}
