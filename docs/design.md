# What Am I Worth? — master design doc

A joke single-page calculator: "If your household were valued like Anthropic, what
would it be worth?" The user optionally enters household finances, hits submit, gets
a dramatic reveal of their "valuation" plus a set of comparisons ("You're worth
$300M — about as much as <company>").

Tone: deadpan finance-bro parody of AI-lab valuations. Affectionate, not mean. It's a
joke — the page should say so without killing the joke.

## Hard constraints

- Static site, GitHub Pages, repo `robashton/what-am-i-worth`, served from `site/`.
- Plain HTML/CSS/JS ES modules, no build step, no dependencies, no runtime network
  calls of any kind (no CDN fonts, analytics, or fetch). Nothing persisted (no
  localStorage/cookies/URL params containing the figures).
- Prominent, plain privacy statement near the form: nothing leaves your device,
  nothing is stored; all maths runs in your browser. Every field optional.
- Mobile-first. Primary target is a phone in portrait (~375-430px). Numeric fields use
  `inputmode="decimal"`, big tap targets, no horizontal scroll.
- USD only. Respect `prefers-reduced-motion`.

## Source figures (researched 2026-09-29)

Two modes, user-toggleable. Each mode is a small data object; every figure is shown in
a footnote/"methodology" section with source links and caveats.

### "IPO hype mode" (default)

| Figure | Value | Note |
|---|---|---|
| Valuation | $2,000bn | Reported IPO target, not a priced valuation |
| Revenue | $4.59bn | 2025 revenue per reported (leaked, unconfirmed) prospectus |
| Losses | $42bn | 2025 net loss per same; ~$34bn of it non-cash. A loss, not debt |

Sources:
- https://eu.36kr.com/en/p/4003865277044616
- https://www.zerohedge.com/markets/leaked-anthropic-ipo-prospectus-shows-42bn-net-loss-518bn-unfunded-spending-commitments-and
- https://graniteshares.com/research/anthropic-ipo-2026-explained-from-965-billion-to-a-possible-2-trillion-listing/

### "Series H mode" (the boring-but-real one)

| Figure | Value | Note |
|---|---|---|
| Valuation | $965bn | Series H post-money, May 2026 |
| Revenue | $65bn | Annualised run-rate, end of July 2026 |
| Losses | $42bn | Same 2025 net loss figure |

Sources:
- https://www.anthropic.com/news/series-h
- https://techcrunch.com/2026/08/17/anthropics-annualized-revenue-surges-to-65b/

## The joke formula

Derived per mode from the figures above:

- `revenueMultiple = valuation / revenue` (hype ~435.7x, Series H ~14.8x)
- `lossMultiple = valuation / losses` (hype ~47.6x, Series H ~23.0x)

User valuation:

```
valuation = income * revenueMultiple            // "revenue" = annual household income
          + totalDebt * lossMultiple            // debt reframed as "strategic investment in growth"
          + (savings + assets) * 1              // boring tangible assets, valued at par (the joke)
```

`totalDebt` = mortgage remaining + credit cards + car finance + student loans + other
loans. All inputs optional, blank = 0, negatives rejected. Output is a breakdown of the
three terms plus a total, and a few derived one-liners (e.g. "Debt-to-income ratio:
X. Anthropic's loss-to-revenue ratio: 9.2. You are Y% as visionary.").

Edge cases the copy must handle with jokes: all zero ("Pre-revenue, pre-debt: pure
vision. Seed round incoming."), income 0 but debt > 0 ("pre-revenue"), very large
numbers (format as $X.XXbn / $X.XXtn / $X.XX quadrillion).

The formula lives in a pure module (`site/js/valuation.js`) with `node --test` unit tests.

## Comparisons

After the reveal, show ~3-5 comparisons picked from a curated dataset
(`site/js/comparisons.js`): real companies/assets/things with rough, well-known
USD values (e.g. sports clubs, small-to-mega caps, famous acquisitions, a Premier
League footballer's transfer fee, a Gulfstream, the GDP of a small nation, a single
H100, a year of Claude Max). Pick the nearest item(s) around the user's value, plus one
absurd unit conversion ("that's N Twitter acquisitions" / "N H100s"). Values are
labelled approximate; the dataset has an "as of" date. Don't invent obscure figures —
prefer widely reported ones; keep each item's number in a single place with a short
note.

## The reveal

Submit -> short "due diligence" theatre (fake status lines: "Consulting the vibes...",
"Annualising your best month...", "Adding 'AI' to the household name...") -> counter
rolls up to the valuation with an easing curve -> confetti/particle burst ->
breakdown and comparisons slide in. Pure CSS/JS (canvas or DOM), no libraries. ~3-4s
total, skippable by tap. Reduced-motion: skip theatre, show result directly.

A "Recalculate" / "Change mode" action lets the user flip modes and re-reveal.

## Roadmap

- **M1 — Working calculator.** Page structure, form, privacy copy, mode toggle,
  valuation engine + tests, comparisons dataset + picker (+ tests), results
  rendering with breakdown and comparisons, methodology/sources footer. Mobile-first
  styling with a distinctive look. Minimal/no animation yet.
- **M2 — Reveal + ship.** The reveal animation sequence, reduced-motion path,
  polish pass verified by headless screenshots at phone and desktop widths, GitHub
  Pages deploy workflow (`.github/workflows/pages.yml` publishing `site/`), README.

## Phase M1 outcomes

M1 delivered a fully working single-page household valuation calculator with all core mechanics: a form accepting seven optional financial fields, mode toggle between "IPO hype" and "Series H" valuations, client-side valuation computation using Anthropic's multiples (revenue and loss), a curated dataset of 38 comparables with smart picking and unit conversion, and a mobile-first "preliminary prospectus" aesthetic (cream paper, serif body, hairline rules, red herring legend). Four pure modules (`valuation.js`, `format.js`, `comparisons.js`, `copy.js`) with 44 passing unit tests; DOM wiring in `app.js`; no external dependencies or network calls. The calculator runs entirely in-browser and persists nothing. Result display appears instantly with no transitions.

### What downstream consumers need to know

**Module APIs and data flow:**
- `MODES`: two frozen mode objects with id, label, shortLabel, valuation, revenue, losses (with source notes), and sources array.
- `FIELD_IDS` and `DEBT_FIELD_IDS`: frozen arrays of input field identifiers.
- `getMode(id)`, `parseAmount(raw)`, `computeValuation(inputs, mode)`: valuation logic.
- `pickComparisons(value)`: returns `{nearest: [{item, ratio, relation}], conversion: {item, count} | null}`.
- `formatMoney()`, `formatMultiple()`, `formatDecimal()`, `formatCount()`, `formatPercent()`: all output en-US USD, ASCII-only.
- `describeResult(result, mode, picks)`: computes the complete view object for display.

**The M2 seam — presentResult(view):**
- Sole function in `app.js` that renders results. In M1 it calls `renderResult(view)`, then scrolls to and focuses the result headline. In M2 its body becomes "run reveal sequence, then renderResult(view)". Nothing else may render result DOM directly.
- `view` is a fully precomputed plain object from `describeResult()`, containing all final numbers and strings; M2 has the total up front (e.g. `view.total`).

**View object shape:**
- `modeId`, `modeLabel`, `otherModeId`, `otherModeLabel`, `otherModeShortLabel` (use with `article()` helper for "a"/"an").
- `total`, `totalText` (formatted money).
- `headline`, `subtitle`, `notices` (array of 0–2 banner lines).
- `breakdown`: array of `{label, basis, value}` objects; last row has `isTotal: true`.
- `oneLiners`: array of contextual joke lines.
- `comps`: array of formatted comparison strings (3 items or empty).
- `compsEmpty`: string shown when `comps` is empty, null otherwise.
- `conversion`: formatted unit conversion string (e.g. "11 Bugatti Chirons"), null if no suitable unit item.

**Result visibility and state:**
- `#result` element carries `data-state="hidden" | "shown"` for M2 theatre to hook CSS onto. The `hidden` attribute also controls visibility (CSP forbids inline styles).

**CSP constraints (no inline `<script>` or `style="..."`; `default-src 'self'`):**
- Animations must use CSS classes or CSSOM property assignment (`element.style.property = value`). `setAttribute('style')` and inline `style=""` are forbidden.
- All dynamic content uses `textContent` and `createElement`, never `innerHTML` with dynamic data.
- Test compliance with `node --test test/*.test.js` (checks for forbidden patterns) and headless browser check (CSP violations cause `console.error`).

### Deferred to later phases

- Reveal theatre: status-line animation ("Consulting the vibes…"), counter roll-up to final valuation with easing, confetti/particle burst.
- Reduced-motion path: skip theatre, show result directly when `prefers-reduced-motion` is set.
- Screenshot polish pass (layout, typography, colors verified at 375px and 1280px).
- GitHub Pages deployment workflow and README.

### For M2 planner

**Known issues:**
1. **Mode switch re-runs presentResult:** flipping the radio (or clicking the "Reprice" button) while a result is visible calls `update()`, which re-runs `presentResult`, re-focusing and scrolling to the result headline. This causes a full page jump. M2's reveal sequence should probably not replay on mode flips — consider a quieter path (e.g. just re-compute and swap values, or a brief flash instead of the full theatre).
2. **Formula scrolls horizontally on desktop:** Note 1 in the methodology footer contains a `<pre><code>` block with the valuation formula and comments. On desktop viewports, the comments are long enough to overflow the container's width, requiring horizontal scroll inside the `<pre>` box. The page itself never scrolls sideways. Cosmetic; acceptable in M1.
3. **:has() for error styling:** the error state uses `:has(input[aria-invalid="true"])` to turn the `.money` box and label red. This is supported in all modern browsers but has mild performance implications for large DOMs; acceptable here (7 fields).

## Phase M2 outcomes

M2 delivered the reveal animation sequence: a ~3.5s "due diligence" theatre (three status lines appearing and ticking), counter rolling up to the valuation in log-space, confetti burst from the total, and staggered slide-in of the breakdown and comparisons. All skippable via tap, any key, or the Skip button; users on `prefers-reduced-motion` see the result instantly. Mode flips reprice quietly in place (600ms) without replaying theatre. New modules: `reveal-math.js` (pure easing, timeline, counter, theatre line picking, seeded RNG, particles) with full `node --test` coverage, and `reveal.js` (DOM/rAF controller). Share button copies the headline valuation (not raw inputs) to clipboard. Open Graph / Twitter metadata (no image, no absolute URLs). GitHub Pages deployment via Actions. Hygiene test enforces the CSP and privacy promises: no `innerHTML`, `fetch`, `localStorage`, inline styles or scripts. Unit tests: 77 passing (44 M1 + 4 copy + 21 reveal-math + 8 hygiene). Headless validation: 27 checks passing at 375x812 and 1280x800 (full reveal, skip paths, reduced-motion, mode switch, zero errors, zero network calls).

### What downstream consumers need to know

**Module APIs:** `reveal-math.js` exports `TIMELINE`, `REPRICE_MS`, easing (`easeOutCubic`), counter math (`counterValue`, `counterText`), timeline queries (`phaseAt`, `countProgress`, `theatreState`), theatre data (`THEATRE_LINES`, `pickTheatreLines`), RNG (`mulberry32`), and particles (`spawnParticles`, `stepParticles`, `particleAlpha`). `reveal.js` exports a factory `createRevealer({ render, rng, prefersReducedMotion })` returning `reveal(view)`, `reprice(view, fromTotal)`, `finish()`, `cancel()`, `isActive()`.

**`presentResult(view, {quick})` behavior:** if `quick && state.lastView && !#result.hidden`, calls `revealer.reprice(view, state.lastView.total)` (600ms quiet update); otherwise calls `revealer.reveal(view)` (full 3.4s sequence). Reprice is used by mode switches (radio/button); resubmit always plays the full reveal.

**Hygiene test:** `test/hygiene.test.js` statically scans `site/` and enforces: no `innerHTML`/`fetch`/`XMLHttpRequest`/storage APIs in JS; no `setAttribute('style')`/`.style.cssText` (CSSOM property writes and `<canvas>` are fine); no `http://`/`https://` in JS except predefined sources in `valuation.js`; `index.html` has no `style=` attributes or inline `<script>`; `styles.css` has no `@import` or `:has()`; CSP meta with `default-src 'self'` and `connect-src 'none'` present and unchanged.

**Action versions:** checkout@v7, setup-node@v7, configure-pages@v6, upload-pages-artifact@v5, deploy-pages@v5 (latest stable majors as of 2026-09-29).

**One-time manual setup:** In the GitHub repository, go to Settings → Pages → Build and deployment → Source and select "GitHub Actions". Pushes to `main` or manual `workflow_dispatch` will then test and deploy `site/` automatically.

### Deferred to later phases

All M2 open questions were resolved by the implementor (see `## Decisions` at the end of `docs/phase-M2.md`). Visual refinements—PRICED stamp pseudo-element, confetti origin at text centre, `overflow-x: clip` on `.total-block`, scroll-anchoring allowance on reprice—shipped as CSS features. The roadmap ends at M2; M3 is optional follow-ups only.

### For M3 planner

M1's three known issues are now resolved: (1) mode flips use `reprice()` and no longer jump the page; (2) formula layout shortened to `<= 64` chars/line and no longer scrolls horizontally; (3) `:has()` error styling replaced with `.is-invalid` class toggle. No other known defects. If M3 is pursued, consider feature additions (e.g. shareable link with preset values, dark mode, OG image) rather than polish passes. The 77-unit-test suite, hygiene scan, and headless validation suite (27 checks at two widths) provide a regression baseline.
