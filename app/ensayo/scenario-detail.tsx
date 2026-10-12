'use client';
import { useEffect, useState } from 'react';
import type { ScenarioSummary } from '@/lib/postgres/scenario-summary';
import styles from './workspace.module.css';
type Detail = ScenarioSummary & {
  id: string;
  label: string;
  sourceId: string | null;
  createdAt: string;
};
const labels: Record<keyof ScenarioSummary['metrics'], string> = {
  purchase: 'Compra',
  arv: 'Valor de venta previsto (ARV)',
  rehab: 'Remodelación',
  interest: 'Intereses',
  financeFees: 'Cargos financieros',
  totalCost: 'Costo total',
  profit: 'Utilidad prevista',
  margin: 'Margen sobre venta',
};
const usd = new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency: 'USD',
  }),
  percent = new Intl.NumberFormat('es-US', {
    style: 'percent',
    maximumFractionDigits: 2,
  });
export default function ScenarioDetail({
  propertyId,
  id,
}: {
  propertyId: string;
  id: string;
}) {
  const [data, setData] = useState<Detail | null>(null),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    (async () => {
      const r = await fetch(
        '/api/preview/scenarios?' + new URLSearchParams({ propertyId, id }),
        { cache: 'no-store' },
      );
      const body = (await r.json()) as { scenario?: Detail; error?: string };
      if (!r.ok || !body.scenario)
        throw Error(
          r.status === 401
            ? 'Tu sesión terminó. Inicia sesión de nuevo.'
            : body.error || 'No se pudo consultar el escenario.',
        );
      if (active) setData(body.scenario);
    })().catch((e) => {
      if (active)
        setError(
          e instanceof Error ? e.message : 'No se pudo consultar el escenario.',
        );
    });
    return () => {
      active = false;
    };
  }, [propertyId, id, attempt]);
  return (
    <section aria-label="Detalle del escenario" className={styles.detail}>
      {!data && !error && <p role="status">Cargando detalle…</p>}
      {error && (
        <>
          <p role="alert">{error}</p>
          <button type="button" onClick={() => setAttempt((a) => a + 1)}>
            Reintentar consulta
          </button>
        </>
      )}
      {data && (
        <>
          <h4>{data.label}</h4>
          <p>
            Cifras guardadas en este escenario. No se recalculan con los cambios
            actuales del expediente.
          </p>
          <p>
            Guardado:{' '}
            <time dateTime={data.createdAt}>
              {Number.isFinite(Date.parse(data.createdAt))
                ? new Intl.DateTimeFormat('es-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'America/New_York',
                  }).format(new Date(data.createdAt)) + ' (Atlanta)'
                : 'Fecha no disponible'}
            </time>
          </p>
          <dl className={styles.metrics}>
            {Object.entries(labels).map(([key, label]) => {
              const value = data.metrics[key as keyof typeof labels];
              return (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {value === null
                      ? 'No registrado'
                      : key === 'margin'
                        ? percent.format(value)
                        : usd.format(value)}
                  </dd>
                </div>
              );
            })}
          </dl>
          {!data.checksRecorded && (
            <p>
              No hay una revisión de datos pendientes registrada para esta
              versión.
            </p>
          )}
          {!!data.missing.length && (
            <>
              <h4>Datos pendientes al guardar</h4>
              <ul>
                {data.missing.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </>
          )}
          {!!data.warnings.length && (
            <>
              <h4>Observaciones guardadas</h4>
              <ul>
                {data.warnings.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
