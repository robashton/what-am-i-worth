import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, AS_OF, DATASET_NOTE, pickComparisons } from '../site/js/comparisons.js';
import { MODES } from '../site/js/valuation.js';

const F = [
  { id: 'a', value: 1e3 },
  { id: 'b', value: 1e4, unit: { singular: 'b', plural: 'bs' } },
  { id: 'c', value: 1e5 },
  { id: 'd', value: 1e6, unit: { singular: 'd', plural: 'ds' } },
  { id: 'e', value: 1e7 },
  { id: 'f', value: 1e8 },
];
const snapshot = JSON.stringify(F);

const ids = (picks) => picks.nearest.map((n) => n.item.id);
const near = (a, e) => Math.abs(a - e) <= 1e-9 * Math.max(1, Math.abs(e));

test('fixture: guard for non-positive values', () => {
  for (const v of [0, -1, NaN]) {
    assert.deepEqual(pickComparisons(v, F), { nearest: [], conversion: null });
  }
});

test('fixture: picker table', () => {
  const table = [
    [1e3, 'b', 0.1, ['a', 'c', 'd']],
    [5e4, 'b', 5, ['a', 'c', 'd']],
    [1e4, 'b', 1, ['a', 'c', 'd']],
    [1e6, 'b', 100, ['c', 'd', 'e']],
    [1e7, 'd', 10, ['c', 'e', 'f']],
    [1e8, 'd', 100, ['c', 'e', 'f']],
  ];
  for (const [value, convId, convCount, nearestIds] of table) {
    const p = pickComparisons(value, F);
    assert.equal(p.conversion.item.id, convId, `conversion for ${value}`);
    assert.ok(near(p.conversion.count, convCount), `count for ${value}: ${p.conversion.count}`);
    assert.deepEqual(ids(p), nearestIds, `nearest for ${value}`);
  }
});

test('fixture: relations', () => {
  const p1 = pickComparisons(1e3, F);
  assert.equal(p1.nearest[0].relation, 'about');
  assert.equal(p1.nearest[1].relation, 'less');
  const p2 = pickComparisons(1e6, F);
  assert.deepEqual(p2.nearest.map((n) => n.relation), ['more', 'about', 'less']);
  assert.ok(near(p2.nearest[0].ratio, 10));
});

test('fixture: count option', () => {
  const p = pickComparisons(1e4, F, { count: 1 });
  assert.equal(p.conversion.item.id, 'b');
  assert.deepEqual(ids(p), ['a']);
});

test('fixture: no unit items gives null conversion', () => {
  const noUnits = F.filter((i) => !i.unit);
  const p = pickComparisons(1e5, noUnits);
  assert.equal(p.conversion, null);
  assert.equal(p.nearest.length, 3);
});

test('fixture: inputs not mutated', () => {
  assert.equal(JSON.stringify(F), snapshot);
});

test('dataset: shape', () => {
  const seen = new Set();
  for (const item of ITEMS) {
    assert.ok(!seen.has(item.id), `duplicate id ${item.id}`);
    seen.add(item.id);
    assert.ok(Number.isFinite(item.value) && item.value > 0, item.id);
    assert.ok(typeof item.name === 'string' && item.name.length > 0, item.id);
    assert.ok(typeof item.note === 'string' && item.note.length > 0, item.id);
  }
  for (let i = 1; i < ITEMS.length; i += 1) {
    assert.ok(ITEMS[i].value >= ITEMS[i - 1].value, `ascending at ${ITEMS[i].id}`);
  }
  assert.ok(ITEMS.length >= 30 && ITEMS.length <= 40, `length ${ITEMS.length}`);
  assert.ok(ITEMS[0].value <= 1500);
  assert.ok(ITEMS[ITEMS.length - 1].value >= 1e13);
  assert.ok(Object.isFrozen(ITEMS));
});

test('dataset: unit items', () => {
  const units = ITEMS.filter((i) => i.unit);
  assert.ok(units.length >= 4);
  for (const i of units) {
    assert.ok(i.unit.singular.length > 0 && i.unit.plural.length > 0, i.id);
  }
  const unitIds = units.map((i) => i.id);
  assert.ok(unitIds.includes('h100'));
  assert.ok(unitIds.includes('twitter'));
});

test('dataset: Anthropic items come from MODES', () => {
  const byId = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
  assert.equal(byId['anthropic-seriesh'].value, MODES.seriesH.valuation);
  assert.equal(byId['anthropic-ipo'].value, MODES.hype.valuation);
});

test('dataset: metadata', () => {
  assert.match(AS_OF, /^\d{4}-\d{2}$/);
  assert.ok(DATASET_NOTE.length > 0);
});

test('dataset: sweep 10^0 .. 10^18', () => {
  for (let k = 0; k <= 18; k += 0.5) {
    const p = pickComparisons(10 ** k);
    assert.equal(p.nearest.length, 3, `k=${k}`);
    const nearestIds = ids(p);
    assert.equal(new Set(nearestIds).size, 3, `k=${k} distinct`);
    assert.ok(p.conversion !== null, `k=${k} conversion`);
    assert.ok(!nearestIds.includes(p.conversion.item.id), `k=${k} conversion not in nearest`);
  }
});

test('dataset: sanity for Scenario A hype and $1bn', () => {
  const a = pickComparisons(32986968.56520386);
  assert.equal(a.conversion.item.id, 'bugatti');
  assert.deepEqual(ids(a), ['tuvalu-gdp', 'g650', 'beeple']);
  const b = pickComparisons(1e9);
  assert.equal(b.conversion.item.id, 'bugatti');
  assert.deepEqual(ids(b), ['instagram', 'burj', 'youtube']);
});
