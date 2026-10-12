import assert from 'node:assert/strict';
import { scenarioSummary } from './scenario-summary';
const payload = {
  engine: 'historical',
  property: { private: 'not projected' },
  result: {
    purchase: 0,
    profit: -12.34,
    margin: -0.125,
    arv: '500000',
    rehab: null,
    totalCost: Infinity,
    missing: ['ARV', null],
    warnings: ['Revisar', {}],
  },
};
const before = structuredClone(payload),
  s = scenarioSummary(payload);
assert.equal(s.metrics.purchase, 0);
assert.equal(s.metrics.profit, -12.34);
assert.equal(s.metrics.margin, -0.125);
assert.equal(s.metrics.arv, null);
assert.equal(s.metrics.rehab, null);
assert.equal(s.metrics.totalCost, null);
assert.deepEqual(s.missing, ['ARV']);
assert.deepEqual(s.warnings, ['Revisar']);
assert.equal(s.checksRecorded, false);
assert(!('property' in s));
assert.deepEqual(payload, before);
for (const value of [
  null,
  {},
  [],
  { result: null },
  { result: [] },
  { result: 'bad' },
]) {
  const result = scenarioSummary(value);
  assert(Object.values(result.metrics).every((v) => v === null));
  assert.equal(result.checksRecorded, false);
}
assert.equal(scenarioSummary({ result: { missing: [] } }).checksRecorded, true);
console.log(
  'PASS historical summary preserves zero/negative values, rejects invalid numbers, identifies missing checks and never mutates snapshots',
);
