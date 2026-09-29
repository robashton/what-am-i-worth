import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES, getMode, multiples, parseAmount, computeValuation, FIELD_IDS, MAX_AMOUNT,
} from '../site/js/valuation.js';
import { formatMoney } from '../site/js/format.js';

const approx = (a, e) => Math.abs(a - e) <= 1e-9 * Math.max(1, Math.abs(e));
function near(actual, expected, msg) {
  assert.ok(approx(actual, expected), `${msg || ''} expected ~${expected}, got ${actual}`);
}

const hype = MODES.hype;
const seriesH = MODES.seriesH;

const scenarioA = {
  income: 50000, savings: 10000, mortgage: 200000, creditCards: 5000,
  carFinance: 10000, studentLoans: 20000, otherLoans: 0,
};
const scenarioD = { income: 85000, savings: 15000, mortgage: 300000, creditCards: 2500 };

test('multiples per mode', () => {
  const h = multiples(hype);
  near(h.revenueMultiple, 435.7298474945534);
  near(h.lossMultiple, 47.61904761904762);
  near(h.lossToRevenue, 9.15032679738562);
  const s = multiples(seriesH);
  near(s.revenueMultiple, 14.846153846153847);
  near(s.lossMultiple, 22.976190476190474);
  near(s.lossToRevenue, 0.6461538461538462);
});

test('getMode', () => {
  assert.equal(getMode('hype'), hype);
  assert.equal(getMode('seriesH'), seriesH);
  assert.throws(() => getMode('nope'), Error);
  assert.throws(() => getMode('toString'), Error);
});

test('Scenario A, hype', () => {
  const r = computeValuation(scenarioA, hype);
  assert.equal(r.modeId, 'hype');
  assert.equal(r.totalDebt, 235000);
  assert.equal(r.income, 50000);
  assert.equal(r.assets, 10000);
  near(r.terms.revenue, 21786492.37472767);
  near(r.terms.debt, 11190476.19047619);
  near(r.terms.assets, 10000);
  near(r.total, 32986968.56520386);
  assert.equal(formatMoney(r.total), '$32.99M');
  near(r.debtToIncome, 4.7);
  near(r.visionaryPct, 51.36428571428571);
  assert.equal(r.edgeCase, 'normal');
  assert.equal(r.exceedsAnthropic, false);
});

test('Scenario A, seriesH', () => {
  const r = computeValuation(scenarioA, seriesH);
  near(r.terms.revenue, 742307.6923076924);
  near(r.terms.debt, 5399404.761904761);
  near(r.terms.assets, 10000);
  near(r.total, 6151712.454212453);
  assert.equal(formatMoney(r.total), '$6.15M');
  near(r.visionaryPct, 727.3809523809524);
});

test('Scenario D', () => {
  const h = computeValuation(scenarioD, hype);
  assert.equal(h.totalDebt, 302500);
  near(h.terms.revenue, 37037037.03703704);
  near(h.terms.debt, 14404761.904761905);
  near(h.terms.assets, 15000);
  near(h.total, 51456798.94179894);
  const s = computeValuation(scenarioD, seriesH);
  near(s.terms.revenue, 1261923.076923077);
  near(s.terms.debt, 6950297.6190476185);
  near(s.terms.assets, 15000);
  near(s.total, 8227220.6959706955);
});

test('edge case: all blank', () => {
  for (const mode of [hype, seriesH]) {
    const r = computeValuation({}, mode);
    assert.equal(r.total, 0);
    assert.equal(r.edgeCase, 'all-zero');
    assert.equal(r.debtToIncome, null);
    assert.equal(r.visionaryPct, null);
  }
});

test('edge case: pre-revenue', () => {
  const h = computeValuation({ otherLoans: 1000 }, hype);
  near(h.total, 47619.04761904762);
  assert.equal(h.edgeCase, 'pre-revenue');
  assert.equal(h.debtToIncome, null);
  const s = computeValuation({ otherLoans: 1000 }, seriesH);
  near(s.total, 22976.190476190473);
  assert.equal(s.edgeCase, 'pre-revenue');
});

test('edge case: assets only', () => {
  for (const mode of [hype, seriesH]) {
    const r = computeValuation({ savings: 10000 }, mode);
    assert.equal(r.total, 10000);
    assert.equal(r.edgeCase, 'assets-only');
  }
});

test('edge case: debt free', () => {
  const h = computeValuation({ income: 100000 }, hype);
  near(h.total, 43572984.74945534);
  assert.equal(h.edgeCase, 'debt-free');
  const s = computeValuation({ income: 100000 }, seriesH);
  near(s.total, 1484615.3846153847);
  assert.equal(s.edgeCase, 'debt-free');
});

test('exceeds Anthropic', () => {
  const h = computeValuation({ income: 5e9 }, hype);
  near(h.total, 2178649237472.767);
  assert.equal(h.exceedsAnthropic, true);
  const s = computeValuation({ income: 5e9 }, seriesH);
  near(s.total, 74230769230.76923);
  assert.equal(s.exceedsAnthropic, false);
});

test('extremes stay finite', () => {
  const all = Object.fromEntries(FIELD_IDS.map((id) => [id, MAX_AMOUNT]));
  for (const mode of [hype, seriesH]) {
    const r = computeValuation(all, mode);
    assert.ok(Number.isFinite(r.total));
    assert.ok(r.total > 0);
  }
});

test('invalid input throws', () => {
  assert.throws(() => computeValuation({ income: -1 }, hype), RangeError);
  assert.throws(() => computeValuation({ income: NaN }, hype), RangeError);
  assert.throws(() => computeValuation({ savings: Infinity }, hype), RangeError);
});

test('parseAmount table', () => {
  const ok = [
    ['', 0], ['   ', 0], [undefined, 0], [null, 0], ['50000', 50000], ['50,000', 50000],
    ['$50,000.50', 50000.5], [' 1 000 ', 1000], ['.5', 0.5], ['0', 0],
    ['1000000000000000', 1e15], ['1_000', 1000], ['5.', 5], ['$', 0],
  ];
  for (const [input, value] of ok) {
    assert.deepEqual(parseAmount(input), { ok: true, value }, `parseAmount(${JSON.stringify(input)})`);
  }
  const bad = [
    ['-5', 'negative'], ['-$5', 'negative'], ['$-5', 'negative'],
    ['abc', 'invalid'], ['1e5', 'invalid'], ['1.2.3', 'invalid'], ['.', 'invalid'],
    ['Infinity', 'invalid'], ['50k', 'invalid'],
    ['1000000000000001', 'too-large'],
  ];
  for (const [input, error] of bad) {
    assert.deepEqual(parseAmount(input), { ok: false, error }, `parseAmount(${JSON.stringify(input)})`);
  }
});

test('MODES structure', () => {
  assert.ok(Object.isFrozen(MODES));
  for (const mode of Object.values(MODES)) {
    assert.ok(Object.isFrozen(mode));
    assert.ok(Object.isFrozen(mode.notes));
    assert.ok(Object.isFrozen(mode.sources));
    assert.ok(mode.sources.length >= 1);
    for (const s of mode.sources) {
      assert.ok(Object.isFrozen(s));
      assert.match(s.url, /^https:\/\//);
      assert.ok(s.label.length > 0);
    }
  }
});
