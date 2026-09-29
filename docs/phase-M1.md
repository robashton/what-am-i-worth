# Phase M1 — Working calculator

## 0. Commands

System `node` v24 is fine. No nix shell, no `npm install`, no `package.json`.

- **Unit tests:** `node --test test/*.test.js`
  - Single file: `node --test test/valuation.test.js`
  - Do NOT use `node --test test/`. On Node 24.13 the runner matches the directory itself and fails with `MODULE_NOT_FOUND`. Step 12 fixes the CLAUDE.md line.
- **Serve locally:** `python3 -m http.server -d site 8000`, then open http://localhost:8000/
  - ES modules do not load over `file://`, so always serve the site.
- **Headless checks:** Playwright's Chromium is at `~/Library/Caches/ms-playwright/chromium-1234`.
  - Drive it with a throwaway script kept OUTSIDE the repo (e.g. in `/tmp`), using `npx -y playwright@1.x` or python playwright.
  - Never add dependencies or scripts to the repo.

Hard rules for this phase:
- No git operations.
- No drive-by scope.
- No emojis in code or docs.
- No Co-Authored-By lines.
- No npm dependencies.
- No runtime network calls.
- Nothing persisted: no localStorage, sessionStorage, cookies or IndexedDB, and no figures in the URL.

## 1. Goal and scope

**Goal:** a fully working, good-looking, single-page calculator. A user can:
- enter any subset of household figures (or none);
- pick a valuation mode;
- submit and see a valuation, a three-term breakdown, joke one-liners, 3 comparable items and one unit conversion;
- flip modes to reprice;
- read a methodology/sources footer.

Everything runs client-side.

**In scope (M1):**
- Page structure and privacy copy.
- Form with validation.
- Mode toggle.
- Pure modules with `node --test` tests: `valuation.js`, `format.js`, `comparisons.js`, `copy.js`.
- DOM wiring in `app.js`.
- Methodology footer.
- Mobile-first "preliminary prospectus" styling.

**Out of scope (M2):**
- The "due diligence" theatre, counter roll-up, confetti and slide-ins.
- The reduced-motion reveal path.
- Screenshot polish pass.
- GitHub Pages workflow and README.

In M1 the result appears instantly with no transitions.

**The M2 seam (required).** All result display goes through ONE function in `app.js`: `presentResult(view)`.
- In M1, `presentResult` just calls `renderResult(view)`, then scrolls to and focuses the result heading.
- In M2 its body will become "run reveal, then renderResult", so nothing else in `app.js` may render result DOM directly.
- `view` is a plain, fully precomputed object from `copy.js`, so M2 has the final numbers and strings up front (e.g. the counter target is `view.total`).
- `#result` also carries `data-state="hidden" | "shown"` for M2's CSS to hook onto.

## 2. Files to create / modify (exhaustive)

Create:
1. `site/index.html`
2. `site/styles.css`
3. `site/js/valuation.js` (pure)
4. `site/js/format.js` (pure)
5. `site/js/comparisons.js` (pure; data and picker)
6. `site/js/copy.js` (pure; turns results into display strings)
7. `site/js/app.js` (DOM wiring only)
8. `test/valuation.test.js`
9. `test/format.test.js`
10. `test/comparisons.test.js`
11. `test/copy.test.js`

Modify:

12. `CLAUDE.md` — change ONLY the unit-test command line from `node --test test/` to `node --test test/*.test.js` (keep the single-file example).

Optional:

13. `.ai/robashton/M1-notes.md` — scratch notes, if useful.

Nothing else. In particular:
- no `package.json`, `.github/`, README or favicon file;
- no images or fonts;
- no changes to `docs/design.md`.

Pure modules must not touch `document`, `window` or `Date.now`, and must import only each other:
- `comparisons.js` imports `valuation.js`.
- `copy.js` imports `format.js`, `valuation.js` and `comparisons.js` (types only / constants).
- `app.js` imports all of them.

Every module is an ES module using named exports and relative imports with the `.js` extension, e.g. `import { MODES } from './valuation.js'`.

## 3. Per-file specs

### 3.1 `site/js/format.js`

All output is en-US, USD, with ASCII only apart from the `$`. Thousands separators are commas. Either format them by hand or use `Intl.NumberFormat('en-US')` explicitly; never use locale defaults.

**`formatMoney(n)`**
- **Throws:** `RangeError` if `n` is not finite.
- **Negative `n`:** return `'-' + formatMoney(-n)`. Not expected in practice, but it must be defined.
- **Tiers:**
  - `r = Math.round(n)`. If `r < 1e6`: `"$" + commas(r)`, e.g. `$0`, `$999`, `$47,619`, `$950,000`.
  - Otherwise pick a unit: `M` (1e6), `bn` (1e9), `tn` (1e12) or ` quadrillion` (1e15, note the leading space).
  - Scaled value: `x = Math.round(n / unit * 100) / 100`.
  - **Promotion:** if `x >= 1000` and a larger unit exists, move up one unit and recompute.
  - Output: `"$" + x.toFixed(2) + suffix`. Quadrillions get commas in the integer part, e.g. `$1,234.00 quadrillion`.
  - There is no unit above quadrillion.
- **Why the space before "quadrillion":** it lets the big number wrap at 375px.

Required tests (exact strings):

| input | output |
|---|---|
| 0 | `$0` |
| 999 | `$999` |
| 999.4 | `$999` |
| 999.5 | `$1,000` |
| 47619.04761904762 | `$47,619` |
| 950000 | `$950,000` |
| 999999.4 | `$999,999` |
| 999999.5 | `$1.00M` |
| 1e6 | `$1.00M` |
| 6151712.454212453 | `$6.15M` |
| 32986968.56520386 | `$32.99M` |
| 999994000 | `$999.99M` |
| 999996000 | `$1.00bn` |
| 4.59e9 | `$4.59bn` |
| 965e9 | `$965.00bn` |
| 2e12 | `$2.00tn` |
| 2178649237472.767 | `$2.18tn` |
| 1e15 | `$1.00 quadrillion` |
| 1.234e18 | `$1,234.00 quadrillion` |
| Infinity / NaN | throws RangeError |

