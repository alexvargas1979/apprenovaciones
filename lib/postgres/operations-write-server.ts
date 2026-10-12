import { changes } from '@/lib/audit';
import { attachExecution } from '@/lib/accounting-server';
import { validateProperty, type Property } from '@/lib/model';
import { calculateFlip, validateInvestment } from '@/lib/investment';
import { workflow } from '@/lib/expediente';
import {
  emptyOperations,
  validateAudit,
  offerReview,
  validateDiligence,
  freezeBudget,
  validateOrder,
  closingReconciliation,
  type Offer,
  type Diligence,
  type Order,
  type Closing,
} from '@/lib/operations';
import {
  ownerCommand,
  ownerReceipt,
  commitOwner,
  changed,
  ownerFailure,
} from './owner-commit-server';
import { readPostgresWorkspace } from './read-server';
import { authClient } from '@/lib/auth/supabase';
export async function writeOperation(req: Request) {
  try {
    const uid = await ownerCommand(req),
      raw = await req.text();
    if (raw.length > 90000) throw Error('Operación demasiado grande.');
    const b = JSON.parse(raw),
      book = await readPostgresWorkspace(),
      client = await authClient();
    if (typeof b.propertyId !== 'string' || typeof b.updatedAt !== 'string')
      throw Error('Propiedad o versión inválida.');
    const previous = book.properties.find((p) => p.id === b.propertyId);
    if (!previous)
      return Response.json(
        { error: 'Propiedad no encontrada.' },
        { status: 404 },
      );
    if (await ownerReceipt(uid, 'property', b.requestId, b))
      return Response.json(
        { property: attachExecution(previous, book), replayed: true },
        { status: 201, headers: { 'Cache-Control': 'no-store' } },
      );
    if (previous.updatedAt !== b.updatedAt) return changed();
    const p = attachExecution(structuredClone(previous), book),
      at = new Date(
        Math.max(Date.now(), Date.parse(b.updatedAt) + 1),
      ).toISOString();
    validateAudit(b.date, b.reason, at.slice(0, 10));
    const audit = {
        id: crypto.randomUUID(),
        at,
        actor: uid,
        date: b.date,
        reason: b.reason,
      },
      o = p.operations ?? emptyOperations();
    p.operations = o;
    const document = async (id: string) => {
      const d = await client
        .from('property_documents')
        .select('id')
        .eq('id', id)
        .eq('property_id', p.id)
        .maybeSingle();
      if (d.error || !d.data)
        throw Error('Adjunta y selecciona evidencia de este expediente.');
    };
    if (b.action === 'offer') {
      if (o.offers.length >= 60) throw Error('Máximo 60 ofertas/decisiones.');
      const data = b.data as Offer;
      if (
        typeof data.scenarioId !== 'string' ||
        typeof data.parentId !== 'string' ||
        (data.parentId && !o.offers.some((x) => x.id === data.parentId))
      )
        throw Error('Versión u oferta de origen inválida.');
      const response = await client
        .from('analysis_scenarios')
        .select('payload')
        .eq('id', data.scenarioId)
        .eq('property_id', p.id)
        .maybeSingle();
      if (response.error) throw Error('No se pudo consultar el escenario.');
      const source = response.data;
      if (!source)
        throw Error('Selecciona una versión analítica de este expediente.');
      if (data.expires < b.date)
        throw Error('Vencimiento anterior a la oferta.');
      const sourceProperty = source.payload.property as Property;
      const metrics = offerReview(data, sourceProperty);
      o.offers.push({ ...data, ...audit, ...metrics });
    } else if (b.action === 'diligence') {
      if (o.diligenceHistory.length >= 200)
        throw Error('Máximo 200 revisiones de diligencia.');
      const data = b.data as Diligence;
      validateDiligence(data);
      if (data.documentId) await document(data.documentId);
      if (
        !o.diligence.some((x) => x.id === data.id) &&
        o.diligence.length >= 60
      )
        throw Error('Máximo 60 tareas.');
      o.diligence = [...o.diligence.filter((x) => x.id !== data.id), data];
      o.diligenceHistory.push({
        ...audit,
        item: structuredClone(data),
        county: p.county,
      });
    } else if (b.action === 'budget') {
      if (o.budget)
        throw Error('La base ya existe; registra una orden de cambio.');
      o.budget = freezeBudget(p, audit);
      delete p.investment?.forecastRehabOverride;
    } else if (b.action === 'order') {
      if ((o.budget?.orders.length ?? 0) >= 100)
        throw Error('Máximo 100 órdenes de cambio.');
      const data = b.data as Order;
      validateOrder(data, p);
      o.budget!.orders.push({ ...data, ...audit });
      delete p.investment?.forecastRehabOverride;
    } else if (b.action === 'closing') {
      if (o.closing)
        throw Error('El cierre confirmado se conserva y no se sobrescribe.');
      if (b.confirm !== true)
        throw Error('Confirma explícitamente el cierre firmado.');
      const data = b.data as Closing;
      if (data.date !== b.date)
        throw Error(
          'La fecha del cierre debe coincidir con su fecha efectiva.',
        );
      await document(data.documentId);
      const r = closingReconciliation(data, p);
      if (r.errors.length) throw Error(r.errors.join(' '));
      const a = p.investment!,
        before = calculateFlip(p, a);
      if (!workflow(p).responsible)
        throw Error('Indica responsable del expediente.');
      o.closing = {
        ...data,
        ...audit,
        before: {
          purchase: a.purchase ?? 0,
          date: a.purchaseDate,
          totalCost: before.totalCost,
          payoff: before.payoff,
          investment: structuredClone(a),
        },
        difference: r.difference,
        costAdjustment: r.costAdjustment,
        deposit: r.deposit,
        depositRefund: r.depositRefund,
      };
      a.purchase = data.price;
      a.purchaseDate = data.date;
      a.loan.type = data.lender > 0 ? 'Hard money' : 'Efectivo';
      if (a.financing && data.lender > 0) a.financing.selectedId = data.loanId;
      a.cash = {
        ...(a.cash ?? {
          start: data.earnestDate,
          end: a.saleDate,
          opening: 0,
          construction: [],
          contributions: [],
          exit: 'Venta' as const,
          refiProceeds: 0,
          refiConfirmed: false,
          refiReference: '',
        }),
        earnest: data.earnest,
        earnestDate: data.earnestDate,
      };
      if (a.cash.start > data.earnestDate) a.cash.start = data.earnestDate;
      a.cash.opening = 0;
      a.cash.contributions = [
        {
          id: crypto.randomUUID(),
          date: data.earnestDate,
          amount: data.earnest,
          note: 'Depósito real de adquisición',
        },
        {
          id: crypto.randomUUID(),
          date: data.date,
          amount: data.capital,
          note: 'Capital real de cierre',
        },
        ...a.cash.contributions.filter((c) => c.date > data.date),
      ];
      const old = workflow(p);
      p.workflow = { ...old, stage: 'Adquirida' };
      p.workflowHistory = [
        ...(p.workflowHistory ?? []),
        {
          at,
          actor: uid,
          date: data.date,
          reason: 'Cierre confirmado · ' + data.reference,
          before: old,
          after: p.workflow,
        },
      ];
    } else throw Error('Acción no admitida.');
    if (p.investment) validateInvestment(p.investment);
    validateProperty(p);
    delete p.execution;
    if (JSON.stringify(p).length > 900000)
      throw Error('Límite de historial del expediente.');
    const baseline = await client
      .from('analysis_baselines')
      .select('scenario_id')
      .eq('property_id', p.id)
      .maybeSingle();
    if (baseline.error) throw Error('No se pudo verificar la aprobación.');
    const result = await commitOwner(
      uid,
      {
        kind: 'property',
        requestId: b.requestId ?? crypto.randomUUID(),
        property: p,
        propertyId: p.id,
        propertyVersion: b.updatedAt,
        bookVersion: book.version || null,
        baselineId: baseline.data?.scenario_id ?? null,
        module: 'operations:' + b.action,
        audit: {
          reason: b.reason,
          date: b.date,
          changes: changes(previous.operations, p.operations),
        },
      },
      b,
    );
    if (result.replayed) {
      const current = await readPostgresWorkspace(),
        stored = current.properties.find((x) => x.id === p.id);
      if (!stored) return changed();
      return Response.json(
        { property: attachExecution(stored, current), replayed: true },
        { status: 201, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return Response.json(
      {
        property: attachExecution({ ...p, updatedAt: result.updatedAt }, book),
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return ownerFailure(e);
  }
}
