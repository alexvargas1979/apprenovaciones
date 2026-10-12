import { env } from 'cloudflare:workers';
import { authClient } from '@/lib/auth/supabase';
import { getAppUser } from '@/lib/auth/identity';
import { authConfig } from '@/lib/auth/config';
import { previewAccess } from './preview';
import { fail } from '@/lib/server';
export async function ownerCommand(req: Request) {
  const actor = await getAppUser();
  if (!actor) throw Error('AUTH');
  const c = authConfig();
  if (c.provider !== 'supabase' || !previewAccess().write)
    throw Error('MIGRATION_PENDING');
  if (
    req.headers.get('origin') !== c.origin ||
    new URL(req.url).origin !== c.origin
  )
    throw Error('ORIGIN');
  return actor.userId;
}
export const ownerFailure = (e: unknown) =>
  e instanceof Response ? e : fail(e);
export const changed = () =>
  Response.json(
    {
      error:
        'Cambió la propiedad, una aprobación o la contabilidad. Recarga antes de continuar.',
    },
    { status: 409, headers: { 'Cache-Control': 'no-store' } },
  );
export async function commitOwner(
  actor: string,
  command: Record<string, unknown>,
  input: unknown,
) {
  const hex = (env as unknown as Record<string, string>)
    .REHAB_MUTATION_SIGNING_KEY;
  if (!/^[a-f0-9]{64}$/.test(hex ?? ''))
    throw Response.json(
      {
        error:
          'La escritura del propietario no está configurada en este entorno.',
      },
      { status: 503 },
    );
  const inputHash = await commandHash(command.kind, input);
  const message = JSON.stringify({
    ...command,
    actor,
    inputHash,
    keyId: 'local-v1',
    expires: Math.floor(Date.now() / 1000) + 120,
  });
  const key = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(hex.match(/../g)!, (b) => parseInt(b, 16)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = Array.from(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
  // The RPC runs with the user's session, not a service-role key. The MAC attests server validation.
  const { data, error } = await (
    await authClient()
  ).rpc('commit_validated_owner_change', { message, signature });
  if (error)
    throw error.code === '40001'
      ? changed()
      : Response.json(
          {
            error:
              error.code === '42501'
                ? 'Operación no autorizada para esta cuenta.'
                : 'No se guardó la operación; sus cambios fueron revertidos.',
          },
          {
            status: error.code === '42501' ? 403 : 500,
            headers: { 'Cache-Control': 'no-store' },
          },
        );
  return data;
}

async function commandHash(kind: unknown, input: unknown) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify({ kind: kind, input })),
      ),
    ),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function ownerReceipt(
  actor: string,
  kind: string,
  requestId: unknown,
  input: unknown,
) {
  if (requestId === undefined) return null;
  if (
    typeof requestId !== 'string' ||
    !requestId.trim() ||
    requestId.length > 200
  )
    throw Error('Identificador de solicitud inválido.');
  const { data, error } = await (
    await authClient()
  )
    .from('audit_events')
    .select('payload')
    .eq('id', `hu60:owner:${actor}:${requestId}`)
    .maybeSingle();
  if (error) throw Error('No se pudo verificar el reintento.');
  if (!data) return null;
  if (data.payload.inputHash !== (await commandHash(kind, input)))
    throw changed();
  return data.payload.result;
}
