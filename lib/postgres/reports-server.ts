import { env } from 'cloudflare:workers';
import { getAppUser } from '@/lib/auth/identity';
import { authClient } from '@/lib/auth/supabase';
import { previewAccess } from './preview';
import { readPostgresWorkspace } from './read-server';
import {
  ownerCommand,
  ownerReceipt,
  commitOwner,
  ownerFailure,
  changed,
} from './owner-commit-server';
import { attachExecution } from '@/lib/accounting-server';
import { portfolioRows, bankLedger, csvExport } from '@/lib/oversight';
import { redact } from '@/lib/audit';
import { comparison, comparisonCSV } from '@/lib/expense-comparison';
import {
  propertyReport,
  reportSections,
  type ReportSection,
} from '@/lib/reports';
const headers = { 'Cache-Control': 'no-store' };
function reportPreview() {
  return (
    (env as unknown as Record<string, string>)
      .REHAB_POSTGRES_REPORTS_PREVIEW === '1'
  );
}
async function reportRead() {
  if (!(await getAppUser())) throw Error('AUTH');
  if (!previewAccess().read || !reportPreview())
    throw Error('MIGRATION_PENDING');
  return authClient();
}
async function reportCommand(req: Request) {
  const actor = await ownerCommand(req);
  if (!reportPreview()) throw Error('MIGRATION_PENDING');
  return actor;
}
export async function readOversight(req: Request) {
  try {
    const client = await reportRead(),
      q = new URL(req.url).searchParams,
      pid = q.get('propertyId');
    if (q.get('grantId')) throw Error('MIGRATION_PENDING');
    const workspace = await readPostgresWorkspace(),
      { book, version } = workspace,
      all = workspace.properties.map((p) => attachExecution(p, workspace)),
      ps = pid ? all.filter((p) => p.id === pid) : all;
    if (pid && !ps.length)
      return Response.json(
        { error: 'Propiedad no encontrada.' },
        { status: 404, headers },
      );
    const asOf = new Date().toISOString().slice(0, 10);
    if (q.get('export') === 'csv') {
      const data: (string | number | null)[][] = [
        [
          'tipo',
          'id',
          'propiedad_id',
          'fecha',
          'categoria_cuenta',
          'importe_USD',
          'referencia',
          'documento_id',
        ],
      ];
      for (const i of book.invoices.filter((i) => i.approval && !i.void))
        for (const l of i.lines.filter((l) =>
          ps.some((p) => p.id === l.propertyId),
        ))
          data.push([
            i.creditFor ? 'Nota de crédito' : 'Gasto emitido',
            l.id,
            l.propertyId,
            i.date,
            l.bucket,
            (l.subtotal + l.tax) * (i.creditFor ? -1 : 1),
            i.number,
            i.documentId,
          ]);
      for (const r of bankLedger(book).filter((r) =>
        ps.some((p) => p.id === r.propertyId),
      ))
        data.push([
          r.kind,
          r.id,
          r.propertyId,
          r.date,
          r.account,
          r.amount,
          r.reference,
          r.documentId,
        ]);
      for (const p of ps) {
        const r = portfolioRows([p], book, asOf)[0];
        data.push([
          'Deuda principal',
          p.id + ':debt',
          p.id,
          asOf,
          r.lenders.map((l) => l.name).join(' / '),
          r.debt,
          'Saldo calculado; no es gasto',
          book.lifecycle?.[p.id]?.refis.find((x) => x.stage === 'Cierre')
            ?.documentId ??
            p.operations?.closing?.documentId ??
            '',
        ]);
        const c = p.operations?.closing;
        if (c)
          data.push([
            'Capital adquisición',
            c.id + ':capital',
            p.id,
            c.date,
            'Aporte propio',
            c.capital + c.earnest,
            c.reference,
            c.documentId,
          ]);
        const h = book.oversight?.holdings
          .filter((h) => h.propertyId === p.id)
          .at(-1);
        if (h)
          data.push([
            'Inversión histórica',
            h.id,
            p.id,
            h.date,
            'Base de costo',
            h.basis,
            h.reason,
            h.documentId,
          ]);
      }
      return new Response(csvExport(data), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition':
            'attachment; filename="rehab-contabilidad.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }
    const cursor = q.get('before');
    let beforeAt: string | null = null,
      beforeId: string | null = null;
    if (cursor) {
      if (cursor.length > 500) throw Error('Cursor inválido.');
      const split = cursor.indexOf('|');
      beforeAt = split < 0 ? cursor : cursor.slice(0, split);
      beforeId = split < 0 ? null : cursor.slice(split + 1);
      if (
        !/^\d{4}-\d{2}-\d{2}T/.test(beforeAt) ||
        !Number.isFinite(Date.parse(beforeAt))
      )
        throw Error('Cursor inválido.');
    }
    const { data, error } = await client.rpc('owner_audit_page', {
      property_id: pid || null,
      before_at: beforeAt,
      before_id: beforeId,
    });
    if (error) throw Error('No se pudo consultar la auditoría.');
    const page = data.slice(0, 100),
      last = page.at(-1);
    return Response.json(
      {
        book,
        version,
        properties: ps,
        portfolio: portfolioRows(ps, book, asOf),
        audit: page.map((r: any) => ({
          id: r.id,
          propertyId: r.property_id,
          module: r.module,
          ...redact(r.payload),
        })),
        cursor: data.length > 100 ? last.created_at + '|' + last.id : null,
      },
      { headers },
    );
  } catch (e) {
    return ownerFailure(e);
  }
}
export async function readExpenseReports(req: Request) {
  try {
    const client = await reportRead(),
      q = new URL(req.url).searchParams,
      pid = q.get('propertyId'),
      id = q.get('id');
    if (q.get('grantId')) throw Error('MIGRATION_PENDING');
    if (id) {
      const { data, error } = await client
        .from('expense_reports')
        .select('payload')
        .eq('id', id)
        .maybeSingle();
      if (error) throw Error('No se pudo consultar el corte.');
      if (!data)
        return Response.json(
          { error: 'Corte no encontrado.' },
          { status: 404, headers },
        );
      const report = data.payload;
      return q.get('format') === 'csv'
        ? new Response(comparisonCSV(report), {
            headers: {
              ...headers,
              'Content-Type': 'text/csv;charset=utf-8',
              'Content-Disposition':
                'attachment; filename="presupuesto-real-' +
                report.asOf +
                '.csv"',
            },
          })
        : Response.json({ report }, { headers });
    }
    const { data, error } = await client
      .from('expense_reports')
      .select('id,created_at,payload->asOf')
      .eq('property_id', pid ?? '')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(50);
    if (error) throw Error('No se pudieron consultar los cortes.');
    return Response.json({ reports: data }, { headers });
  } catch (e) {
    return ownerFailure(e);
  }
}
export async function saveExpenseReport(req: Request) {
  try {
    const actor = await reportCommand(req),
      raw = await req.text();
    if (raw.length > 2000) throw Error('Solicitud demasiado grande.');
    const body = JSON.parse(raw);
    if (body.grantId) throw Error('MIGRATION_PENDING');
    const client = await authClient(),
      receipt = await ownerReceipt(
        actor,
        'expense-report',
        body.requestId,
        body,
      );
    if (receipt) {
      const r = await client
        .from('expense_reports')
        .select('payload')
        .eq('id', receipt.id)
        .single();
      if (r.error) return changed();
      return Response.json(
        { report: r.data.payload, replayed: true },
        { status: 201, headers },
      );
    }
    const workspace = await readPostgresWorkspace(),
      p = workspace.properties.find(
        (p) => p.id === String(body.propertyId ?? ''),
      );
    if (!p)
      return Response.json(
        { error: 'Propiedad no encontrada.' },
        { status: 404, headers },
      );
    const at = new Date().toISOString(),
      report = {
        ...comparison([p], workspace.book, at),
        bookVersion: workspace.version,
        propertyVersions: [{ id: p.id, version: p.updatedAt }],
      };
    if (JSON.stringify(report).length > 1800000)
      throw Error(
        'Corte demasiado grande; exporta por propiedad con menos movimientos.',
      );
    const result = await commitOwner(
      actor,
      {
        kind: 'expense-report',
        requestId: body.requestId ?? crypto.randomUUID(),
        propertyId: p.id,
        propertyVersion: p.updatedAt,
        bookVersion: workspace.version || null,
        report,
        module: 'expense:report',
        audit: {
          reason: 'Generación de corte de presupuesto y gasto real',
          reportId: report.id,
          propertyVersion: p.updatedAt,
          bookVersion: workspace.version,
        },
      },
      body,
    );
    if (result.replayed) {
      const r = await client
        .from('expense_reports')
        .select('payload')
        .eq('id', result.id)
        .single();
      if (r.error) return changed();
      return Response.json(
        { report: r.data.payload, replayed: true },
        { status: 201, headers },
      );
    }
    return Response.json({ report }, { status: 201, headers });
  } catch (e) {
    return ownerFailure(e);
  }
}
export async function downloadPropertyReport(req: Request) {
  try {
    const actor = await reportCommand(req),
      raw = await req.text();
    if (raw.length > 3000) throw Error('Solicitud demasiado grande.');
    const b = JSON.parse(raw);
    if (b.grantId) throw Error('MIGRATION_PENDING');
    if (
      !Array.isArray(b.sections) ||
      b.sections.length > 8 ||
      !b.sections.length ||
      new Set(b.sections).size !== b.sections.length ||
      b.sections.some((s: string) => !Object.hasOwn(reportSections, s))
    )
      throw Error('Secciones inválidas.');
    const workspace = await readPostgresWorkspace(),
      p = workspace.properties.find((p) => p.id === String(b.propertyId));
    if (!p)
      return Response.json(
        { error: 'Propiedad no encontrada.' },
        { status: 404, headers },
      );
    if (b.version !== p.updatedAt) return changed();
    const client = await authClient(),
      baseline = await client
        .from('analysis_baselines')
        .select('scenario_id')
        .eq('property_id', p.id)
        .maybeSingle();
    if (baseline.error) throw Error('No se pudo consultar la base aprobada.');
    let base: undefined | { id: string; label: string; date: string };
    if (baseline.data) {
      const row = await client
        .from('analysis_scenarios')
        .select('id,label,created_at')
        .eq('id', baseline.data.scenario_id)
        .eq('property_id', p.id)
        .single();
      if (row.error) throw Error('No se pudo consultar el escenario aprobado.');
      base = {
        id: row.data.id,
        label: row.data.label,
        date: row.data.created_at,
      };
    }
    const at = new Date().toISOString(),
      report = propertyReport(
        attachExecution(p, workspace),
        workspace.book,
        workspace.version,
        b.sections as ReportSection[],
        at,
        base,
      );
    await commitOwner(
      actor,
      {
        kind: 'report-download',
        requestId: crypto.randomUUID(),
        propertyId: p.id,
        propertyVersion: p.updatedAt,
        bookVersion: workspace.version || null,
        baselineId: base?.id ?? null,
        reportId: report.id,
        module: 'report:download',
        audit: {
          reason: 'Generación de reporte descargable',
          reportId: report.id,
          sections: b.sections,
          propertyVersion: p.updatedAt,
          bookVersion: workspace.version,
        },
      },
      b,
    );
    return new Response(report.html, {
      headers: {
        ...headers,
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition':
          'attachment; filename="rehab-reporte-' + at.slice(0, 10) + '.html"',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return ownerFailure(e);
  }
}
