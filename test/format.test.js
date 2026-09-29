import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMoney, formatMultiple, formatDecimal, formatCount, formatPercent,
} from '../site/js/format.js';

test('formatMoney tiers and rounding', () => {
  const cases = [
    [0, '$0'],
    [999, '$999'],
    [999.4, '$999'],
    [999.5, '$1,000'],
    [47619.04761904762, '$47,619'],
    [950000, '$950,000'],
    [999999.4, '$999,999'],
    [999999.5, '$1.00M'],
    [1e6, '$1.00M'],
    [6151712.454212453, '$6.15M'],
    [32986968.56520386, '$32.99M'],
    [999994000, '$999.99M'],
    [999996000, '$1.00bn'],
    [4.59e9, '$4.59bn'],
    [965e9, '$965.00bn'],
    [2e12, '$2.00tn'],
    [2178649237472.767, '$2.18tn'],
    [1e15, '$1.00 quadrillion'],
    [1.234e18, '$1,234.00 quadrillion'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(formatMoney(input), expected, `formatMoney(${input})`);
  }
});

test('formatMoney negative is defined', () => {
  assert.equal(formatMoney(-5), '-$5');
  assert.equal(formatMoney(-2e12), '-$2.00tn');
});

test('formatMoney rejects non-finite', () => {
  assert.throws(() => formatMoney(Infinity), RangeError);
  assert.throws(() => formatMoney(-Infinity), RangeError);
  assert.throws(() => formatMoney(NaN), RangeError);
});

test('formatMultiple', () => {
  assert.equal(formatMultiple(435.7298474945534), '435.7x');
  assert.equal(formatMultiple(47.61904761904762), '47.6x');
  assert.equal(formatMultiple(14.846153846153847), '14.8x');
  assert.equal(formatMultiple(22.976190476190474), '23.0x');
  assert.equal(formatMultiple(1), '1.0x');
  assert.equal(formatMultiple(1234.5), '1,234.5x');
});

test('formatDecimal', () => {
  assert.equal(formatDecimal(4.7), '4.7');
  assert.equal(formatDecimal(9.15032679738562), '9.2');
  assert.equal(formatDecimal(0.6461538461538462), '0.6');
  assert.equal(formatDecimal(1000000), '1,000,000.0');
  assert.equal(formatDecimal(1.23456, 3), '1.235');
});

test('formatCount', () => {
  assert.equal(formatCount(1099.5656), '1,100');
  assert.equal(formatCount(10.996), '11');
  assert.equal(formatCount(9.96), '10');
  assert.equal(formatCount(3.333), '3.3');
  assert.equal(formatCount(0.996), '1.0');
  assert.equal(formatCount(0.5), '0.50');
  assert.equal(formatCount(0.2083), '0.21');
  assert.equal(formatCount(0.0004), '<0.01');
  assert.equal(formatCount(1e7), '10,000,000');
  assert.equal(formatCount(0), '0');
});

test('formatPercent', () => {
  assert.equal(formatPercent(51.36428571), '51%');
  assert.equal(formatPercent(727.3809524), '727%');
  assert.equal(formatPercent(0.2), '<1%');
  assert.equal(formatPercent(12345.6), '12,346%');
  assert.equal(formatPercent(0), '0%');
});
