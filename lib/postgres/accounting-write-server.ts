import {
  ownerCommand,
  ownerReceipt,
  commitOwner,
  changed,
  ownerFailure,
} from './owner-commit-server';
import { readPostgresWorkspace } from './read-server';
import { authClient } from '@/lib/auth/supabase';
import { applyExpenseControl } from '@/lib/expense-control';
import { applyPurchase } from '@/lib/procurement';
import { applyClassification } from '@/lib/classification';
import { applyOversight, guardOversight } from '@/lib/oversight-actions';
import { applyLifecycle, guardLifecycle } from '@/lib/lifecycle-actions';
import { applyDelivery, guardDeliveryProperty } from '@/lib/delivery-actions';
import { applyAccounting } from '@/lib/accounting-actions';
import { validateAudit } from '@/lib/operations';
import { approvalGate } from '@/lib/expense-access';
import { storedBook } from '@/lib/expense-storage';
import { attachExecution } from '@/lib/accounting-server';
import { changes, redact } from '@/lib/audit';
export async function writeAccounting(req: Request) {
  try {
    const actor = await ownerCommand(req),
      raw = await req.text();
    if (raw.length > 1200000) throw Error('Registro demasiado grande.');
    const body = JSON.parse(raw);
    if (body.grantId) throw Error('MIGRATION_PENDING');
    const old = await readPostgresWorkspace(),
      properties = old.properties,
      client = await authClient();
    if (await ownerReceipt(actor, 'book', body.requestId, body))
      return Response.json(
        {
          book: old.book,
          version: old.version,
          properties: properties.map((p) => attachExecution(p, old)),
          replayed: true,
        },
        { status: 201, headers: { 'Cache-Control': 'no-store' } },
      );
    let inputHash = '';
    if (body.action === 'invoice' && body.data?.detail?.requestId) {
      inputHash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(JSON.stringify(body.data)),
          ),
        ),
        (x) => x.toString(16).padStart(2, '0'),
      ).join('');
      const prior = old.book.invoices.find(
        (i) => i.detail?.requestId === body.data.detail.requestId,
      );
      if (prior) {
        if (prior.detail?.inputHash !== inputHash) return changed();
        return Response.json({
          book: old.book,
          version: old.version,
          replayed: true,
          invoiceId: prior.id,
          properties: [],
        });
      }
    }
    if (typeof body.version !== 'string' || body.version !== old.version)
      return changed();
    const at = new Date(
      Math.max(Date.now(), Date.parse(old.version || '1970-01-01') + 1),
    ).toISOString();
    validateAudit(body.date, body.reason, at.slice(0, 10));
    const sourceDraftId =
      body.action === 'invoice'
        ? body.data.detail?.requestId
        : body.action === 'approve'
          ? old.book.invoices.find((i) => i.id === body.data.id)?.detail
              ?.requestId
          : null;
    const draft = sourceDraftId
      ? await client
          .from('expense_drafts')
          .select('payload,updated_at')
          .eq('id', sourceDraftId)
          .maybeSingle()
      : { data: null, error: null };
    if (draft.error) throw Error('No se pudo verificar el borrador.');
    const source = draft.data?.payload;
    if (
      body.action === 'invoice' &&
      (body.data.detail?.recurring || source?.invoice?.detail?.recurring) &&
      (!source ||
        JSON.stringify(source.invoice.detail?.recurring) !==
          JSON.stringify(body.data.detail?.recurring))
    )
      throw Error('Genera primero el período desde la plantilla.');
    if (
      body.action === 'approve' &&
      old.book.expensePolicy?.separateDuties &&
      source?.workflow?.createdBy === actor
    )
      throw Error(
        'La separación de funciones impide aprobar un borrador propio.',
      );
    if (body.action === 'approve') {
      const invoice = old.book.invoices.find((i) => i.id === body.data.id);
      if (invoice) approvalGate(old.book, invoice, actor, null, properties);
    }
    if (
      body.action === 'invoice' &&
      body.data.detail?.attachments?.some((a: any) => a.pages)
    )
      throw Error(
        'La validación de rangos de páginas requiere completar la integración de archivos HU-61.',
      );
    const starts = (prefix: string) =>
      typeof body.action === 'string' && body.action.startsWith(prefix)
        ? body.action.slice(prefix.length)
        : null;
    const action = starts('delivery:'),
      lifecycleAction = starts('lifecycle:'),
      oversightAction = starts('oversight:'),
      expenseAction = starts('expense:'),
      purchaseAction = starts('purchase:'),
      classificationAction = starts('classification:');
    let baseline: { id: string; result: any } | null = null,
      saleBase: null | { propertyId: string; id: string | null } = null;
    if (lifecycleAction === 'sale') {
      const b = await client
        .from('analysis_baselines')
        .select('scenario_id')
        .eq('property_id', body.data.propertyId)
        .maybeSingle();
      if (b.error) throw Error('No se pudo consultar la base aprobada.');
      saleBase = {
        propertyId: body.data.propertyId,
        id: b.data?.scenario_id ?? null,
      };
      if (b.data) {
        const s = await client
          .from('analysis_scenarios')
          .select('id,payload')
          .eq('id', b.data.scenario_id)
          .single();
        if (s.error) throw Error('No se pudo consultar el escenario aprobado.');
        baseline = { id: s.data.id, result: s.data.payload.result };
      }
    }
    const policyAction = body.action === 'expense-policy';
    if (policyAction) {
      const d = body.data;
      if (
        typeof d.separateDuties !== 'boolean' ||
        !Number.isFinite(d.approvalLimit) ||
        d.approvalLimit < 0 ||
        d.approvalLimit > 1e9 ||
        !Number.isFinite(d.overBudgetLimit) ||
        d.overBudgetLimit < 0 ||
        d.overBudgetLimit > 1e9
      )
        throw Error('Límites de aprobación inválidos.');
    }
    const audit = {
      id: crypto.randomUUID(),
      actor,
      at,
      date: body.date,
      reason: body.reason,
    };
    const book = policyAction
      ? {
          ...old.book,
          expensePolicy: {
            separateDuties: body.data.separateDuties,
            approvalLimit: body.data.approvalLimit,
            overBudgetLimit: body.data.overBudgetLimit,
          },
        }
      : classificationAction
        ? applyClassification(
            old.book,
            classificationAction,
            body.data,
            audit,
            properties,
          )
        : await (
            expenseAction
              ? applyExpenseControl
              : purchaseAction
                ? applyPurchase
                : oversightAction
                  ? applyOversight
                  : lifecycleAction
                    ? applyLifecycle
                    : action
                      ? applyDelivery
                      : applyAccounting
          )(
            old.book,
            expenseAction ??
              purchaseAction ??
              oversightAction ??
              lifecycleAction ??
              action ??
              body.action,
            body.data,
            audit,
            properties,
            async (id, pid) => {
              if (typeof id !== 'string') throw Error('Comprobante inválido.');
              const d = await client
                .from('property_documents')
                .select('id')
                .eq('id', id)
                .eq('property_id', pid)
                .maybeSingle();
              if (d.error || !d.data)
                throw Error(
                  'Selecciona un comprobante privado de la propiedad indicada.',
                );
            },
            baseline,
          );
    if (inputHash) {
      const created = book.invoices.find(
        (i) => i.detail?.requestId === body.data.detail.requestId,
      );
      if (created?.detail) created.detail.inputHash = inputHash;
    }
    for (const p of properties) {
      guardDeliveryProperty(p, book);
      guardLifecycle(p, book);
    }
    guardOversight(book);
    const normalized = storedBook(book);
    if (JSON.stringify(normalized).length > 900000)
      throw Error('Límite de tamaño del registro contable.');
    const result = await commitOwner(
      actor,
      {
        kind: 'book',
        requestId:
          typeof body.requestId === 'string'
            ? body.requestId
            : crypto.randomUUID(),
        book,
        storedBook: normalized,
        bookVersion: old.version || null,
        properties: properties.map((p) => ({ id: p.id, version: p.updatedAt })),
        propertyId: body.data.propertyId ?? '',
        module: body.action,
        sourceDraft: source
          ? { id: sourceDraftId, version: draft.data!.updated_at }
          : null,
        saleBase,
        audit: {
          date: body.date,
          reason: body.reason,
          changes: changes(redact(old.book), redact(book)),
        },
      },
      body,
    );
    if (result.replayed) {
      const current = await readPostgresWorkspace();
      return Response.json(
        {
          book: current.book,
          version: current.version,
          properties: current.properties.map((p) =>
            attachExecution(p, current),
          ),
          replayed: true,
        },
        { status: 201, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return Response.json(
      {
        book,
        version: result.version,
        properties: properties.map((p) =>
          attachExecution(p, { book, version: result.version }),
        ),
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return ownerFailure(e);
  }
}