**`formatMultiple(x)`**
- Returns `x.toFixed(1)` with commas, plus `"x"`.
- Tests:
  - 435.7298474945534 → `435.7x`
  - 47.61904761904762 → `47.6x`
  - 14.846153846153847 → `14.8x`
  - 22.976190476190474 → `23.0x`
  - 1 → `1.0x`
  - 1234.5 → `1,234.5x`

**`formatDecimal(x, dp = 1)`**
- Returns `x.toFixed(dp)` with commas in the integer part.
- Tests:
  - 4.7 → `4.7`
  - 9.15032679738562 → `9.2`
  - 0.6461538461538462 → `0.6`
  - 1000000 → `1,000,000.0`

**`formatCount(n)`** — for "N Bugatti Chirons" and for "Nx an item"
- Decide the tier on rounded values, promoting upward when rounding crosses a boundary:
  - `n >= 10` (after rounding to 1dp): `commas(Math.round(n))`.
  - `1 <= n < 10` (after rounding to 2dp): `n.toFixed(1)`.
  - `0.01 <= n < 1`: `n.toFixed(2)`.
  - `0 < n < 0.01`: `<0.01`.
  - `0`: `0`.
- Tests:
  - 1099.5656 → `1,100`
  - 10.996 → `11`
  - 9.96 → `10`
  - 3.333 → `3.3`
  - 0.996 → `1.0`
  - 0.5 → `0.50`
  - 0.2083 → `0.21`
  - 0.0004 → `<0.01`
  - 1e7 → `10,000,000`

**`formatPercent(p)`** — `p` is already a percentage
- Rules:
  - `p === 0` → `0%`.
  - `0 < p < 0.5` → `<1%`.
  - Otherwise `commas(Math.round(p)) + "%"`.
- Tests:
  - 51.36428571 → `51%`
  - 727.3809524 → `727%`
  - 0.2 → `<1%`
  - 12345.6 → `12,346%`

### 3.2 `site/js/valuation.js`

```js
export const FIGURES_AS_OF = '2026-09-29';
export const DEFAULT_MODE_ID = 'hype';
export const MAX_AMOUNT = 1e15;
export const FIELD_IDS = ['income','savings','mortgage','creditCards','carFinance','studentLoans','otherLoans'];
export const DEBT_FIELD_IDS = ['mortgage','creditCards','carFinance','studentLoans','otherLoans'];

export const MODES = Object.freeze({
  hype: {
    id: 'hype', label: 'IPO hype mode', shortLabel: 'IPO hype',
    valuation: 2000e9, revenue: 4.59e9, losses: 42e9,
    notes: {
      valuation: 'Reported IPO target, not a priced valuation.',
      revenue: '2025 revenue per a reported (leaked, unconfirmed) prospectus.',
      losses: '2025 net loss per the same; roughly $34bn of it non-cash. A loss, not debt.',
    },
    sources: [ {label, url} x3 ],   // the three hype URLs from design.md, verbatim
  },
  seriesH: {
    id: 'seriesH', label: 'Series H mode', shortLabel: 'Series H',
    valuation: 965e9, revenue: 65e9, losses: 42e9,
    notes: {
      valuation: 'Series H post-money valuation, May 2026.',
      revenue: 'Annualised revenue run-rate, end of July 2026.',
      losses: 'Same 2025 net loss figure as above.',
    },
    sources: [ {label, url} x2 ],   // anthropic.com/news/series-h, the techcrunch URL
  },
});
```

Each nested object should be frozen too.

**Functions**

- `getMode(id)`
  - Returns `MODES[id]`, or throws `Error` for an unknown id.
- `multiples(mode)` returns:
  - `revenueMultiple = mode.valuation / mode.revenue`
  - `lossMultiple = mode.valuation / mode.losses`
  - `lossToRevenue = mode.losses / mode.revenue`
- `parseAmount(raw)` returns `{ ok: true, value }` or `{ ok: false, error: 'negative' | 'invalid' | 'too-large' }`.
  1. Treat `null`/`undefined` as `''`. Trim.
  2. Remove all commas, spaces and underscores.
  3. Negative check: a leading `-` (before or after an optional single leading `$`) gives `negative`.
  4. Remove one optional leading `$`.
  5. An empty result gives `{ok:true, value:0}`.
  6. Otherwise the text must match `/^(\d+(\.\d*)?|\.\d+)$/`, else `invalid`. That means no exponents, no `Infinity` and no k/m suffixes.
  7. `value = Number(s)`. If it is greater than `MAX_AMOUNT`, return `too-large`.
- `computeValuation(inputs, mode)`
  - `inputs` is an object keyed by `FIELD_IDS`. Missing keys count as 0.
  - Throws `RangeError` if any value is negative or non-finite. This is defensive; the UI validates first.
  - Returns:

```js
{
  modeId,
  multiples: { revenueMultiple, lossMultiple, lossToRevenue },
  income, assets /* = savings */, totalDebt,
  terms: { revenue: income*revenueMultiple, debt: totalDebt*lossMultiple, assets },
  total,  // sum of the three terms
  debtToIncome: income > 0 ? totalDebt / income : null,
  visionaryPct: income > 0 ? (totalDebt / income) / lossToRevenue * 100 : null,
  edgeCase,  // see below
  exceedsAnthropic: total > mode.valuation,
}
```

`edgeCase` rules, evaluated in order:
1. Income, debt and assets all 0 → `'all-zero'`.
2. Income 0 and debt > 0 → `'pre-revenue'`.
3. Income 0, debt 0 and assets > 0 → `'assets-only'`.
4. Income > 0 and debt 0 → `'debt-free'`.
5. Otherwise → `'normal'`.

**Tests** (`test/valuation.test.js`). Use the helper `approx(a, e) := Math.abs(a - e) <= 1e-9 * Math.max(1, Math.abs(e))`.

