import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeResult, describeComparison, describeConversion, FIELD_ERRORS, COMPS_EMPTY, shareText,
} from '../site/js/copy.js';
import { MODES, computeValuation, FIELD_IDS, MAX_AMOUNT } from '../site/js/valuation.js';
import { pickComparisons } from '../site/js/comparisons.js';

const scenarioA = {
  income: 50000, savings: 10000, mortgage: 200000, creditCards: 5000,
  carFinance: 10000, studentLoans: 20000, otherLoans: 0,
};

function view(inputs, modeId) {
  const mode = MODES[modeId];
  const result = computeValuation(inputs, mode);
  return describeResult(result, mode, pickComparisons(result.total));
}

test('field errors exist for every parse error', () => {
  for (const key of ['negative', 'invalid', 'too-large']) {
    assert.ok(FIELD_ERRORS[key].length > 0);
  }
});

test('Scenario A, hype', () => {
  const v = view(scenarioA, 'hype');
  assert.equal(v.headline, 'Your household has been priced.');
  assert.equal(v.subtitle, 'Indicative valuation on an IPO hype basis: $32.99M.');
  assert.equal(v.totalText, '$32.99M');
  assert.equal(v.modeId, 'hype');
  assert.equal(v.otherModeId, 'seriesH');
  assert.equal(v.otherModeLabel, 'Series H mode');
  assert.deepEqual(v.notices, []);
  assert.deepEqual(v.breakdown.map((r) => r.value), ['$21.79M', '$11.19M', '$10,000', '$32.99M']);
  assert.equal(v.breakdown[0].basis, '$50,000 x 435.7x');
  assert.equal(v.breakdown[1].basis, '$235,000 x 47.6x');
  assert.equal(v.breakdown[2].basis, '$10,000 x 1.0x');
  assert.equal(v.breakdown[3].isTotal, true);
  assert.deepEqual(v.oneLiners, [
    'Revenue multiple: 435.7x. Your $50,000 salary is now annual recurring revenue.',
    'Loss multiple: 47.6x. Your $235,000 of debt has been reframed as strategic investment in growth.',
    'Savings valued at par: $10,000 is worth $10,000. How quaint.',
    "Debt-to-income ratio: 4.7. Anthropic's loss-to-revenue ratio: 9.2. You are 51% as visionary.",
  ]);
  assert.equal(v.comps.length, 3);
  assert.equal(v.compsEmpty, null);
  assert.equal(v.conversion, 'In unit economics, that is 11 Bugatti Chirons.');
});

test('Scenario A, seriesH', () => {
  const v = view(scenarioA, 'seriesH');
  assert.equal(v.headline, 'Your household has been priced.');
  assert.equal(v.subtitle, 'Indicative valuation on a Series H basis: $6.15M.');
  assert.equal(v.totalText, '$6.15M');
  assert.equal(v.otherModeId, 'hype');
  assert.deepEqual(v.oneLiners, [
    'Revenue multiple: 14.8x. Your $50,000 salary is now annual recurring revenue.',
    'Loss multiple: 23.0x. Your $235,000 of debt has been reframed as strategic investment in growth.',
    'Savings valued at par: $10,000 is worth $10,000. How quaint.',
    "Debt-to-income ratio: 4.7. Anthropic's loss-to-revenue ratio: 0.6. You are 727% as visionary.",
  ]);
});

test('all zero', () => {
  const v = view({}, 'hype');
  assert.equal(v.headline, 'Pre-revenue, pre-debt: pure vision.');
  assert.equal(v.subtitle, 'Seed round incoming. Current valuation: $0, which is also the going rate for most pitch decks.');
  assert.equal(v.totalText, '$0');
  assert.deepEqual(v.comps, []);
  assert.equal(v.compsEmpty, COMPS_EMPTY);
  assert.equal(v.compsEmpty, 'Comparable transactions: none. You are category-defining.');
  assert.equal(v.conversion, null);
  assert.deepEqual(v.oneLiners, []);
});

test('pre-revenue', () => {
  const v = view({ otherLoans: 1000 }, 'hype');
  assert.equal(v.headline, 'Pre-revenue. Heavily leveraged. Extremely fundable.');
  assert.ok(v.subtitle.includes('$1,000'));
  assert.ok(v.subtitle.includes('$47,619'));
});

test('assets-only and debt-free headlines', () => {
  const a = view({ savings: 10000 }, 'hype');
  assert.equal(a.headline, 'Asset-rich, growth-poor. The market is unmoved.');
  assert.equal(a.subtitle, 'Your $10,000 of savings was valued at par. Have you considered borrowing heavily?');
  const d = view({ income: 100000 }, 'hype');
  assert.equal(d.headline, 'Zero debt? Where is your ambition?');
  assert.ok(d.subtitle.endsWith('still value you at $43.57M.'));
});

