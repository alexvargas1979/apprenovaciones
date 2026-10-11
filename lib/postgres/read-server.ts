import {env} from 'cloudflare:workers';
import {authConfig} from '../auth/config';
import {authClient} from '../auth/supabase';
import {getAppUser} from '../auth/identity';
import {decodeWorkspace,type WorkspaceSnapshot} from './workspace';

export async function readPostgresWorkspace(){
 if(!await getAppUser())throw Error('AUTH');
 const c=authConfig(),enabled=(env as unknown as Record<string,string>).REHAB_POSTGRES_READ_PREVIEW==='1';
 // Explicit local opt-in until HU-59 reconciliation and transactional writes pass.
 if(c.provider!=='supabase'||!enabled||new URL(c.url).origin!=='http://127.0.0.1:54321'||!['127.0.0.1','localhost'].includes(new URL(c.origin).hostname))throw Error('MIGRATION_PENDING');
 const {data,error}=await (await authClient()).rpc('owner_workspace_snapshot');
 if(error||!data)throw Error('No se pudo consultar la cartera en PostgreSQL. Reintenta.');
 return decodeWorkspace(data as WorkspaceSnapshot);
}