*Multiples:*
- hype: `revenueMultiple` 435.7298474945534, `lossMultiple` 47.61904761904762, `lossToRevenue` 9.15032679738562
- seriesH: 14.846153846153847, 22.976190476190474, 0.6461538461538462

*Scenario A, the "reference household":*
- Inputs: income 50000, savings 10000, mortgage 200000, creditCards 5000, carFinance 10000, studentLoans 20000, otherLoans 0.
- `totalDebt` is 235000.
- hype:
  - terms 21786492.37472767 / 11190476.19047619 / 10000
  - total 32986968.56520386, formatted `$32.99M`
  - `debtToIncome` 4.7, `visionaryPct` 51.36428571428571 (about 51.364), `edgeCase` `normal`
- seriesH:
  - terms 742307.6923076924 / 5399404.761904761 / 10000
  - total 6151712.454212453, formatted `$6.15M`
  - `visionaryPct` about 727.3809523809524

*Scenario D:*
- Inputs: income 85000, savings 15000, mortgage 300000, creditCards 2500. `totalDebt` is 302500.
- hype: terms 37037037.03703704 / 14404761.904761905 / 15000; total 51456798.94179894
- seriesH: terms 1261923.076923077 / 6950297.6190476185 / 15000; total 8227220.6959706955

*Edge cases:*
- All blank (`{}`): total 0 in both modes, `edgeCase` `all-zero`, `debtToIncome` null, `visionaryPct` null.
- Pre-revenue (`otherLoans` 1000 only):
  - hype total 47619.04761904762
  - seriesH total 22976.190476190473
  - `edgeCase` `pre-revenue`, `debtToIncome` null
- Assets only (savings 10000): total 10000 in both modes, `edgeCase` `assets-only`.
- Debt free (income 100000): hype 43572984.74945534, seriesH 1484615.3846153847, `edgeCase` `debt-free`.
- Exceeds Anthropic (income 5e9):
  - hype total 2178649237472.767, `exceedsAnthropic` true
  - seriesH total 74230769230.76923, `exceedsAnthropic` false
- Extremes: all seven fields at 1e15 gives a finite total in both modes.
- Invalid input: `computeValuation({income:-1}, hype)` and `{income: NaN}` both throw.

*`parseAmount` table:*

| input | result |
|---|---|
| `''` | 0 |
| `'   '` | 0 |
| `undefined` | 0 |
| `'50000'` | 50000 |
| `'50,000'` | 50000 |
| `'$50,000.50'` | 50000.5 |
| `' 1 000 '` | 1000 |
| `'.5'` | 0.5 |
| `'0'` | 0 |
| `'1000000000000000'` | 1e15 |
| `'-5'` | negative |
| `'-$5'` | negative |
| `'$-5'` | negative |
| `'abc'` | invalid |
| `'1e5'` | invalid |
| `'1.2.3'` | invalid |
| `'.'` | invalid |
| `'Infinity'` | invalid |
| `'50k'` | invalid |
| `'1000000000000001'` | too-large |

*Structure:* `MODES` is frozen and every mode has at least one source with an `https://` URL.

### 3.3 `site/js/comparisons.js`

```js
export const AS_OF = '2026-09';
export const DATASET_NOTE = 'Approximate, rounded, nominal USD figures from widely reported public sources. Not inflation-adjusted. For entertainment only.';
export const ITEMS = Object.freeze([ /* ascending by value */ ]);
// item shape:
// { id: 'bugatti', name: 'a Bugatti Chiron', value: 3e6, note: 'Launch base price, roughly.',
//   unit?: { singular: 'Bugatti Chiron', plural: 'Bugatti Chirons' } }
```

`name` must read naturally mid-sentence after "of" or "as": use a lower-case article, e.g. "the annual GDP of Tuvalu".

**Dataset** (38 items, source order ascending). The implementor may adjust wording, and may swap an item for a better-known one at a similar magnitude. Do not invent obscure figures. Each number lives only here, apart from the two Anthropic items, which MUST reference `MODES.*.valuation` from `valuation.js`.

