import {redirect} from 'next/navigation';
import {authConfig} from '@/lib/auth/config';
import AuthShell from '../../auth-shell';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string>>}){if(authConfig().provider==='sites')redirect('/ingresar');const q=await searchParams;const valid=typeof q.token_hash==='string'&&q.token_hash.length<=512&&['invite','email','signup','recovery'].includes(q.type);return <AuthShell title="Confirmar acceso">{valid?<><p>Continúa para verificar tu correo y acceder a tu cuenta. Este enlace solo puede utilizarse una vez.</p><form method="post" action="/auth/verify"><input type="hidden" name="token_hash" value={q.token_hash}/><input type="hidden" name="type" value={q.type}/><button type="submit">Confirmar y continuar</button></form></>:<p role="alert">El enlace no es válido. <a href="/recuperar">Solicitar uno nuevo</a>.</p>}</AuthShell>}
