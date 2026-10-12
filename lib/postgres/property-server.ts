import { readPostgresWorkspace } from './read-server';
import {
  ownerCommand,
  ownerReceipt,
  commitOwner,
  changed,
  ownerFailure,
} from './owner-commit-server';
import { authClient } from '@/lib/auth/supabase';
import { validateProperty } from '@/lib/model';
import { withoutRetiredImport } from '@/lib/retired-import';
import { prepareExpediente, duplicates } from '@/lib/expediente';
import { auditProperty, changes } from '@/lib/audit';
import { guardDeliveryProperty } from '@/lib/delivery-actions';
import { guardLifecycle } from '@/lib/lifecycle-actions';
import { attachExecution } from '@/lib/accounting-server';
export async function saveProperty(req: Request) {
  try {
    const actor = await ownerCommand(req),
      text = await req.text();
    if (text.length > 150000) throw Error('Propiedad demasiado grande');
    const raw = JSON.parse(text),
      parsed = structuredClone(raw),
      reason =
        typeof parsed.editReason === 'string' ? parsed.editReason.trim() : '';
    delete parsed.editReason;
    const requestId =
      typeof parsed.requestId === 'string'
        ? parsed.requestId
        : crypto.randomUUID();
    delete parsed.requestId;
    const input = validateProperty(withoutRetiredImport(parsed)),
      workspace = await readPostgresWorkspace(),
      previous = workspace.properties.find((p) => p.id === input.id);
    if (await ownerReceipt(actor, 'property', raw.requestId, raw)) {
      if (!previous) return changed();
      return Response.json(
        {
          updatedAt: previous.updatedAt,
          property: attachExecution(previous, workspace),
          duplicates: [],
          replayed: true,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if ((previous?.updatedAt ?? null) !== (input.updatedAt ?? null))
      return changed();
    const at = new Date(
        Math.max(
          Date.now(),
          Date.parse(previous?.updatedAt ?? '1970-01-01') + 1,
        ),
      ).toISOString(),
      property = validateProperty(
        prepareExpediente(input, previous ?? null, actor, at),
      );
    const baseline = await (
      await authClient()
    )
      .from('analysis_baselines')
      .select('scenario_id')
      .eq('property_id', property.id)
      .maybeSingle();
    if (baseline.error) throw Error('No se pudo verificar la aprobación.');
    if (
      previous &&
      JSON.stringify(auditProperty(previous)) !==
        JSON.stringify(auditProperty(property)) &&
      (property.operations?.budget || baseline.data) &&
      (!reason || reason.length > 1000)
    )
      throw Error(
        'Indica el motivo del cambio: el expediente tiene una aprobación.',
      );
    guardDeliveryProperty(property, workspace.book);
    guardLifecycle(property, workspace.book);
    const projected = attachExecution(property, workspace);
    for (const [id, value] of Object.entries(projected.execution!.included))
      if ((property.lines[id]?.actual ?? 0) < value)
        throw Error(
          'El saldo manual no puede ser menor que los comprobantes conciliados.',
        );
    const result = await commitOwner(
      actor,
      {
        kind: 'property',
        requestId,
        property,
        propertyId: property.id,
        propertyVersion: previous?.updatedAt ?? null,
        bookVersion: workspace.version || null,
        baselineId: baseline.data?.scenario_id ?? null,
        module: 'property',
        audit: {
          reason:
            reason || input.workflowEdit?.reason || 'Edición de expediente',
          changes: changes(auditProperty(previous), auditProperty(property)),
        },
      },
      raw,
    );
    if (result.replayed) {
      const current = await readPostgresWorkspace(),
        stored = current.properties.find((p) => p.id === property.id);
      if (!stored) return changed();
      return Response.json(
        {
          updatedAt: stored.updatedAt,
          property: attachExecution(stored, current),
          duplicates: [],
          replayed: true,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return Response.json(
      {
        updatedAt: result.updatedAt,
        property: attachExecution(
          { ...property, updatedAt: result.updatedAt },
          workspace,
        ),
        duplicates: duplicates(
          property,
          workspace.properties.filter((p) => p.id !== property.id),
        ).map((p) => ({ id: p.id, name: p.name })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return ownerFailure(e);
  }
}