| id | name | value | note | unit? |
|---|---|---|---|---|
| iphone | an iPhone Pro Max | 1,200 | Rough US starting price, recent generations | |
| claude-max-year | a year of Claude Max | 2,400 | Top Max tier, $200/month x 12 | yes: year / years of Claude Max |
| rolex | a Rolex Submariner | 10,000 | Approx. US retail list | |
| h100 | an Nvidia H100 GPU | 30,000 | Widely reported at $25k-40k each | yes: H100 GPU / H100 GPUs |
| wedding | the average US wedding | 33,000 | The Knot, 2024 | |
| new-car | an average new car in the US | 49,000 | Kelley Blue Book avg transaction price, ~2025 | |
| median-home | the median US home | 420,000 | NAR median existing-home price, ~2025 | |
| bugatti | a Bugatti Chiron | 3,000,000 | Launch base price | yes: Bugatti Chiron / Bugatti Chirons |
| superbowl-ad | a 30-second Super Bowl ad | 8,000,000 | Reported rate, Super Bowl LIX (2025) | |
| tuvalu-gdp | the annual GDP of Tuvalu | 62,000,000 | World Bank, ~2023; one of the smallest economies | |
| g650 | a Gulfstream G650 | 65,000,000 | Approx. new list price | |
| beeple | Beeple's "Everydays" NFT | 69,300,000 | Christie's, March 2021 | |
| f35 | an F-35A fighter jet | 82,500,000 | Approx. unit cost, recent lots | |
| f1-cap | a Formula 1 team's annual cost cap | 135,000,000 | FIA base cap, 2023-2025 | |
| neymar | Neymar's transfer to PSG | 263,000,000 | EUR 222m world-record fee, 2017 | yes: Neymar transfer / Neymar transfers |
| endgame | the budget of Avengers: Endgame | 356,000,000 | Widely reported production budget, 2019 | |
| b747 | a Boeing 747-8 | 418,000,000 | Last published list price | |
| salvator | Leonardo's Salvator Mundi | 450,300,000 | Christie's, Nov 2017 | |
| instagram | Facebook's Instagram acquisition | 1e9 | April 2012 | yes: Instagram acquisition(s) |
| burj | the Burj Khalifa | 1.5e9 | Reported construction cost | |
| youtube | Google's YouTube acquisition | 1.65e9 | 2006, in stock | |
| eras | the entire Eras Tour (gross) | 2.08e9 | Reported total gross, 2023-2024 | |
| minecraft | Microsoft's Minecraft acquisition | 2.5e9 | Mojang, 2014 | |
| commanders | the Washington Commanders | 6.05e9 | 2023 sale price | |
| jwst | the James Webb Space Telescope | 10e9 | Approx. total NASA cost | |
| ford-carrier | the USS Gerald R. Ford | 13.3e9 | Reported construction cost | |
| whatsapp | Facebook's WhatsApp acquisition | 19e9 | 2014 | |
| linkedin | Microsoft's LinkedIn acquisition | 26.2e9 | 2016 | |
| iceland-gdp | the annual GDP of Iceland | 31e9 | World Bank, ~2023 | |
| twitter | Elon Musk's Twitter acquisition | 44e9 | October 2022 | yes: Twitter acquisition(s) |
| harvard | Harvard's endowment | 53.2e9 | Fiscal 2024 | |
| activision | Microsoft's Activision Blizzard deal | 68.7e9 | Completed October 2023 | |
| iss | the International Space Station | 150e9 | Widely cited total cost | |
| apple-rev | a year of Apple's revenue | 391e9 | Fiscal 2024 | |
| anthropic-seriesh | Anthropic at its Series H | `MODES.seriesH.valuation` | May 2026 post-money | |
| anthropic-ipo | Anthropic at its rumoured IPO target | `MODES.hype.valuation` | Reported target | |
| uk-gdp | the annual GDP of the United Kingdom | 3.6e12 | IMF, ~2024 | |
| us-gdp | the annual GDP of the United States | 29.2e12 | BEA, 2024 | |

**`pickComparisons(value, items = ITEMS, { count = 3 } = {})`**
- Returns `{ nearest: [{ item, ratio, relation }], conversion: { item, count } | null }`.
- It is deterministic and never mutates `items`.
- **Guard:** if `!(value > 0)` (covers 0, negative and NaN), return `{ nearest: [], conversion: null }`.
- **Conversion:**
  - Consider only items with `unit`.
  - For each, `d = |log10(value / item.value) - 2|`, i.e. aim for about 100 units.
  - Pick the minimum `d`. Ties within `1e-9` go to the item with the LARGER value.
  - `count = value / item.value`.
  - If no item has a unit, `conversion` is null.
- **Nearest:**
  - Candidates are all items except the chosen conversion item.
  - Sort by `|log10(value / item.value)|` ascending. Ties within `1e-9` go to the lower value, then to `id` alphabetical.
  - Take the first `count`, then re-sort that selection by value ascending for display.
- **Each nearest entry:**
  - `ratio = value / item.value`.
  - `relation` is `'about'` if `0.9 <= ratio <= 1.1`, `'more'` if `ratio > 1.1`, and `'less'` otherwise.

**Tests** (`test/comparisons.test.js`).

*Fixture tests.* Use a fixture so the tests do not depend on the real numbers:

```
F = [ {id:'a', value:1e3}, {id:'b', value:1e4, unit:{singular:'b',plural:'bs'}}, {id:'c', value:1e5},
      {id:'d', value:1e6, unit:{singular:'d',plural:'ds'}}, {id:'e', value:1e7}, {id:'f', value:1e8} ]
```

| value | conversion (id, count) | nearest ids, in order |
|---|---|---|
| 0, -1, NaN | null | [] |
| 1e3 | b, 0.1 | a, c, d (a has relation `about`) |
| 5e4 | b, 5 | a, c, d |
| 1e4 | b, 1 | a, c, d (a/c tie broken by lower value) |
| 1e4 with `{count:1}` | b | a |
| 1e6 | b, 100 | c, d, e (d has relation `about`) |
| 1e7 | d, 10 (tie with b at 1000 goes to the larger unit) | c, e, f |
| 1e8 | d, 100 | c, e, f |

Also assert that `F` is unchanged after the calls.

*Real-dataset tests:*
- Ids are unique.
- Every value is finite and > 0; every name and note is a non-empty string.
- `ITEMS` is ascending by value.
- `30 <= length <= 40`.
- Min value <= 1500 and max value >= 1e13.
- At least 4 unit items, each with a singular and a plural; `h100` and `twitter` are among them.
- The Anthropic items equal `MODES` values.
- `AS_OF` matches `/^\d{4}-\d{2}$/`.
- Sweep `value = 10^k` for k = 0..18 in steps of 0.5. Each call returns 3 distinct nearest items, none equal to the conversion item, and a non-null conversion.

Sanity check (not asserted): with the proposed data, Scenario A hype ($32.99M) gives "11 Bugatti Chirons" and the nearest items Tuvalu GDP, G650 and Beeple. $1bn gives 333 Bugatti Chirons plus Instagram, the Burj Khalifa and YouTube.

### 3.4 `site/js/copy.js`

**`FIELD_ERRORS`**
- `negative`: "Negative numbers are for the accountants. Enter 0 or more."
- `invalid`: "That is not a number, even by AI-lab standards. Digits only, e.g. 52,000."
- `too-large`: "Over $1 quadrillion? Just buy Anthropic outright."

**`describeResult(result, mode, picks)`** returns a `view`:

```js
{
  modeId, modeLabel: mode.label, otherModeId, otherModeLabel,
  total, totalText: formatMoney(total),
  headline, subtitle,
  notices: [string],        // 0..2 extra banner lines
  breakdown: [ {label, basis, value} x3, then {label:'Indicative valuation', basis:'', value, isTotal:true} ],
  oneLiners: [string],
  comps: [string],          // one per nearest entry
  compsEmpty: string|null,  // set only when comps is empty
  conversion: string|null,
}
```

