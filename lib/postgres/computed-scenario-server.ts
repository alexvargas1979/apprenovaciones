import { env } from 'cloudflare:workers';
import { createClient } from '@supabase/supabase-js';
import { authConfig } from '@/lib/auth/config';
import { getAppUser } from '@/lib/auth/identity';
import { previewAccess } from '@/lib/postgres/preview';
import { readPostgresWorkspace } from '@/lib/postgres/read-server';
import { attachExecution } from '@/lib/accounting-server';
import {
  calculateFlip,
  stressProperty,
  validateInvestment,
  ENGINE_VERSION,
} from '@/lib/investment';
import { compareExits } from '@/lib/comparison';
import { fail } from '@/lib/server';
const conflict = () =>
  Response.json(
    {
      error:
        'Cambió la propiedad, la contabilidad o la solicitud; ya existe una base aprobada o se alcanzó el límite de 50 versiones. Recarga antes de continuar.',
    },
    { status: 409, headers: { 'Cache-Control': 'no-store' } },
  );
export async function computedScenario(
  req: Request,
  mode: 'save' | 'approve' | 'stress' = 'save',
) {
  const approve = mode === 'approve',
    stress = mode === 'stress';
  try {
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
    const text = await req.text();
    if (text.length > 6000) throw Error('Solicitud demasiado grande.');
    const b = JSON.parse(text);
    const stamp =
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/;
    if (
      !b ||
      typeof b !== 'object' ||
      Array.isArray(b) ||
      Object.keys(b).some(
        (k) =>
          ![
            'propertyId',
            'version',
            'bookVersion',
            'label',
            'requestId',
            ...(approve ? ['confirm'] : []),
            ...(stress ? ['stressIndex'] : []),
          ].includes(k),
      ) ||
      !['propertyId', 'version', 'label', 'requestId'].every(
        (k) => typeof b[k] === 'string',
      ) ||
      !stamp.test(b.version) ||
      !(
        b.bookVersion === null ||
        (typeof b.bookVersion === 'string' && stamp.test(b.bookVersion))
      ) ||
      (approve && b.confirm !== true) ||
      (stress &&
        (!Number.isInteger(b.stressIndex) ||
          b.stressIndex < 0 ||
          b.stressIndex > 5)) ||
      !b.label.trim() ||
      b.label.trim().length > 100
    )
      throw Error('Revisa propiedad, nombre y versiones.');
    // Server binding only. Never reuse a cookie client or pass this key to a component.
    const key = (env as unknown as Record<string, string>).SUPABASE_SECRET_KEY;
    if (!key)
      return Response.json(
        {
          error:
            'El guardado de escenarios no está configurado en este entorno.',
        },
        { status: 503 },
      );
    const server = createClient(c.url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const args = {
      actor: actor.userId,
      property_id: b.propertyId,
      expected_version: b.version,
      expected_book_version: b.bookVersion,
      label: b.label,
      request_id: b.requestId,
      ...(stress ? { stress_index: b.stressIndex } : {}),
    };
    const invoke = async (snapshot: unknown = null) => {
      const { data, error } = await server.rpc(
        approve
          ? 'approve_computed_scenario'
          : stress
            ? 'stress_computed_scenario'
            : 'save_computed_scenario',
        {
          ...args,
          snapshot,
        },
      );
      if (error) {
        if (error.code === '40001') return { response: conflict() };
        const status =
          error.code === '42501'
            ? 403
            : ['22023', '22P02', '22007', '22008'].includes(error.code)
              ? 400
              : 500;
        return {
          response: Response.json(
            {
              error:
                status === 403
                  ? 'Propiedad no disponible para tu cuenta.'
                  : status === 400
                    ? 'Revisa los datos del escenario.'
                    : 'No se pudo guardar el escenario; no se aplicó parcialmente.',
            },
            { status, headers: { 'Cache-Control': 'no-store' } },
          ),
        };
      }
      return { data };
    };
    // Look up the receipt before reading/recalculating: retries survive subsequent edits.
    const receipt = await invoke();
    if (receipt.response) return receipt.response;
    if (receipt.data?.replayed)
      return Response.json(receipt.data, {
        headers: { 'Cache-Control': 'no-store' },
      });
    const workspace = await readPostgresWorkspace(),
      stored = workspace.properties.find((p) => p.id === b.propertyId);
    if (!stored)
      return Response.json(
        { error: 'Propiedad no disponible para tu cuenta.' },
        { status: 403 },
      );
    if (
      stored.updatedAt !== b.version ||
      (workspace.version || null) !== b.bookVersion
    )
      return conflict();
    let p = attachExecution(stored, workspace);
    if (!p.investment)
      throw Error('La propiedad no tiene un análisis de inversión guardado.');
    validateInvestment(p.investment);
    const sourceStress = stress ? p.investment.stress[b.stressIndex] : null;
    if (stress) {
      if (!sourceStress) throw Error('Prueba de estrés no encontrada.');
      p = stressProperty(p, b.stressIndex);
    }
    const investment = p.investment!;
    const result = calculateFlip(p, investment),
      comparison = investment.comparison
        ? compareExits(p, investment, investment.comparison)
        : null;
    if (approve) {
      const missing = [...result.missing, ...(comparison?.errors ?? [])];
      if (missing.length)
        throw Error('La base requiere completar: ' + missing.join(', '));
    }
    const { workflowHistory, dataHistory, marketHistory, ...property } = p;
    const saved = await invoke({
      engine: ENGINE_VERSION,
      property,
      result,
      comparison,
      savedPropertyAt: stored.updatedAt,
      sourceStress,
    });
    if (saved.response) return saved.response;
    return Response.json(saved.data, {
      status: saved.data.replayed ? 200 : 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return fail(e);
  }
}
