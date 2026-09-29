// Pure copy module: turns a valuation result into display strings (the "view").

import { formatMoney, formatMultiple, formatDecimal, formatCount, formatPercent } from './format.js';
import { MODES } from './valuation.js';

export const FIELD_ERRORS = Object.freeze({
  negative: 'Negative numbers are for the accountants. Enter 0 or more.',
  invalid: 'That is not a number, even by AI-lab standards. Digits only, e.g. 52,000.',
  'too-large': 'Over $1 quadrillion? Just buy Anthropic outright.',
});

// "a Series H basis" but "an IPO hype basis".
export function article(word) {
  return /^[AEIOU]/i.test(word) ? 'an' : 'a';
}

export const COMPS_EMPTY = 'Comparable transactions: none. You are category-defining.';

function headlineFor(result, mode, totalText) {
  switch (result.edgeCase) {
    case 'all-zero':
      return {
        headline: 'Pre-revenue, pre-debt: pure vision.',
        subtitle: 'Seed round incoming. Current valuation: $0, which is also the going rate for most pitch decks.',
      };
    case 'pre-revenue':
      return {
        headline: 'Pre-revenue. Heavily leveraged. Extremely fundable.',
        subtitle: `No income, ${formatMoney(result.totalDebt)} of debt, valued at ${totalText}. Every great lab started exactly here.`,
      };
    case 'assets-only':
      return {
        headline: 'Asset-rich, growth-poor. The market is unmoved.',
        subtitle: `Your ${formatMoney(result.assets)} of savings was valued at par. Have you considered borrowing heavily?`,
      };
    case 'debt-free':
      return {
        headline: 'Zero debt? Where is your ambition?',
        subtitle: `No borrowing means no strategic investment in growth. Analysts are concerned, but still value you at ${totalText}.`,
      };
    default:
      return {
        headline: 'Your household has been priced.',
        subtitle: `Indicative valuation on ${article(mode.shortLabel)} ${mode.shortLabel} basis: ${totalText}.`,
      };
  }
}

export function describeComparison({ item, ratio, relation }) {
  const p = formatMoney(item.value);
  if (relation === 'about') return `About the same as ${item.name} (~${p})`;
  if (relation === 'more') return `${formatCount(ratio)}x ${item.name} (~${p})`;
  return `${formatPercent(ratio * 100)} of ${item.name} (~${p})`;
}

export function describeConversion({ item, count }) {
  const text = formatCount(count);
  // formatCount never yields a bare "1" (1 formats as "1.0"), so treat both as singular.
  const noun = text === '1' || text === '1.0' ? item.unit.singular : item.unit.plural;
  return `In unit economics, that is ${text} ${noun}.`;
}

export function describeResult(result, mode, picks) {
  const { total, income, assets, totalDebt, multiples: m } = result;
  const totalText = formatMoney(total);
  const otherModeId = Object.keys(MODES).find((id) => id !== mode.id);
  const { headline, subtitle } = headlineFor(result, mode, totalText);

  const notices = [];
  if (result.exceedsAnthropic) {
    notices.push(`You are now worth more than Anthropic (${formatMoney(mode.valuation)}). Expect a call from their corp dev team.`);
  }
  if (total >= 1e15) {
    notices.push('Your valuation is now denominated in quadrillions. Economists would like a word.');
  }

  const breakdown = [
    {
      label: 'Revenue (household income)',
      basis: `${formatMoney(income)} x ${formatMultiple(m.revenueMultiple)}`,
      value: formatMoney(result.terms.revenue),
    },
    {
      label: 'Strategic investment in growth (debt)',
      basis: `${formatMoney(totalDebt)} x ${formatMultiple(m.lossMultiple)}`,
      value: formatMoney(result.terms.debt),
    },
    {
      label: 'Tangible assets (savings)',
      basis: `${formatMoney(assets)} x 1.0x`,
      value: formatMoney(result.terms.assets),
    },
    { label: 'Indicative valuation', basis: '', value: totalText, isTotal: true },
  ];

  const oneLiners = [];
  if (result.edgeCase !== 'all-zero') {
    if (income > 0) {
      oneLiners.push(`Revenue multiple: ${formatMultiple(m.revenueMultiple)}. Your ${formatMoney(income)} salary is now annual recurring revenue.`);
    }
    if (totalDebt > 0) {
      oneLiners.push(`Loss multiple: ${formatMultiple(m.lossMultiple)}. Your ${formatMoney(totalDebt)} of debt has been reframed as strategic investment in growth.`);
    }
    if (assets > 0) {
      oneLiners.push(`Savings valued at par: ${formatMoney(assets)} is worth ${formatMoney(assets)}. How quaint.`);
    }
    if (income > 0 && totalDebt > 0) {
      oneLiners.push(`Debt-to-income ratio: ${formatDecimal(result.debtToIncome)}. Anthropic's loss-to-revenue ratio: ${formatDecimal(m.lossToRevenue)}. You are ${formatPercent(result.visionaryPct)} as visionary.`);
    }
  }

  const comps = picks.nearest.map(describeComparison);

  return {
    modeId: mode.id,
    modeLabel: mode.label,
    modeShortLabel: mode.shortLabel,
    edgeCase: result.edgeCase === 'normal' ? null : (result.edgeCase ?? null),
    otherModeId,
    otherModeLabel: MODES[otherModeId].label,
    otherModeShortLabel: MODES[otherModeId].shortLabel,
    total,
    totalText,
    headline,
    subtitle,
    notices,
    breakdown,
    oneLiners,
    comps,
    compsEmpty: comps.length === 0 ? COMPS_EMPTY : null,
    conversion: picks.conversion ? describeConversion(picks.conversion) : null,
  };
}

// Clipboard summary. Only the headline total, the basis and at most the first
// comparable; never the user's individual figures or the breakdown.
export function shareText(view, pageUrl) {
  const parts = ['What Am I Worth?'];
  if (view.edgeCase === 'all-zero') {
    parts.push(`My household was valued at ${view.totalText}: pre-revenue, pre-debt, pure vision.`);
  } else {
    const basis = `${article(view.modeShortLabel)} ${view.modeShortLabel} basis`;
    parts.push(`My household was just valued at ${view.totalText} on ${basis}, using a certain very large AI lab's multiples.`);
    if (view.edgeCase) parts.push(view.headline);
    if (view.comps.length > 0) parts.push(`Nearest comparable: ${view.comps[0]}.`);
  }
  parts.push(pageUrl
    ? `Price yours (a joke; nothing leaves your device): ${pageUrl}`
    : 'A joke; nothing leaves your device.');
  return parts.join(' ');
}