**Headlines and subtitles** (exact strings; `{}` are formatted values):

- `all-zero`
  - headline: "Pre-revenue, pre-debt: pure vision."
  - subtitle: "Seed round incoming. Current valuation: $0, which is also the going rate for most pitch decks."
- `pre-revenue`
  - headline: "Pre-revenue. Heavily leveraged. Extremely fundable."
  - subtitle: "No income, {formatMoney(totalDebt)} of debt, valued at {totalText}. Every great lab started exactly here."
- `assets-only`
  - headline: "Asset-rich, growth-poor. The market is unmoved."
  - subtitle: "Your {formatMoney(assets)} of savings was valued at par. Have you considered borrowing heavily?"
- `debt-free`
  - headline: "Zero debt? Where is your ambition?"
  - subtitle: "No borrowing means no strategic investment in growth. Analysts are concerned, but still value you at {totalText}."
- `normal`
  - headline: "Your household has been priced."
  - subtitle: "Indicative valuation on a {mode.shortLabel} basis: {totalText}."

**Notices** (in this order, each only when applicable):
- If `exceedsAnthropic`: "You are now worth more than Anthropic ({formatMoney(mode.valuation)}). Expect a call from their corp dev team."
- If `total >= 1e15`: "Your valuation is now denominated in quadrillions. Economists would like a word."

**Breakdown rows:**
- Revenue: label "Revenue (household income)", basis "{formatMoney(income)} x {formatMultiple(revenueMultiple)}".
- Debt: label "Strategic investment in growth (debt)", basis "{formatMoney(totalDebt)} x {formatMultiple(lossMultiple)}".
- Assets: label "Tangible assets (savings)", basis "{formatMoney(assets)} x 1.0x".
- Every row's `value` is `formatMoney(term)`.

**One-liners** (in this order, only when applicable):
- If income > 0: "Revenue multiple: {435.7x}. Your {income} salary is now annual recurring revenue."
- If debt > 0: "Loss multiple: {47.6x}. Your {debt} of debt has been reframed as strategic investment in growth."
- If assets > 0: "Savings valued at par: {assets} is worth {assets}. How quaint."
- If income > 0 and debt > 0: "Debt-to-income ratio: {formatDecimal(debtToIncome)}. Anthropic's loss-to-revenue ratio: {formatDecimal(lossToRevenue)}. You are {formatPercent(visionaryPct)} as visionary."
  - Scenario A, hype: "...ratio: 4.7. ...ratio: 9.2. You are 51% as visionary."
  - Scenario A, seriesH: "...0.6. You are 727% as visionary."
- If `all-zero`: the list is empty.

**Comparison lines** (`p = formatMoney(item.value)`):
- `about`: "About the same as {name} (~{p})"
- `more`: "{formatCount(ratio)}x {name} (~{p})"
- `less`: "{formatPercent(ratio*100)} of {name} (~{p})"

**Conversion:** "In unit economics, that is {formatCount(count)} {count text === '1' ? singular : plural}." For example, Scenario A hype gives "In unit economics, that is 11 Bugatti Chirons."

**`compsEmpty`:** when there are no nearest items: "Comparable transactions: none. You are category-defining."

**Tests** (`test/copy.test.js`, exact strings where given above):
- Scenario A in both modes: the full `oneLiners` array, the headline, and `breakdown[3].value === '$32.99M'` for hype.
- All-zero: headline, `compsEmpty` set, `comps` empty, `conversion` null, `oneLiners` empty.
- Pre-revenue: subtitle contains "$1,000" and "$47,619".
- Income 5e9 in hype: `notices[0]` starts "You are now worth more than Anthropic ($2.00tn)".
- All fields at 1e15: `notices` includes the quadrillion line.
- Comparison lines from a hand-built picks object give exact strings, one per relation.
- Conversion count "1" uses the singular.

### 3.5 `site/index.html`

**`<head>`:**
- `<meta charset="utf-8">`
- `<meta name="viewport" content="width=device-width, initial-scale=1">`
- `<title>What Am I Worth? A household valuation (a joke)</title>`
- A meta description.
- `<meta name="referrer" content="no-referrer">`
- `<link rel="icon" href="data:,">` — required. It stops the automatic `/favicon.ico` request and the resulting 404 console error.
- `<link rel="stylesheet" href="styles.css">`
- `<script type="module" src="js/app.js"></script>`
- `<meta name="color-scheme" content="light">`
- CSP meta:
  ```
  default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'
  ```
  - This enforces the privacy claim.
  - Consequences: no inline `<script>`, no `style="..."` attributes, and no `setAttribute('style')`. Class toggles and the `hidden` attribute only.

**Body order:**
1. `<div class="herring" aria-hidden="true">` — "Preliminary prospectus. Subject to completion. Not an offer to sell anything, least of all your house."
2. `<header class="cover">`, containing:
   - kicker "Household, Inc."
   - h1 "What Am I Worth?"
   - deck "An indicative valuation of your household, using the same multiples as a certain very large AI lab."
   - a small "offering terms" dl: Proposed symbol: HHLD / Lead underwriter: Vibes & Co. / Use of proceeds: Groceries
3. `<section id="privacy" class="notice">`. This copy must be plain and visible, not small print:
   - heading: "Important notice: your numbers never leave this device."
   - body: "There is no server, no analytics, no cookies and no storage. The maths runs entirely in your browser and is forgotten when you close or refresh the tab. Every field is optional; leave any of them blank."
   - second line: "This is a joke. It is not financial advice, and it is definitely not an offer of securities."
