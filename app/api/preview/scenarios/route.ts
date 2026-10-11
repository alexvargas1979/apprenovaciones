import { readPostgresWorkspace } from '@/lib/postgres/read-server';
import { authClient } from '@/lib/auth/supabase';
import { fail } from '@/lib/server';
export async function GET(req: Request) {
  try {
    const workspace = await readPostgresWorkspace(),
      id = new URL(req.url).searchParams.get('propertyId');
    const property = workspace.properties.find((p) => p.id === id);
    if (!property)
      return Response.json(
        { error: 'Propiedad no encontrada.' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    const client = await authClient();
    const [scenarios, baseline] = await Promise.all([
      client
        .from('analysis_scenarios')
        .select('id,label,source_id,created_at')
        .eq('property_id', property.id)
        .order('created_at', { ascending: false })
        .order('id')
        .limit(51),
      client
        .from('analysis_baselines')
        .select('scenario_id')
        .eq('property_id', property.id)
        .maybeSingle(),
    ]);
    if (scenarios.error || baseline.error)
      throw Error('No se pudieron consultar las versiones. Reintenta.');
    if (scenarios.data.length > 50)
      throw Error(
        'Este expediente supera las 50 versiones. Revisa los datos antes de continuar.',
      );
    // List metadata only. Duplication rechecks both versions atomically in PostgreSQL.
    return Response.json(
      {
        propertyId: property.id,
        version: property.updatedAt,
        bookVersion: workspace.version || null,
        baseId: baseline.data?.scenario_id ?? null,
        scenarios: scenarios.data,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return fail(e);
  }
}
