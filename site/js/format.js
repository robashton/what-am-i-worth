// Pure formatting helpers. en-US, USD, ASCII only apart from "$".

// Insert thousands separators into a plain (unsigned) numeric string.
function commas(text) {
  const [intPart, fracPart] = String(text).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fracPart === undefined ? grouped : `${grouped}.${fracPart}`;
}

function withSign(x, fn) {
  return x < 0 ? '-' + fn(-x) : fn(x);
}

const UNITS = [
  { size: 1e6, suffix: 'M' },
  { size: 1e9, suffix: 'bn' },
  { size: 1e12, suffix: 'tn' },
  { size: 1e15, suffix: ' quadrillion' },
];

export function formatMoney(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new RangeError(`formatMoney: not a finite number: ${n}`);
  }
  if (n < 0) return '-' + formatMoney(-n);

  const r = Math.round(n);
  if (r < 1e6) return '$' + commas(r.toFixed(0));

  let i = 0;
  while (i < UNITS.length - 1 && r >= UNITS[i + 1].size) i += 1;
  let x = Math.round((n / UNITS[i].size) * 100) / 100;
  while (x >= 1000 && i < UNITS.length - 1) {
    i += 1;
    x = Math.round((n / UNITS[i].size) * 100) / 100;
  }
  return '$' + commas(x.toFixed(2)) + UNITS[i].suffix;
}

export function formatDecimal(x, dp = 1) {
  return withSign(x, (v) => commas(v.toFixed(dp)));
}

export function formatMultiple(x) {
  return formatDecimal(x, 1) + 'x';
}

export function formatCount(n) {
  if (n === 0) return '0';
  if (Math.round(n * 10) / 10 >= 10) return commas(Math.round(n).toFixed(0));
  if (Math.round(n * 100) / 100 >= 1) return n.toFixed(1);
  if (n >= 0.01) return n.toFixed(2);
  if (n > 0) return '<0.01';
  return '-' + formatCount(-n);
}

export function formatPercent(p) {
  if (p === 0) return '0%';
  if (p > 0 && p < 0.5) return '<1%';
  return withSign(Math.round(p), (v) => commas(v.toFixed(0))) + '%';
}