4. `<form id="valuation-form" novalidate autocomplete="off">`
   - `<h2>` "Schedule A: Household financial information (unaudited)"
   - `<fieldset id="mode-toggle">` with `<legend>` "Valuation basis":
     - `<input type="radio" name="mode" id="mode-hype" value="hype" checked>`, label "IPO hype" plus a hint "$2.00tn / $4.59bn revenue"
     - `id="mode-seriesH" value="seriesH"`, label "Series H" plus a hint "$965.00bn / $65.00bn run-rate"
     - The hint text is static HTML. That is acceptable, since the numbers match MODES, which is the source of truth.
     - The radio `name` is fine because the only thing it would carry is the mode.
   - `<fieldset>` "Revenue": income.
   - `<fieldset>` "Assets": savings.
   - `<fieldset>` "Strategic investments in growth (debts)": the five debt fields.
   - Each field:
     ```html
     <div class="field">
       <label for="X">...</label>
       <div class="money"><span aria-hidden="true">$</span><input id="X" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-describedby="X-hint X-error"></div>
       <p id="X-hint" class="hint">...</p>
       <p id="X-error" class="error" hidden></p>
     </div>
     ```
   - Inputs have NO `name` attribute, so a no-JS form submission could never put figures in a URL. `form-action 'none'` backs this up.
   - Ids and labels:

     | id | label | hint |
     |---|---|---|
     | income | Annual household income | "Before tax. Your ARR." |
     | savings | Savings and assets | "Cash, investments, the car you own outright. Valued at par." |
     | mortgage | Mortgage remaining | |
     | creditCards | Credit card balances | |
     | carFinance | Car finance | |
     | studentLoans | Student loans | |
     | otherLoans | Other loans | "BNPL, the loan from your brother, etc." |

     The four debt fields with no listed hint can have none, or a one-word hint.
   - Actions:
     - `<button id="submit" type="submit">` "Price my household"
     - `<button id="clear" type="button">` "Clear figures"
   - `<noscript>`: "This calculator needs JavaScript. It still sends nothing anywhere."
5. `<section id="result" hidden data-state="hidden" aria-labelledby="result-headline">`, containing:
   - kicker "Pricing supplement"
   - `h2#result-headline[tabindex=-1]`
   - `p#result-subtitle`
   - `p#result-total-label` ("Indicative valuation, {modeLabel}")
   - `p#result-total`
   - `ul#result-notices`
   - `table#breakdown`, with a caption "Summary of valuation" and a tbody to fill
   - `ul#one-liners`
   - `section#comps` with h3 "Comparable transactions", `ol#comps-list`, `p#comps-empty[hidden]` and `p#conversion`
   - `button#change-mode` (text set by JS: "Reprice on a {otherModeLabel} basis")
   - a line "Figures approximate. See the notes to the valuation below."
6. `<footer id="methodology">`, containing:
   - h2 "Notes to the valuation"
   - Note 1, "The formula":
     - a `<pre><code>` of the formula from design.md;
     - a sentence: "Income is treated as revenue, debt as a loss and savings at face value."
   - Note 2, "Source figures": `div#methodology-figures`, filled by JS from MODES. For each mode: a heading, a table of Valuation / Revenue / Losses with values and notes, a derived-multiples line, and a sources list of `<a href rel="noopener noreferrer">` links. Show `FIGURES_AS_OF`.
   - Note 3, "Comparables": the `AS_OF` date plus `DATASET_NOTE`, and a `<details id="comps-dataset">` whose `<summary>` reads "All N comparables". The list is filled by JS as "name: ~$X (note)".
   - Note 4, "Risk factors" (jokes): "Past performance of AI labs is not indicative of your household's future results. Revenue multiples may go down as well as way, way up. Your mortgage lender may not recognise debt as strategic investment in growth."
   - Note 5, "Privacy": restates the privacy statement, plus "This page's security policy forbids it from connecting to anything."

### 3.6 `site/js/app.js` (DOM wiring; not unit-tested)

**State:** a module-level object only, `{ modeId, lastInputs: null | object }`. Never persisted.

**Init:**
- `renderMethodology()` builds the footer figures and the dataset list from MODES and ITEMS.
- Wire the form `submit`, the `#clear` click, the radio `change` events and the `#change-mode` click.

**Submit:**
1. `preventDefault`.
2. Run `parseAmount` on each `FIELD_IDS` input.
3. Clear old errors, then for each failure:
   - fill `#X-error` with `FIELD_ERRORS[error]`;
   - remove `hidden` from the error;
   - set `aria-invalid="true"`.
4. If there are any errors, focus the first invalid input and stop.
5. Otherwise set `state.lastInputs` and call `update()`.

**`update()`:**
- `mode = getMode(state.modeId)`
- `result = computeValuation(state.lastInputs, mode)`
- `picks = pickComparisons(result.total)`
- `view = describeResult(result, mode, picks)`
- `presentResult(view)`

**`presentResult(view)`** — the M2 seam:
- Call `renderResult(view)`.
- Then call `#result-headline.focus({preventScroll: true})`, followed by `scrollIntoView({block: 'start'})` with no smooth behaviour in M1.
- Add a comment noting that M2 replaces this body with the reveal sequence.

**`renderResult(view)`:**
- Fills every `#result-*` element using `textContent` and `createElement` only. No `innerHTML` with dynamic data.
- Sets `#result.hidden = false` and `data-state="shown"`.
- Toggles `#comps-empty`.

**Mode change** (radio or `#change-mode`):
- Set `state.modeId` and sync the radio `checked` state.
- If `lastInputs` is set, call `update()`.

**Clear:**
- Reset the inputs, errors and `aria-invalid`.
- Set `lastInputs = null`.
- Hide `#result` (`data-state="hidden"`).
- Focus `#income`.

