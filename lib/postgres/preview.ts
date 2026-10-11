import { env } from 'cloudflare:workers';
import { authConfig } from '../auth/config';
/** Fail closed: this temporary workspace is never available on a remote project. */
export function previewAccess() {
  const c = authConfig(),
    flags = env as unknown as Record<string, string>;
  const local =
    c.provider === 'supabase' &&
    new URL(c.url).origin === 'http://127.0.0.1:54321' &&
    ['127.0.0.1', 'localhost'].includes(new URL(c.origin).hostname);
  const read = local && flags.REHAB_POSTGRES_READ_PREVIEW === '1';
  return { read, write: read && flags.REHAB_POSTGRES_WRITE_PREVIEW === '1' };
}
