import assert from 'node:assert/strict';
import { prepareDraft, sameDraftValue } from './draft-state';
import { draftValid, defaultDetail, type InvoiceDraft } from '../invoices';
const at = '2026-10-13T12:00:00.000Z',
  actor = 'verified-actor';
const d: InvoiceDraft = {
  id: 'draft-a',
  propertyId: 'p1',
  status: 'Borrador',
  updatedAt: '',
  note: 'Test',
  invoice: {
    supplierId: 'supplier',
    number: 'D-1',
    due: '2026-11-12',
    documentId: '',
    documentPropertyId: 'p1',
    contractId: '',
    creditFor: '',
    duplicateReason: '',
    declaredTotal: 10,
    lines: [
      {
        id: 'l1',
        propertyId: 'p1',
        bucket: 'line:1',
        category: 'Materiales',
        description: 'Paint',
        subtotal: 10,
        tax: 0,
        retention: 0,
        included: 0,
        sourceLineId: '',
      },
    ],
    detail: defaultDetail('draft-a', '2026-10-13'),
  },
};
let checks = 0;
const check = (label: string, fn: () => void) => {
  fn();
  checks++;
  console.log('PASS ' + label);
};
let initial = prepareDraft(d, null, actor, at);
check('new review history uses verified actor', () => {
  assert.equal(initial.workflow.createdBy, actor);
  assert.equal(initial.workflow.history[0].actor, actor);
});
check('client history is discarded', () => {
  const injected = {
    ...d,
    workflow: { createdBy: 'forged', review: { actor: 'forged' }, history: [] },
  };
  assert.deepEqual(
    prepareDraft(injected, null, actor, at).workflow.history.map(
      (h) => h.actor,
    ),
    [actor],
  );
});
check('draft input is not mutated', () => {
  assert.equal((d as any).workflow, undefined);
  assert.equal(d.updatedAt, '');
});
check('reordering object keys does not change invoice', () =>
  assert(
    sameDraftValue({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }),
  ),
);
check('changing array order is a content change', () =>
  assert(!sameDraftValue([1, 2], [2, 1])),
);
const submitted = prepareDraft(
  { ...d, status: 'En revisión' },
  initial,
  actor,
  at,
);
const reviewed = prepareDraft(
  { ...d, status: 'En revisión' },
  submitted,
  actor,
  at,
  'review',
  'Verified',
);
check('review records server actor', () => {
  assert.equal(reviewed.workflow.review?.actor, actor);
  assert.equal(reviewed.status, 'En revisión');
  assert.equal(reviewed.workflow.history.at(-1)?.status, 'Revisado');
});
check('review requires nonempty observation', () =>
  assert.throws(() =>
    prepareDraft(
      { ...d, status: 'En revisión' },
      submitted,
      actor,
      at,
      'review',
      '',
    ),
  ),
);
check('cannot review unsubmitted draft', () =>
  assert.throws(() => prepareDraft(d, initial, actor, at, 'review', 'Reason')),
);
const edited = {
  ...d,
  invoice: { ...d.invoice, number: 'D-2' },
  status: 'En revisión' as const,
};
check('review cannot include simultaneous invoice edits', () =>
  assert.throws(() =>
    prepareDraft(edited, submitted, actor, at, 'review', 'Reason'),
  ),
);
check('editing reviewed invoice invalidates review', () => {
  const next = prepareDraft(edited, reviewed, actor, at);
  assert.equal(next.status, 'Borrador');
  assert.equal(next.workflow.review, undefined);
  assert(reviewed.workflow.review);
});
check('return and rejection retain observations', () => {
  assert.equal(
    prepareDraft(d, reviewed, actor, at, 'return', 'Correct it').status,
    'Borrador',
  );
  const r = prepareDraft(d, reviewed, actor, at, 'reject', 'Not acceptable');
  assert.equal(r.status, 'Rechazado');
  assert.equal(r.workflow.history.at(-1)?.reason, 'Not acceptable');
  assert.equal(r.workflow.review, undefined);
});
check('rejection cannot bypass review action', () =>
  assert.throws(() =>
    prepareDraft({ ...d, status: 'Rechazado' }, initial, actor, at),
  ),
);
check('primary property cannot be changed', () =>
  assert.throws(() =>
    prepareDraft({ ...d, propertyId: 'p2' }, initial, actor, at),
  ),
);
const recurring = { templateId: 'template', period: '2026-10-13' },
  fromRecurring = {
    ...d,
    invoice: { ...d.invoice, detail: { ...d.invoice.detail!, recurring } },
  };
check('manual draft cannot forge recurring origin', () =>
  assert.throws(() => prepareDraft(fromRecurring, initial, actor, at)),
);
check('generated recurring origin cannot be removed', () =>
  assert.throws(() =>
    prepareDraft(d, { ...initial, invoice: fromRecurring.invoice }, actor, at),
  ),
);
check('generated recurring origin remains editable', () =>
  assert.deepEqual(
    prepareDraft(
      fromRecurring,
      { ...initial, invoice: fromRecurring.invoice },
      actor,
      at,
    ).invoice.detail?.recurring,
    recurring,
  ),
);
check('review history limit enforced', () =>
  assert.throws(() =>
    prepareDraft(
      d,
      {
        ...initial,
        workflow: {
          ...initial.workflow,
          history: Array.from(
            { length: 500 },
            () => initial.workflow.history[0],
          ),
        },
      },
      actor,
      at,
    ),
  ),
);
check('foreign invoice allocation rejected', () =>
  assert.throws(() =>
    draftValid(
      {
        ...d,
        invoice: {
          ...d.invoice,
          lines: [{ ...d.invoice.lines[0], propertyId: 'other' }],
        },
      },
      ['p1'],
    ),
  ),
);
check('draft identity must match invoice request', () =>
  assert.throws(() => draftValid({ ...d, id: 'different' }, ['p1'])),
);
check('invoice payload and review history copied independently', () => {
  const next = prepareDraft(d, initial, actor, at);
  next.invoice.lines[0].description = 'Changed';
  assert.equal(initial.invoice.lines[0].description, 'Paint');
  assert.equal(initial.workflow.history.length, 1);
});
console.log(JSON.stringify({ checks }));