**Must NOT use:** `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `localStorage`, `sessionStorage`, `document.cookie`, `history.pushState`/`replaceState`, `location` writes, `console.log`, timers for animation, or `import()` of anything remote.

## 4. Visual direction: "Preliminary Prospectus" (red herring S-1 parody)

This is one committed aesthetic: a printed IPO prospectus on a desk. Think cream paper, serif body, hairline rules, double-ruled totals, footnote daggers and the red "subject to completion" legend. It should not look like a SaaS template: no cards with rounded corners and soft shadows, no gradients, no emoji and no hero illustration.

**Palette** (CSS custom properties on `:root`):

| Variable | Value | Use |
|---|---|---|
| `--desk` | `#e3dac8` | Page background outside the sheet |
| `--paper` | `#f6f1e6` | The document |
| `--field` | `#fffdf7` | Inputs and the table header band |
| `--ink` | `#1b1813` | Text |
| `--ink-2` | `#5a5249` | Secondary text; about 7:1 on paper |
| `--rule` | `#1b1813` | Hairlines, 1px |
| `--rule-soft` | `#cfc4ae` | |
| `--herring` | `#a8231a` | Legend, focus rings, errors, selected accents |

Body text must be at least 4.5:1 against `--paper`.

**Type** (system stacks only; no `@font-face`, no network):
- `--serif`: `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif`. Used for body and headings.
- `--mono`: `ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`. Used for all money, inputs and the big number, with `font-variant-numeric: tabular-nums`.
- `--sans`: `-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif`. Only for small-caps labels, buttons and the legend, uppercase with `letter-spacing: .08em`.
- Base size 17px (`1.0625rem`), `line-height` 1.5.
- Inputs at least 16px, which prevents iOS zoom.

**Signature elements:**
- **Red legend:**
  - On mobile, `.herring` is a full-width red band at the top: paper-coloured uppercase sans text at 11-12px, wrapping allowed.
  - At `>= 1024px` it becomes a fixed vertical strip down the left edge (`writing-mode: vertical-rl; transform: rotate(180deg)`) in red text on the desk colour.
- **Cover:**
  - Centred.
  - The h1 is uppercase serif, `letter-spacing: .04em`, set at `clamp(2rem, 9vw, 3.25rem)`.
  - Thin double rule (`border-top: 3px double var(--rule)`) above and below.
  - The offering-terms dl is set in small caps as a two-column grid.
- **Privacy notice:** a boxed legal notice with a 2px ink border, an uppercase sans heading and serif body at full size. It must be readable, not faded.
- **Form (Schedule A):**
  - Section headings are uppercase sans with a hairline underneath.
  - Fields: the label sits above; the input is a ledger line with `--field` background, a 1px ink border and a 2px bottom border, a mono right-aligned value, a `$` prefix inside the box, `min-height: 48px` and full width.
  - Errors appear in `--herring` with the input border also turning red.
- **Mode toggle:**
  - A two-segment control built from the radios. Inputs are visually hidden but focusable; labels are the segments.
  - Each segment has a 1px ink border and is at least 48px tall. The selected one is ink-filled with paper text.
  - Hints sit under each label in small mono.
- **Buttons:**
  - Primary: ink background, paper text, uppercase sans, full width on mobile, 52px tall, square corners. Hover or active inverts.
  - Secondary: a text button with an underline.
  - `:focus-visible` gets a 3px `--herring` outline with a 2px offset everywhere.
- **Result ("Pricing supplement"):**
  - The big number `#result-total` is mono at `clamp(2.25rem, 11vw, 4.5rem)`, bold, with a double rule underneath.
  - Add `overflow-wrap: anywhere` as a safety net. `$435.73 quadrillion` wraps at the space.
  - Breakdown table:
    - Two visual columns: first cell holds the label with the basis below it in small mono `--ink-2`; second cell holds the right-aligned mono value.
    - Hairline row rules.
    - The total row has `border-top: 3px double`.
  - Comps list: an ordered list with dagger-style markers or bracketed numbers, the value in mono.
- **Methodology:**
  - Smaller serif, set as numbered "Notes".
  - Tables scroll inside their own `overflow-x: auto` wrapper if needed. The page itself never scrolls sideways.

**Layout:**
- **375px:**
  - Sheet padding 16px.
  - Single column; every field full width; buttons stacked.
  - The sheet has no border and the desk colour is not visible, so the paper runs edge to edge.
  - Nothing may exceed the viewport. Set `html, body { overflow-x: clip }` only as a last resort; fix the actual cause first.
- **>= 640px:**
  - The sheet becomes `max-width: 46rem`, centred, with a 1px `--rule-soft` border and `--desk` visible around it. No blur shadow; at most a hard 4px offset shadow in `--rule-soft`.
  - The debt fieldset uses a 2-column grid; income and savings sit side by side.
  - Buttons are inline.
- **>= 1024px:**
  - The vertical red legend strip appears.
  - The sheet has generous 48px padding.
  - The big number has more room.

**Other rules:**
- `[hidden] { display: none !important; }`, so the CSS never un-hides things.
- No transitions or animations in M1, except the instant hover state change.

## 5. Validation criteria

1. **Unit tests:** `node --test test/*.test.js` passes with 0 failures and prints no warnings. All four test files exist and cover the cases listed in section 3.
2. **Serving:** served with `python3 -m http.server -d site 8000`, loading `/` in headless Chromium gives:
   - zero console messages of type error or warning, and zero `pageerror` events;
   - requests only to `http://localhost:8000` (`/`, `/styles.css`, `/js/*.js`);
   - no favicon request, no other origin and no `data:`-less extras.
3. **Horizontal scroll** at a 375x812 viewport: `document.documentElement.scrollWidth <= 375`. Check it:
   - on load;
   - after submitting Scenario A;
   - after submitting all fields at `1000000000000000` (the quadrillion result);
   - after triggering an error on every field (type `-5` everywhere and submit).
   - Repeat at 1280x800 and confirm the layout is centred.
4. **All fields blank:** submit shows the headline "Pre-revenue, pre-debt: pure vision.", total `$0` and the "category-defining" comps-empty line.
5. **Scenario A:**
   - hype shows `$32.99M`, the breakdown `$21.79M` / `$11.19M` / `$10,000`, "51% as visionary", 3 comparables and "11 Bugatti Chirons";
   - switching the radio to Series H re-renders `$6.15M` without resubmitting;
   - `#change-mode` flips it back.
