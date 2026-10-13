import { env } from 'cloudflare:workers';
import { getAppUser } from '@/lib/auth/identity';
import { authClient } from '@/lib/auth/supabase';
import { previewAccess } from './preview';
import {
  ownerCommand,
  ownerReceipt,
  commitOwner,
  ownerFailure,
  changed,
} from './owner-commit-server';
import { readPostgresWorkspace } from './read-server';
import { draftValid, type InvoiceDraft } from '@/lib/invoices';
import { prepareDraft, type StoredDraft } from './draft-state';
import { expenseControl, recurringDraft } from '@/lib/expense-control';
import { changes, redact } from '@/lib/audit';
const headers = { 'Cache-Control': 'no-store' };
function draftPreview() {
  return (
    (env as unknown as Record<string, string>).REHAB_POSTGRES_DRAFTS_PREVIEW ===
    '1'
  );
}
async function draftCommand(req: Request) {
  const actor = await ownerCommand(req);
  if (!draftPreview()) throw Error('MIGRATION_PENDING');
  return actor;
}

async function draftRow(id: string, pid?: string) {
  const client = await authClient();
  let q = client
    .from('expense_drafts')
    .select('payload,property_id,updated_at')
    .eq('id', id);
  if (pid) q = q.eq('property_id', pid);
  const { data, error } = await q.maybeSingle();
  if (error) throw Error('No se pudo consultar el borrador.');
  return data;
}
export async function readDrafts(req: Request) {
  try {
    const actor = await getAppUser();
    if (!actor) throw Error('AUTH');
    if (!previewAccess().read || !draftPreview())
      throw Error('MIGRATION_PENDING');
    const q = new URL(req.url).searchParams;
    if (q.get('grantId')) throw Error('MIGRATION_PENDING');
    const pid = q.get('propertyId'),
      id = q.get('id');
    const client = await authClient();
    const property = pid
      ? await client.from('properties').select('id').eq('id', pid).maybeSingle()
      : { data: null, error: null };
    if (property.error) throw Error('No se pudo consultar la propiedad.');
    if (!property.data)
      return Response.json(
        { error: 'Propiedad no encontrada.' },
        { status: 404, headers },
      );
    if (id) {
      const row = await draftRow(id, pid!);
      return row
        ? Response.json(
            { draft: { ...row.payload, updatedAt: row.updated_at } },
            { headers },
          )
        : Response.json(
            { error: 'Borrador no encontrado.' },
            { status: 404, headers },
          );
    }
    for (const k of ['from', 'to']) {
      const v = q.get(k);
      if (
        v &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
          !Number.isFinite(Date.parse(v)) ||
          new Date(v).toISOString().slice(0, 10) !== v)
      )
        throw Error('Fecha de filtro inválida.');
    }
    const offset = Number(q.get('offset') ?? 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 3000)
      throw Error('Página inválida.');
    const { data, error } = await client.rpc('owner_invoice_draft_list', {
      property_id: pid,
      status_filter: q.get('status')?.slice(0, 200) ?? null,
      supplier_filter: q.get('supplier')?.slice(0, 200) ?? null,
      date_from: q.get('from') || null,
      date_to: q.get('to') || null,
      search_text: q.get('q')?.slice(0, 200) ?? null,
      page_offset: offset,
    });
    if (error) throw Error('No se pudieron consultar los borradores.');
    return Response.json({ owner: actor.userId, ...data }, { headers });
  } catch (e) {
    return ownerFailure(e);
  }
}
export async function writeDraft(req: Request) {
  try {
    const actor = await draftCommand(req),
      raw = await req.text();
    if (raw.length > 110000) throw Error('Borrador demasiado grande.');
    const input = JSON.parse(raw);
    if (input.grantId) throw Error('MIGRATION_PENDING');
    const d = input as InvoiceDraft;
    const workspace = await readPostgresWorkspace();
    draftValid(
      d,
      workspace.properties.map((p) => p.id),
    );
    if (await ownerReceipt(actor, 'draft', input.requestId, input)) {
      const r = await draftRow(d.id);
      if (!r) return changed();
      return Response.json(
        { draft: { ...r.payload, updatedAt: r.updated_at }, replayed: true },
        { status: 201, headers },
      );
    }
    const prior = await draftRow(d.id),
      before = prior?.payload as StoredDraft | null;
    if (workspace.book.invoices.some((i) => i.detail?.requestId === d.id))
      return Response.json(
        {
          error: 'El borrador ya fue registrado. Usa el historial de factura.',
        },
        { status: 409, headers },
      );
    if ((prior?.updated_at ?? '') !== (d.updatedAt ?? '')) return changed();
    const at = new Date(
        Math.max(Date.now(), Date.parse(prior?.updated_at ?? '1970-01-01') + 1),
      ).toISOString(),
      payload = prepareDraft(
        d,
        before,
        actor,
        at,
        input.reviewAction,
        input.observation,
      );
    const result = await commitOwner(
      actor,
      {
        kind: 'draft',
        requestId: input.requestId ?? crypto.randomUUID(),
        draft: payload,
        draftVersion: prior?.updated_at ?? null,
        bookVersion: workspace.version || null,
        properties: workspace.properties.map((p) => ({
          id: p.id,
          version: p.updatedAt,
        })),
        propertyId: d.propertyId,
        module: 'expense:draft',
        audit: {
          reason: input.observation ?? 'Guardar borrador',
          changes: changes(redact(before), redact(payload)),
        },
      },
      input,
    );
    if (result.replayed) {
      const row = await draftRow(d.id);
      if (!row) return changed();
      return Response.json(
        {
          draft: { ...row.payload, updatedAt: row.updated_at },
          replayed: true,
        },
        { status: 201, headers },
      );
    }
    return Response.json(
      { draft: { ...payload, updatedAt: result.updatedAt } },
      { status: 201, headers },
    );
  } catch (e) {
    return ownerFailure(e);
  }
}
export async function generateRecurring(req: Request) {
  try {
    const actor = await draftCommand(req),
      raw = await req.text();
    if (raw.length > 3000) throw Error('Solicitud demasiado grande.');
    const input = JSON.parse(raw);
    if (input.grantId) throw Error('FORBIDDEN');
    const workspace = await readPostgresWorkspace(),
      template = expenseControl(workspace.book)
        .templates.filter((t) => t.id === input.templateId)
        .at(-1);
    if (
      !template ||
      !workspace.properties.some((p) => p.id === template.propertyId)
    )
      throw Error('Plantilla no disponible.');
    const hash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(template.id + '|' + input.period),
          ),
        ),
        (b) => b.toString(16).padStart(2, '0'),
      ).join(''),
      id = 'rec-' + hash.slice(0, 48);
    const response = (replayed = false) =>
      Response.json(
        {
          id,
          replayed,
          message:
            'Borrador creado. Abre Facturas, valida importe real, número y comprobantes antes de registrar.',
        },
        { status: 201, headers },
      );
    if (await ownerReceipt(actor, 'draft', input.requestId, input))
      return response(true);
    if (await draftRow(id))
      return Response.json(
        {
          error:
            'Este período ya tiene borrador. Abre el existente en Facturas.',
        },
        { status: 409, headers },
      );
    const at = new Date().toISOString(),
      draft = recurringDraft(template, input.period, id, at.slice(0, 10));
    draftValid(
      draft,
      workspace.properties.map((p) => p.id),
    );
    const payload = {
      ...draft,
      workflow: {
        createdBy: actor,
        history: [
          {
            id: crypto.randomUUID(),
            actor,
            at,
            date: at.slice(0, 10),
            reason: 'Generación manual de período ' + input.period,
            status: 'Borrador',
          },
        ],
      },
    };
    delete (payload as Partial<InvoiceDraft>).updatedAt;
    const result = await commitOwner(
      actor,
      {
        kind: 'draft',
        requestId: input.requestId ?? crypto.randomUUID(),
        draft: payload,
        draftVersion: null,
        bookVersion: workspace.version || null,
        properties: workspace.properties.map((p) => ({
          id: p.id,
          version: p.updatedAt,
        })),
        propertyId: template.propertyId,
        module: 'expense:recurring',
        audit: {
          reason: 'Generación manual de borrador',
          templateId: template.id,
          period: input.period,
          draftId: id,
        },
      },
      input,
    );
    return response(result.replayed);
  } catch (e) {
    return ownerFailure(e);
  }
}
