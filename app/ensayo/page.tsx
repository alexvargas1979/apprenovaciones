import { requireAppUser } from '@/lib/auth/identity';
import { previewAccess } from '@/lib/postgres/preview';
import Workspace from './workspace';
export const dynamic = 'force-dynamic';
export default async function Page() {
  await requireAppUser('/ensayo');
  const access = previewAccess();
  if (!access.read)
    return (
      <main style={{ maxWidth: 720, margin: '60px auto', padding: 24 }}>
        <h1>Prueba local no habilitada</h1>
        <p>
          La cartera de prueba está desactivada. Tus datos de producción no se
          han modificado.
        </p>
        <a href="/cuenta">Volver a mi cuenta</a>
      </main>
    );
  return <Workspace writable={access.write} />;
}