6. **Invalid input:** `abc` in income shows the inline error with `aria-invalid="true"` and focuses it, and no result is rendered. Correcting it and resubmitting clears the error.
7. **Clear** hides the result and empties all fields.
8. **Privacy by grep:**
   - `grep -rnE "fetch\(|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage|document\.cookie|pushState|replaceState|innerHTML|https?://" site/js` finds nothing except the source URLs inside `valuation.js`.
   - `index.html` contains no `http(s)://` except inside `<a href>` source links (there should be none there either; the links are rendered from MODES).
   - There is no `@import` or `url(http` in CSS.
9. **Privacy copy** is visible without scrolling past the form on a 375px screen. It sits above the form.
10. **Scope:** only the files in section 2 were created or modified.

## 6. Sequencing

1. `format.js` and its tests. Everything else formats through it.
2. `valuation.js` and its tests, using the expected numbers in 3.2.
3. `comparisons.js` and its tests. Do the fixture tests first, then add the dataset and the real-data tests.
4. `copy.js` and its tests.
5. Run `node --test test/*.test.js` until it passes.
6. `index.html`, the full static structure including CSP and the favicon suppression.
7. `app.js` wiring. Confirm the flows by hand in a browser.
8. `styles.css`, mobile first, then the 640 and 1024 breakpoints.
9. The headless checks from section 5, using a throwaway script outside the repo.
10. The CLAUDE.md one-line command fix.

## 7. Open questions for the implementor (decide, note in `.ai/robashton/M1-notes.md`, don't block)

1. **Currency decimals.** `$965.00bn` / `$2.00tn` follow the "$X.XX" rule from design.md. That is fine for prospectus flavour, and the tests fix it. Flag it if it looks bad in the methodology table, but do not change the format rules in M1.
2. **k/M suffix input** (e.g. "50k"). It is deliberately rejected in M1 because `inputmode=decimal` keyboards lack letters. Revisit in M2 only if requested.
3. **Dark mode.** Deliberately none, since `color-scheme: light` is part of the paper aesthetic. Leave it that way.
4. **Dataset figures.** If you are confident a listed figure is materially wrong or poorly known, replace it with a better-known item at a similar magnitude. Record the change in the notes, and keep the list ascending with the counts in the tests' bounds.
5. **Mode hint text** in the HTML duplicates MODES numbers. It is acceptable because it is static and matches. Alternatively, have `app.js` fill the hints from MODES; either is fine, but pick one and keep it consistent.
6. **Resubmit and focus.** If the user resubmits with the result already visible, re-rendering and re-focusing the headline is expected behaviour in M1.

## Decisions

Implementor decisions and deviations (M1 implementation, 2026-09-29).

1. **Currency decimals (Q1).** Kept the `$X.XX` rule. It reads fine in the methodology tables (`$965.00bn`, `$2.00tn`); no change.
2. **k/M suffixes (Q2).** Still rejected as `invalid`, as planned.
3. **Dark mode (Q3).** None; `color-scheme: light` in both the meta tag and CSS.
4. **Dataset (Q4).** All 38 items kept as proposed. The G650 note now says "Approx. list price at launch, ~2013" (the $65M is the launch price). Eras Tour kept at $2.08bn, the widely reported final gross; some outlets round to ~$2.2bn, which does not change any pick materially.
5. **Mode hint text (Q5).** Static HTML, not filled by JS. It matches MODES today; if MODES figures change, the two hints in `index.html` must be updated by hand.
6. **Resubmit and focus (Q6).** Resubmitting, or flipping the radio while a result is visible, re-renders via `presentResult`, which re-focuses and scrolls to the result headline. That includes the radio case, which jumps the page to the result. This is accepted for M1; M2 may want a no-scroll path for mode flips.
7. **"a"/"an" (deviation).** The `normal` subtitle spec was "Indicative valuation on a {shortLabel} basis", which gives "on a IPO hype basis". `copy.js` exports `article(word)` and the subtitle now reads "on an IPO hype basis" / "on a Series H basis". The `#change-mode` button uses the same helper with the short label: "Reprice on an IPO hype basis" / "Reprice on a Series H basis", rather than "Reprice on a Series H mode basis". The view gains one extra field, `otherModeShortLabel`, for this.
8. **Singular conversion (deviation).** `formatCount` never returns a bare `"1"` (a count of 1 formats as `"1.0"`), so the singular noun is used when the count text is `"1"` or `"1.0"`. The test asserts "1.0 H100 GPU".
9. **Debt fields without hints.** Mortgage, credit cards, car finance and student loans have no hint element, and their `aria-describedby` references only `X-error` (no dangling ids).
10. **Markup additions.** Everything sits inside a `<main class="sheet">` (the paper), after the red legend. Income and savings are wrapped in `div.pair` and the debt fields in `div.debts` for the 640px grids. "(unaudited)" is a span so it can be set lighter. Note 1 has one extra sentence explaining that "savings + assets" is the single savings field and total debt is the sum of the five debt fields.
11. **`FIELD_IDS` / `DEBT_FIELD_IDS`** are frozen arrays. `MODES` is deep-frozen, including notes and sources.
12. **Styling.** Error state uses `:has()` to turn the ledger box and label red. The input's focus ring is drawn on the `.money` box via `:focus-within`. One-liners use a footnote-mark sequence (dagger, double dagger, section, parallel); comps use `[n]` markers. The `>= 1024px` legend strip is 3.25rem wide, and the body is padded by the same amount, so the sheet is centred in the space to the right of the strip. The result headline has a `scroll-margin-top` so the "Pricing supplement" kicker and its double rule stay in view after the scroll.
13. **Headless tooling.** Used the npx-cached `playwright` 1.59 alpha (from `~/.npm/_npx`) with `executablePath` pointed at `chromium_headless_shell-1234`. Scripts live in `/tmp/waiw-m1/`; nothing was added to the repo.