test('exceeds Anthropic notice', () => {
  const v = view({ income: 5e9 }, 'hype');
  assert.ok(v.notices[0].startsWith('You are now worth more than Anthropic ($2.00tn)'));
  const s = view({ income: 5e9 }, 'seriesH');
  assert.deepEqual(s.notices, []);
});

test('quadrillion notice', () => {
  const all = Object.fromEntries(FIELD_IDS.map((id) => [id, MAX_AMOUNT]));
  const v = view(all, 'hype');
  assert.ok(v.notices.includes('Your valuation is now denominated in quadrillions. Economists would like a word.'));
  assert.match(v.totalText, / quadrillion$/);
});

test('comparison lines per relation', () => {
  const item = { id: 'x', name: 'a Bugatti Chiron', value: 3e6 };
  assert.equal(describeComparison({ item, ratio: 1.02, relation: 'about' }), 'About the same as a Bugatti Chiron (~$3.00M)');
  assert.equal(describeComparison({ item, ratio: 3.333, relation: 'more' }), '3.3x a Bugatti Chiron (~$3.00M)');
  assert.equal(describeComparison({ item, ratio: 0.5136, relation: 'less' }), '51% of a Bugatti Chiron (~$3.00M)');
});

test('comps from a hand-built picks object', () => {
  const mode = MODES.hype;
  const result = computeValuation({ income: 1000 }, mode);
  const item = { id: 'x', name: 'the thing', value: 1e6, unit: { singular: 'thing', plural: 'things' } };
  const picks = {
    nearest: [
      { item, ratio: 0.2, relation: 'less' },
      { item, ratio: 1, relation: 'about' },
      { item, ratio: 12.4, relation: 'more' },
    ],
    conversion: { item, count: 250 },
  };
  const v = describeResult(result, mode, picks);
  assert.deepEqual(v.comps, [
    '20% of the thing (~$1.00M)',
    'About the same as the thing (~$1.00M)',
    '12x the thing (~$1.00M)',
  ]);
  assert.equal(v.conversion, 'In unit economics, that is 250 things.');
});

test('conversion singular for a count of one', () => {
  const item = { id: 'x', name: 'an H100', value: 30000, unit: { singular: 'H100 GPU', plural: 'H100 GPUs' } };
  assert.equal(describeConversion({ item, count: 1 }), 'In unit economics, that is 1.0 H100 GPU.');
  assert.equal(describeConversion({ item, count: 2 }), 'In unit economics, that is 2.0 H100 GPUs.');
  assert.equal(describeConversion({ item, count: 0.5 }), 'In unit economics, that is 0.50 H100 GPUs.');
});

test('edgeCase and modeShortLabel on the view', () => {
  assert.equal(view(scenarioA, 'hype').edgeCase, null);
  assert.equal(view(scenarioA, 'hype').modeShortLabel, 'IPO hype');
  assert.equal(view(scenarioA, 'seriesH').modeShortLabel, 'Series H');
  assert.equal(view({}, 'hype').edgeCase, 'all-zero');
  assert.equal(view({ otherLoans: 1000 }, 'hype').edgeCase, 'pre-revenue');
  assert.equal(view({ savings: 10000 }, 'hype').edgeCase, 'assets-only');
  assert.equal(view({ income: 100000 }, 'hype').edgeCase, 'debt-free');
});

test('shareText, Scenario A', () => {
  const v = view(scenarioA, 'hype');
  const url = 'https://example.test/what-am-i-worth/';
  const text = shareText(v, url);
  assert.ok(text.startsWith('What Am I Worth? My household was just valued at $32.99M on an IPO hype basis'));
  assert.ok(text.includes(`Nearest comparable: ${v.comps[0]}.`));
  assert.ok(text.endsWith(`: ${url}`));
  for (const raw of ['$50,000', '$235,000', '$10,000', '50,000', '235,000']) {
    assert.ok(!text.includes(raw), `leaks ${raw}`);
  }
  for (const row of v.breakdown) {
    if (row.basis) assert.ok(!text.includes(row.basis));
  }
  assert.ok(/^[\x20-\x7e]+$/.test(text), 'ASCII only');
  const s = shareText(view(scenarioA, 'seriesH'), url);
  assert.ok(s.includes('$6.15M on a Series H basis'));
});

test('shareText without a page URL has no URL clause', () => {
  const v = view(scenarioA, 'hype');
  for (const url of [undefined, '']) {
    const text = shareText(v, url);
    assert.ok(!text.includes('Price yours'));
    assert.ok(!text.includes('http'));
    assert.ok(!text.endsWith(': '));
  }
});

test('shareText edge cases', () => {
  const zero = shareText(view({}, 'hype'), 'https://example.test/');
  assert.ok(zero.includes('My household was valued at $0: pre-revenue, pre-debt, pure vision.'));
  assert.ok(!zero.includes('comparable'));
  const pre = shareText(view({ otherLoans: 1000 }, 'hype'), '');
  assert.ok(pre.includes('Pre-revenue. Heavily leveraged. Extremely fundable.'));
  assert.ok(!pre.includes('$1,000'));
});
