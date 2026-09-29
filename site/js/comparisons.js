// Curated "comparable transactions" dataset and a pure picker.
// Each figure lives here only (except the Anthropic items, which come from MODES).

import { MODES } from './valuation.js';

export const AS_OF = '2026-09';
export const DATASET_NOTE = 'Approximate, rounded, nominal USD figures from widely reported public sources. Not inflation-adjusted. For entertainment only.';

const unit = (singular, plural) => ({ singular, plural });

const RAW_ITEMS = [
  { id: 'iphone', name: 'an iPhone Pro Max', value: 1200, note: 'Rough US starting price, recent generations.' },
  { id: 'claude-max-year', name: 'a year of Claude Max', value: 2400, note: 'Top Max tier, $200/month x 12.', unit: unit('year of Claude Max', 'years of Claude Max') },
  { id: 'rolex', name: 'a Rolex Submariner', value: 10000, note: 'Approx. US retail list price.' },
  { id: 'h100', name: 'an Nvidia H100 GPU', value: 30000, note: 'Widely reported at $25k-40k each.', unit: unit('H100 GPU', 'H100 GPUs') },
  { id: 'wedding', name: 'the average US wedding', value: 33000, note: 'The Knot, 2024.' },
  { id: 'new-car', name: 'an average new car in the US', value: 49000, note: 'Kelley Blue Book average transaction price, ~2025.' },
  { id: 'median-home', name: 'the median US home', value: 420000, note: 'NAR median existing-home price, ~2025.' },
  { id: 'bugatti', name: 'a Bugatti Chiron', value: 3e6, note: 'Launch base price.', unit: unit('Bugatti Chiron', 'Bugatti Chirons') },
  { id: 'superbowl-ad', name: 'a 30-second Super Bowl ad', value: 8e6, note: 'Reported rate, Super Bowl LIX (2025).' },
  { id: 'tuvalu-gdp', name: 'the annual GDP of Tuvalu', value: 62e6, note: 'World Bank, ~2023; one of the smallest economies.' },
  { id: 'g650', name: 'a Gulfstream G650', value: 65e6, note: 'Approx. list price at launch, ~2013.' },
  { id: 'beeple', name: 'Beeple\'s "Everydays" NFT', value: 69.3e6, note: 'Christie\'s, March 2021.' },
  { id: 'f35', name: 'an F-35A fighter jet', value: 82.5e6, note: 'Approx. unit cost, recent lots.' },
  { id: 'f1-cap', name: 'a Formula 1 team\'s annual cost cap', value: 135e6, note: 'FIA base cap, 2023-2025.' },
  { id: 'neymar', name: 'Neymar\'s transfer to PSG', value: 263e6, note: 'EUR 222m world-record fee, 2017.', unit: unit('Neymar transfer', 'Neymar transfers') },
  { id: 'endgame', name: 'the budget of Avengers: Endgame', value: 356e6, note: 'Widely reported production budget, 2019.' },
  { id: 'b747', name: 'a Boeing 747-8', value: 418e6, note: 'Last published list price.' },
  { id: 'salvator', name: 'Leonardo\'s Salvator Mundi', value: 450.3e6, note: 'Christie\'s, November 2017.' },
  { id: 'instagram', name: 'Facebook\'s Instagram acquisition', value: 1e9, note: 'April 2012.', unit: unit('Instagram acquisition', 'Instagram acquisitions') },
  { id: 'burj', name: 'the Burj Khalifa', value: 1.5e9, note: 'Reported construction cost.' },
  { id: 'youtube', name: 'Google\'s YouTube acquisition', value: 1.65e9, note: '2006, in stock.' },
  { id: 'eras', name: 'the entire Eras Tour (gross)', value: 2.08e9, note: 'Reported total gross, 2023-2024.' },
  { id: 'minecraft', name: 'Microsoft\'s Minecraft acquisition', value: 2.5e9, note: 'Mojang, 2014.' },
  { id: 'commanders', name: 'the Washington Commanders', value: 6.05e9, note: '2023 sale price.' },
  { id: 'jwst', name: 'the James Webb Space Telescope', value: 10e9, note: 'Approx. total NASA cost.' },
  { id: 'ford-carrier', name: 'the USS Gerald R. Ford', value: 13.3e9, note: 'Reported construction cost.' },
  { id: 'whatsapp', name: 'Facebook\'s WhatsApp acquisition', value: 19e9, note: '2014.' },
  { id: 'linkedin', name: 'Microsoft\'s LinkedIn acquisition', value: 26.2e9, note: '2016.' },
  { id: 'iceland-gdp', name: 'the annual GDP of Iceland', value: 31e9, note: 'World Bank, ~2023.' },
  { id: 'twitter', name: 'Elon Musk\'s Twitter acquisition', value: 44e9, note: 'October 2022.', unit: unit('Twitter acquisition', 'Twitter acquisitions') },
  { id: 'harvard', name: 'Harvard\'s endowment', value: 53.2e9, note: 'Fiscal 2024.' },
  { id: 'activision', name: 'Microsoft\'s Activision Blizzard deal', value: 68.7e9, note: 'Completed October 2023.' },
  { id: 'iss', name: 'the International Space Station', value: 150e9, note: 'Widely cited total cost.' },
  { id: 'apple-rev', name: 'a year of Apple\'s revenue', value: 391e9, note: 'Fiscal 2024.' },
  { id: 'anthropic-seriesh', name: 'Anthropic at its Series H', value: MODES.seriesH.valuation, note: 'May 2026 post-money.' },
  { id: 'anthropic-ipo', name: 'Anthropic at its rumoured IPO target', value: MODES.hype.valuation, note: 'Reported target.' },
  { id: 'uk-gdp', name: 'the annual GDP of the United Kingdom', value: 3.6e12, note: 'IMF, ~2024.' },
  { id: 'us-gdp', name: 'the annual GDP of the United States', value: 29.2e12, note: 'BEA, 2024.' },
];

export const ITEMS = Object.freeze(RAW_ITEMS.map((item) => {
  if (item.unit) Object.freeze(item.unit);
  return Object.freeze(item);
}));

const EPS = 1e-9;

export function pickComparisons(value, items = ITEMS, { count = 3 } = {}) {
  if (!(value > 0)) return { nearest: [], conversion: null };

  // Conversion: the unit item that yields closest to ~100 units.
  let conversionItem = null;
  let bestD = Infinity;
  for (const item of items) {
    if (!item.unit) continue;
    const d = Math.abs(Math.log10(value / item.value) - 2);
    if (d < bestD - EPS) {
      bestD = d;
      conversionItem = item;
    } else if (Math.abs(d - bestD) <= EPS && item.value > conversionItem.value) {
      conversionItem = item;
    }
  }
  const conversion = conversionItem
    ? { item: conversionItem, count: value / conversionItem.value }
    : null;

  const distance = (item) => Math.abs(Math.log10(value / item.value));
  const candidates = items
    .filter((item) => item !== conversionItem)
    .map((item) => ({ item, d: distance(item) }));
  candidates.sort((a, b) => {
    if (Math.abs(a.d - b.d) > EPS) return a.d - b.d;
    if (a.item.value !== b.item.value) return a.item.value - b.item.value;
    return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0;
  });

  const nearest = candidates
    .slice(0, count)
    .map(({ item }) => item)
    .sort((a, b) => a.value - b.value)
    .map((item) => {
      const ratio = value / item.value;
      let relation = 'less';
      if (ratio >= 0.9 && ratio <= 1.1) relation = 'about';
      else if (ratio > 1.1) relation = 'more';
      return { item, ratio, relation };
    });

  return { nearest, conversion };
}
