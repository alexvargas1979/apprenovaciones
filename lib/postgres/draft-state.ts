import type { InvoiceDraft } from '@/lib/invoices';
import type { DraftReview } from '@/lib/expense-access';
export type StoredDraft = Omit<InvoiceDraft, 'updatedAt'> & {
  workflow: DraftReview;
};
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}
export const sameDraftValue = (a: unknown, b: unknown) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
/** Server-owned review history; client histories and approval markers are discarded. */
export function prepareDraft(
  d: InvoiceDraft,
  before: StoredDraft | null,
  actor: string,
  at: string,
  reviewAction?: unknown,
  observation?: unknown,
): StoredDraft {
  if (
    !sameDraftValue(
      before?.invoice?.detail?.recurring,
      d.invoice.detail?.recurring,
    )
  )
    throw Error('Conserva el origen del período generado desde la plantilla.');
  if (before && before.propertyId !== d.propertyId)
    throw Error('El borrador no puede cambiar de propiedad principal.');
  let state = d.status;
  const trail: DraftReview = structuredClone(
    before?.workflow ?? { createdBy: actor, history: [] },
  );
  const changed = !!before && !sameDraftValue(before.invoice, d.invoice);
  if (reviewAction) {
    if (!before || changed || before.status !== 'En revisión')
      throw Error(
        'Recarga el borrador en revisión sin modificarlo antes de decidir.',
      );
    if (
      !['review', 'return', 'reject'].includes(String(reviewAction)) ||
      typeof observation !== 'string' ||
      !observation.trim() ||
      observation.length > 1000
    )
      throw Error('Indica observación de revisión.');
    const audit = {
      id: crypto.randomUUID(),
      actor,
      at,
      date: at.slice(0, 10),
      reason: observation,
    };
    if (reviewAction === 'review') {
      trail.review = audit;
      state = 'En revisión';
    } else {
      delete trail.review;
      state = reviewAction === 'reject' ? 'Rechazado' : 'Borrador';
    }
    trail.history.push({
      ...audit,
      status: reviewAction === 'review' ? 'Revisado' : state,
    });
  } else {
    if (changed) {
      delete trail.review;
      if (before!.status === 'En revisión') state = 'Borrador';
    }
    if (state === 'Rechazado' && before?.status !== 'Rechazado')
      throw Error('Usa la acción de revisión para rechazar con observaciones.');
    trail.history.push({
      id: crypto.randomUUID(),
      actor,
      at,
      date: at.slice(0, 10),
      reason: changed
        ? 'Edición: revisión anterior invalidada'
        : 'Guardado de borrador',
      status: state,
    });
  }
  if (trail.history.length > 500)
    throw Error('Límite de revisiones de borrador alcanzado.');
  return {
    id: d.id,
    propertyId: d.propertyId,
    status: state,
    invoice: structuredClone(d.invoice),
    note: d.note,
    workflow: trail,
  };
}
