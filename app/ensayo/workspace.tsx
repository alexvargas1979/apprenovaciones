'use client';
import { useEffect, useRef, useState } from 'react';
import styles from './workspace.module.css';
import ScenarioDetail from './scenario-detail';
type Property = {
  id: string;
  name: string;
  address?: string;
  updatedAt: string;
};
type Versions = {
  stressOptions?: { index: number; name: string }[];
  propertyId: string;
  version: string;
  bookVersion: string | null;
  baseId: string | null;
  scenarios: {
    id: string;
    label: string;
    source_id: string | null;
    created_at: string;
  }[];
};
async function request<T = unknown>(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, cache: 'no-store' });
  const data = (await r.json()) as T & { error?: string };
  if (!r.ok)
    throw Error(
      r.status === 401
        ? 'Tu sesión terminó. Vuelve a Mi cuenta e inicia sesión.'
        : data.error || 'No se pudo completar la solicitud.',
    );
  return data;
}
export default function Workspace({ writable }: { writable: boolean }) {
  const [properties, setProperties] = useState<Property[]>([]),
    [selected, setSelected] = useState(''),
    [versions, setVersions] = useState<Versions | null>(null);
  const [detailId, setDetailId] = useState('');
  const [saveLabel, setSaveLabel] = useState('');
  const [stressLabel, setStressLabel] = useState(''),
    [stressIndex, setStressIndex] = useState('');
  const [approveLabel, setApproveLabel] = useState(''),
    [confirmApproval, setConfirmApproval] = useState(false);
  const [name, setName] = useState(''),
    [reason, setReason] = useState(''),
    [source, setSource] = useState(''),
    [label, setLabel] = useState('');
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [revision, setRevision] = useState(0);
  // Keep each unresolved command's receipt identity, even if the user edits
  // another command and then returns to the original after a lost response.
  const pending = useRef(new Map<string, string>());
  const property = properties.find((p) => p.id === selected);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setVersions(null);
    setError('');
    (async () => {
      const data = await request<{ properties: Property[] }>('/api/properties');
      if (!active) return;
      setProperties(data.properties);
      const id = data.properties.some((p: Property) => p.id === selected)
        ? selected
        : data.properties[0]?.id || '';
      if (id !== selected) {
        setSelected(id);
        return;
      }
      if (!id) return;
      const result = await request<Versions>(
        '/api/preview/scenarios?propertyId=' + encodeURIComponent(id),
      );
      if (!active) return;
      setVersions(result);
      setName(data.properties.find((p: Property) => p.id === id)!.name);
      setReason('');
      setLabel('');
      setSaveLabel('');
      setStressLabel('');
      setStressIndex(
        result.stressOptions?.length
          ? String(result.stressOptions[0].index)
          : '',
      );
      setApproveLabel('');
      setConfirmApproval(false);
      setSource(result.scenarios[0]?.id || '');
    })()
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selected, revision]);
  async function mutate(
    kind: 'name' | 'duplicate' | 'save' | 'approve' | 'stress',
  ) {
    if (
      !writable ||
      loading ||
      !property ||
      !versions ||
      busy ||
      versions.propertyId !== property.id
    )
      return;
    if (kind === 'approve' && (!confirmApproval || versions.baseId)) return;
    if (
      kind === 'stress' &&
      !versions.stressOptions?.some((s) => s.index === Number(stressIndex))
    )
      return;
    setBusy(true);
    setError('');
    setNotice('');
    const url =
      kind === 'name'
        ? '/api/properties/name'
        : kind === 'save'
          ? '/api/scenarios/save'
          : kind === 'approve'
            ? '/api/scenarios/approve'
            : kind === 'stress'
              ? '/api/scenarios/stress'
              : '/api/scenarios/duplicate';
    const body =
      kind === 'name'
        ? {
            id: property.id,
            version: property.updatedAt,
            name: name.trim(),
            reason: reason.trim(),
          }
        : {
            propertyId: property.id,
            ...(kind === 'duplicate' ? { sourceId: source } : {}),
            version: versions.version,
            bookVersion: versions.bookVersion,
            label:
              kind === 'save'
                ? saveLabel.trim()
                : kind === 'approve'
                  ? approveLabel.trim()
                  : kind === 'stress'
                    ? stressLabel.trim()
                    : label.trim(),
            ...(kind === 'approve' ? { confirm: true } : {}),
            ...(kind === 'stress' ? { stressIndex: Number(stressIndex) } : {}),
          };
    const key = JSON.stringify({ url, body });
    const requestId = pending.current.get(key) ?? crypto.randomUUID();
    pending.current.set(key, requestId);
    try {
      await request(url, {
        method: kind === 'name' ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, requestId }),
      });
      pending.current.delete(key);
      setNotice(
        kind === 'name'
          ? 'Nombre guardado.'
          : kind === 'save'
            ? 'Nuevo escenario guardado.'
            : kind === 'approve'
              ? 'Base aprobada y conservada.'
              : kind === 'stress'
                ? 'Prueba de estrés guardada. La base aprobada se conserva.'
                : 'Escenario duplicado. La base aprobada se conserva.',
      );
      setVersions(null);
      setRevision((v) => v + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo completar la operación.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href="/cuenta">← Mi cuenta</a>
        <strong>Rehab Atlanta</strong>
        <span className={styles.badge}>Prueba local</span>
      </header>
      <main className={styles.main}>
        <h1>Mi cartera</h1>
        <p className={styles.lead}>
          Consulta tus propiedades y prueba los primeros cambios de la
          migración.
        </p>
        <aside className={styles.info}>
          {writable
            ? 'Disponible: consultar propiedades, cambiar su nombre, guardar y duplicar escenarios.'
            : 'Modo de consulta: los cambios están desactivados.'}{' '}
          La edición financiera, las facturas y los archivos siguen pendientes
          en esta pantalla.
        </aside>
        <div className={styles.toolbar}>
          <label>
            Propiedad
            <select
              value={selected}
              disabled={busy || loading}
              onChange={(e) => {
                setDetailId('');
                setSelected(e.target.value);
                setNotice('');
              }}
            >
              <option value="" disabled>
                Selecciona una propiedad
              </option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => {
              setNotice('');
              setRevision((v) => v + 1);
            }}
          >
            Recargar datos
          </button>
        </div>
        <p role="status" aria-live="polite">
          {loading ? 'Cargando cartera…' : notice}
        </p>
        {error && (
          <p className={styles.error} role="alert">
            {error} Puedes recargar los datos; se descartarán los campos sin
            guardar.
          </p>
        )}
        {!loading && !error && !properties.length && (
          <section className={styles.card}>
            <h2>Aún no hay propiedades</h2>
            <p>
              Esta cuenta no tiene propiedades en el entorno de prueba. La
              importación de tu cartera real está pendiente.
            </p>
          </section>
        )}
        {property && (
          <>
            <h2>{property.name}</h2>
            {property.address && <p>{property.address}</p>}
            <div className={styles.grid}>
              <section className={styles.card}>
                <h3>Nombre del expediente</h3>
                <p>El motivo quedará registrado en el historial.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutate('name');
                  }}
                >
                  <fieldset
                    disabled={!writable || busy || loading || !versions}
                  >
                    <label>
                      Nombre
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        maxLength={180}
                      />
                    </label>
                    <label>
                      Motivo del cambio
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        required
                        maxLength={1000}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={
                        !name.trim() ||
                        name.trim() === property.name ||
                        !reason.trim()
                      }
                    >
                      Guardar nombre
                    </button>
                  </fieldset>
                </form>
              </section>
              <section className={styles.card}>
                <h3>Versiones del análisis</h3>
                <p>
                  Guarda una versión calculada desde el análisis que ya tiene la
                  propiedad. No reemplaza la base aprobada.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutate('save');
                  }}
                >
                  <fieldset
                    disabled={
                      !writable ||
                      busy ||
                      loading ||
                      !versions ||
                      versions.scenarios.length >= 50
                    }
                  >
                    <label>
                      Nombre del nuevo escenario
                      <input
                        value={saveLabel}
                        onChange={(e) => setSaveLabel(e.target.value)}
                        required
                        maxLength={100}
                      />
                    </label>
                    <button type="submit" disabled={!saveLabel.trim()}>
                      Guardar nuevo escenario
                    </button>
                  </fieldset>
                </form>
                {versions?.baseId ? (
                  <p>
                    La base aprobada ya está fijada y se conserva. Puedes
                    guardar nuevas versiones para el pronóstico.
                  </p>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void mutate('approve');
                    }}
                  >
                    <h4>Fijar la base del análisis</h4>
                    <p>
                      Se calculará una nueva versión con el análisis actual.
                      Después de aprobarla, esta base no se reemplaza.
                    </p>
                    <fieldset
                      disabled={
                        !writable ||
                        busy ||
                        loading ||
                        !versions ||
                        versions.scenarios.length >= 50
                      }
                    >
                      <label>
                        Nombre de la base
                        <input
                          value={approveLabel}
                          onChange={(e) => setApproveLabel(e.target.value)}
                          maxLength={100}
                          required
                        />
                      </label>
                      <label className={styles.confirmation}>
                        Confirmo que revisé el análisis y deseo fijar esta base
                        <input
                          type="checkbox"
                          checked={confirmApproval}
                          onChange={(e) => setConfirmApproval(e.target.checked)}
                          required
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={!approveLabel.trim() || !confirmApproval}
                      >
                        Aprobar base del análisis
                      </button>
                    </fieldset>
                  </form>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutate('stress');
                  }}
                >
                  <h4>Guardar prueba de estrés</h4>
                  <p>
                    Aplica los ajustes registrados a una nueva versión, sin
                    modificar la propiedad ni su base aprobada.
                  </p>
                  {versions && !versions.stressOptions?.length && (
                    <p>No hay pruebas de estrés configuradas en el análisis.</p>
                  )}
                  <fieldset
                    disabled={
                      !writable ||
                      busy ||
                      loading ||
                      !versions ||
                      !versions.stressOptions?.length ||
                      versions.scenarios.length >= 50
                    }
                  >
                    <label>
                      Prueba registrada
                      <select
                        value={stressIndex}
                        onChange={(e) => setStressIndex(e.target.value)}
                        required
                      >
                        <option value="" disabled>
                          Selecciona una prueba
                        </option>
                        {versions?.stressOptions?.map((s) => (
                          <option key={s.index} value={s.index}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Nombre del escenario de estrés
                      <input
                        value={stressLabel}
                        onChange={(e) => setStressLabel(e.target.value)}
                        required
                        maxLength={100}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={!stressLabel.trim() || stressIndex === ''}
                    >
                      Guardar prueba de estrés
                    </button>
                  </fieldset>
                </form>
                <p>Una copia conserva los cálculos del escenario original.</p>
                {versions && !versions.scenarios.length && (
                  <p>No hay escenarios guardados para duplicar.</p>
                )}
                <ul className={styles.list}>
                  {versions?.scenarios.map((s) => (
                    <li key={s.id}>
                      {s.label}
                      <button
                        type="button"
                        className={styles.detailButton}
                        aria-expanded={detailId === s.id}
                        onClick={() =>
                          setDetailId(detailId === s.id ? '' : s.id)
                        }
                      >
                        {detailId === s.id
                          ? 'Cerrar detalle: '
                          : 'Ver detalle: '}
                        {s.label}
                      </button>
                      {s.id === versions.baseId && (
                        <span className={styles.badge}>Base aprobada</span>
                      )}
                    </li>
                  ))}
                </ul>
                {detailId &&
                  versions?.scenarios.some((s) => s.id === detailId) && (
                    <ScenarioDetail
                      key={property.id + ':' + detailId}
                      propertyId={property.id}
                      id={detailId}
                    />
                  )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutate('duplicate');
                  }}
                >
                  <fieldset
                    disabled={
                      !writable ||
                      busy ||
                      loading ||
                      !versions ||
                      !versions.scenarios.length ||
                      versions.scenarios.length >= 50
                    }
                  >
                    <label>
                      Escenario de origen
                      <select
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        required
                      >
                        <option value="" disabled>
                          Selecciona un escenario
                        </option>
                        {versions?.scenarios.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Nombre de la copia
                      <input
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        maxLength={100}
                        required
                      />
                    </label>
                    <button type="submit" disabled={!label.trim() || !source}>
                      Duplicar escenario
                    </button>
                  </fieldset>
                </form>
                {versions && versions.scenarios.length >= 50 && (
                  <p>Se alcanzó el máximo de 50 versiones.</p>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
