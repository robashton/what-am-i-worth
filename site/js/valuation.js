// Pure valuation engine. No DOM, no clocks, no network.

export const FIGURES_AS_OF = '2026-09-29';
export const DEFAULT_MODE_ID = 'hype';
export const MAX_AMOUNT = 1e15;
export const FIELD_IDS = Object.freeze(['income', 'savings', 'mortgage', 'creditCards', 'carFinance', 'studentLoans', 'otherLoans']);
export const DEBT_FIELD_IDS = Object.freeze(['mortgage', 'creditCards', 'carFinance', 'studentLoans', 'otherLoans']);

function deepFreeze(obj) {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') deepFreeze(value);
  }
  return Object.freeze(obj);
}

export const MODES = deepFreeze({
  hype: {
    id: 'hype',
    label: 'IPO hype mode',
    shortLabel: 'IPO hype',
    valuation: 2000e9,
    revenue: 4.59e9,
    losses: 42e9,
    notes: {
      valuation: 'Reported IPO target, not a priced valuation.',
      revenue: '2025 revenue per a reported (leaked, unconfirmed) prospectus.',
      losses: '2025 net loss per the same; roughly $34bn of it non-cash. A loss, not debt.',
    },
    sources: [
      { label: '36Kr: Anthropic IPO prospectus figures', url: 'https://eu.36kr.com/en/p/4003865277044616' },
      { label: 'ZeroHedge: leaked Anthropic IPO prospectus shows $42bn net loss', url: 'https://www.zerohedge.com/markets/leaked-anthropic-ipo-prospectus-shows-42bn-net-loss-518bn-unfunded-spending-commitments-and' },
      { label: 'GraniteShares: Anthropic IPO 2026 explained', url: 'https://graniteshares.com/research/anthropic-ipo-2026-explained-from-965-billion-to-a-possible-2-trillion-listing/' },
    ],
  },
  seriesH: {
    id: 'seriesH',
    label: 'Series H mode',
    shortLabel: 'Series H',
    valuation: 965e9,
    revenue: 65e9,
    losses: 42e9,
    notes: {
      valuation: 'Series H post-money valuation, May 2026.',
      revenue: 'Annualised revenue run-rate, end of July 2026.',
      losses: 'Same 2025 net loss figure as above.',
    },
    sources: [
      { label: 'Anthropic: Series H announcement', url: 'https://www.anthropic.com/news/series-h' },
      { label: 'TechCrunch: annualized revenue surges to $65B', url: 'https://techcrunch.com/2026/08/17/anthropics-annualized-revenue-surges-to-65b/' },
    ],
  },
});

export function getMode(id) {
  if (!Object.prototype.hasOwnProperty.call(MODES, id)) {
    throw new Error(`Unknown valuation mode: ${id}`);
  }
  return MODES[id];
}

export function multiples(mode) {
  return {
    revenueMultiple: mode.valuation / mode.revenue,
    lossMultiple: mode.valuation / mode.losses,
    lossToRevenue: mode.losses / mode.revenue,
  };
}

const NUMBER_RE = /^(\d+(\.\d*)?|\.\d+)$/;

export function parseAmount(raw) {
  let s = (raw === null || raw === undefined ? '' : String(raw)).trim();
  s = s.replace(/[,\s_]/g, '');
  if (/^\$?-/.test(s)) return { ok: false, error: 'negative' };
  if (s.startsWith('$')) s = s.slice(1);
  if (s === '') return { ok: true, value: 0 };
  if (!NUMBER_RE.test(s)) return { ok: false, error: 'invalid' };
  const value = Number(s);
  if (value > MAX_AMOUNT) return { ok: false, error: 'too-large' };
  return { ok: true, value };
}

function readInput(inputs, id) {
  const v = inputs[id] === undefined ? 0 : inputs[id];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new RangeError(`Invalid amount for ${id}: ${v}`);
  }
  return v;
}

export function computeValuation(inputs, mode) {
  const src = inputs || {};
  const values = {};
  for (const id of FIELD_IDS) values[id] = readInput(src, id);

  const m = multiples(mode);
  const income = values.income;
  const assets = values.savings;
  const totalDebt = DEBT_FIELD_IDS.reduce((sum, id) => sum + values[id], 0);

  const terms = {
    revenue: income * m.revenueMultiple,
    debt: totalDebt * m.lossMultiple,
    assets,
  };
  const total = terms.revenue + terms.debt + terms.assets;

  let edgeCase;
  if (income === 0 && totalDebt === 0 && assets === 0) edgeCase = 'all-zero';
  else if (income === 0 && totalDebt > 0) edgeCase = 'pre-revenue';
  else if (income === 0) edgeCase = 'assets-only';
  else if (totalDebt === 0) edgeCase = 'debt-free';
  else edgeCase = 'normal';

  return {
    modeId: mode.id,
    multiples: m,
    income,
    assets,
    totalDebt,
    terms,
    total,
    debtToIncome: income > 0 ? totalDebt / income : null,
    visionaryPct: income > 0 ? (totalDebt / income) / m.lossToRevenue * 100 : null,
    edgeCase,
    exceedsAnthropic: total > mode.valuation,
  };
}
