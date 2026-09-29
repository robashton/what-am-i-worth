# What Am I Worth?

## What it is

A joke calculator that values your household the way the market values a certain
very large AI lab. Your income is treated as revenue, your debts as "strategic
investment in growth", and both are priced at that lab's multiples; your savings
are valued at par. You get a pricing supplement, a reveal, and some comparable
transactions. It is a joke. It is not financial advice and not an offer of anything.

## Privacy

- 100% client-side. The page makes no network calls at runtime; its Content
  Security Policy sets `connect-src 'none'`, so it could not phone home if it tried.
- Nothing is stored: no cookies, no localStorage or sessionStorage, no analytics,
  no fonts CDN. Refresh the tab and your figures are gone.
- Your figures never go in the URL.
- The optional "Copy summary" button writes a short summary to your clipboard only
  when you press it. It contains the headline valuation, never your individual figures.

## The formula

```
valuation = income    * revenueMultiple   // income as "revenue"
          + totalDebt * lossMultiple      // debt as "growth"
          + savings   * 1                 // savings at par
```

with `revenueMultiple = valuation / revenue` and `lossMultiple = valuation / losses`
for the chosen basis:

| Basis | Revenue multiple | Loss multiple |
|---|---|---|
| IPO hype (default) | 435.7x | 47.6x |
| Series H | 14.8x | 23.0x |

## Figures and sources

As of 2026-09-29.

**IPO hype mode.** The revenue and loss figures come from a reported, unconfirmed
leaked prospectus; the valuation is a reported IPO target, not a priced valuation.

| Figure | Value | Note |
|---|---|---|
| Valuation | $2,000bn | Reported IPO target |
| Revenue | $4.59bn | 2025 revenue per a reported (leaked, unconfirmed) prospectus |
| Losses | $42bn | 2025 net loss per the same; roughly $34bn of it non-cash |

- https://eu.36kr.com/en/p/4003865277044616
- https://www.zerohedge.com/markets/leaked-anthropic-ipo-prospectus-shows-42bn-net-loss-518bn-unfunded-spending-commitments-and
- https://graniteshares.com/research/anthropic-ipo-2026-explained-from-965-billion-to-a-possible-2-trillion-listing/

**Series H mode.**

| Figure | Value | Note |
|---|---|---|
| Valuation | $965bn | Series H post-money, May 2026 |
| Revenue | $65bn | Annualised run-rate, end of July 2026 |
| Losses | $42bn | Same 2025 net loss figure |

- https://www.anthropic.com/news/series-h
- https://techcrunch.com/2026/08/17/anthropics-annualized-revenue-surges-to-65b/

Comparables (yachts, jets, small-nation GDPs and so on) are approximate, rounded
public figures as of 2026-09; see Note 3 on the page for the full list.

## Run locally

ES modules do not load over `file://`, so serve the folder:

```
python3 -m http.server -d site 8000
```

then open http://localhost:8000/.

## Tests

Node 24, nothing to install:

```
node --test test/*.test.js
```

The pure modules (valuation, formatting, comparables, copy, reveal maths) have unit
tests. `test/hygiene.test.js` statically scans `site/` for anything the privacy
promise and the CSP forbid: network APIs, storage, `innerHTML`, inline styles or
scripts, and absolute URLs outside the source list.

## Layout

- `site/`: the deployable static site (`index.html`, `styles.css`, `js/`). No build step.
- `test/`: `node --test` unit tests and the hygiene scan.
- `docs/`: the design doc and per-phase plans.

## Deploy

Pushes to `main`, or a manual run of the workflow (`workflow_dispatch`), run the
tests and then publish `site/` as-is to GitHub Pages
(`.github/workflows/pages.yml`).

One-time setup: in the repository go to Settings -> Pages -> Build and deployment
-> Source and choose "GitHub Actions". Pages on a private repository needs a paid
plan. The site is then at `https://robashton.github.io/what-am-i-worth/`.

## Accessibility and motion

Pricing plays a short "due diligence" reveal: a few status lines, a counter that
rolls up to your valuation, and a burst of ticker tape. You can skip it at any
moment with a tap or click, any key, or the Skip button. If your system asks for
reduced motion (`prefers-reduced-motion`), there is no reveal at all and the
result appears immediately. Switching between the IPO hype and Series H bases
reprices in place without replaying it.
