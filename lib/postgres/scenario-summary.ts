/** A historical projection only: never recalculate or coerce absent amounts to zero. */
const metricKeys = [
  'purchase',
  'arv',
  'rehab',
  'interest',
  'financeFees',
  'totalCost',
  'profit',
  'margin',
] as const;
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export function scenarioSummary(payload: unknown) {
  const saved = record(payload),
    result = record(saved.result);
  const metrics = Object.fromEntries(
    metricKeys.map((k) => [
      k,
      typeof result[k] === 'number' && Number.isFinite(result[k])
        ? result[k]
        : null,
    ]),
  ) as Record<(typeof metricKeys)[number], number | null>;
  const strings = (v: unknown) =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
  return {
    metrics,
    missing: strings(result.missing),
    warnings: strings(result.warnings),
    checksRecorded:
      Array.isArray(result.missing) &&
      result.missing.every((s) => typeof s === 'string'),
    engine: typeof saved.engine === 'string' ? saved.engine : null,
  };
}
export type ScenarioSummary = ReturnType<typeof scenarioSummary>;
