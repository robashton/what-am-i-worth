# Phase M2 — Reveal + ship

## 0. Commands

System `node` v24 is fine. No nix shell, no `npm install`, no `package.json`.

- **Unit tests:** `node --test test/*.test.js`
  - Single file: `node --test test/reveal-math.test.js`
  - Do NOT use `node --test test/` (fails on Node 24.13 with `MODULE_NOT_FOUND`).
- **Serve locally:** `python3 -m http.server -d site 8000`, then open http://localhost:8000/
  - ES modules do not load over `file://`.
- **Headless checks:** throwaway scripts in `/tmp/waiw-m2/` (never in the repo). M1's `/tmp/waiw-m1/check.mjs` is a working starting point: npx-cached playwright with `executablePath` pointed at `~/Library/Caches/ms-playwright/chromium_headless_shell-1234` (full `chromium-1234` is also there). Screenshots go to `/tmp/waiw-m2/`.
- **Workflow lint (optional, recommended):** `nix run nixpkgs#actionlint -- .github/workflows/pages.yml`

Hard rules for this phase:
- No git operations (read-only `git status` is fine). The user commits and pushes.
- No drive-by scope: only the files in section 2.
- No emojis in code, docs or the README.
- No npm dependencies, no build step.
- No runtime network calls. Nothing persisted (no localStorage, sessionStorage, cookies, IndexedDB), no figures in the URL, no `location` writes, no `history.*State`.
- CSP stays exactly as it is. No inline `<script>`, no `style="..."`, no `setAttribute('style', ...)`, no `style.cssText`. CSSOM property assignment (`el.style.minHeight = '120px'`, `el.style.setProperty('--x', v)`) and `<canvas>` 2D drawing are fine.
- No `innerHTML` with any data; `textContent` + `createElement` only.

## 1. Goal and scope

**Goal:** make the result feel like an event, then ship it. Submit plays a ~3.5s "due diligence" reveal (theatre lines, counter roll-up, ticker-tape burst, staggered slide-in), skippable at any moment. Reduced-motion users get the result instantly. Flipping modes reprices quietly in place. The site is polished at phone and desktop widths, deploys to GitHub Pages via Actions, and has a README.

**In scope (M2):**
- Pure reveal maths module `site/js/reveal-math.js` (easing, timeline, counter values/text, theatre line selection, seeded RNG, particle spawn/step) with `node --test` tests.
- DOM/rAF reveal controller `site/js/reveal.js`, wired into `app.js` at the `presentResult` seam.
- Full reveal, skip (tap / click / keypress / Skip button), reduced-motion path, quick reprice on mode switch.
- a11y: single polite announcement of the final result, `aria-busy` during the reveal, focus to the headline after a full reveal, focus left alone on reprice.
- Polish: formula `<pre>` overflow; replace `:has()` error styling with a JS-set class; screenshot-driven fixes at 375x812 and 1280x800.
- A static "hygiene" test that actually enforces the CSP/privacy rules (M1 outcomes claim `node --test` checks forbidden patterns; it does not — no such test exists).
- Share button (copy text summary to clipboard). It is cheap; see 3.5/3.6.
- Open Graph / Twitter title+description meta (no image, no absolute URL).
- `.github/workflows/pages.yml` and `README.md`.

**Out of scope:**
- Any change to the valuation formula, figures, comparisons dataset, format rules or mode data.
- k/M suffix input, dark mode, OG image, favicon file, analytics of any kind.
- Changes to `docs/design.md` (the finalizer appends "Phase M2 outcomes"; the implementor does not).
- Configuring the GitHub repo itself (enabling Pages, creating the remote). The README documents it.

## 2. Files to create / modify (exhaustive)

Create:
1. `site/js/reveal-math.js` — pure: timeline constants, easing, counter, phases, theatre lines, RNG, particles.
2. `site/js/reveal.js` — DOM/rAF controller (not unit-tested).
3. `test/reveal-math.test.js`
4. `test/hygiene.test.js` — static scan of `site/` for forbidden patterns.
5. `.github/workflows/pages.yml`
6. `README.md`
7. `.ai/robashton/M2-notes.md` — implementor scratch notes / handover (tracked).

Modify:
8. `site/index.html` — result markup for the reveal, announce region, skip button, share button, OG meta, formula text.
9. `site/styles.css` — reveal states/keyframes, skip button, confetti canvas, reprice flash, reduced-motion block, `.is-invalid` instead of `:has()`, formula fix, screenshot polish.
10. `site/js/app.js` — `presentResult` seam uses the controller; reprice path; `state.lastView`; `.is-invalid` class; share wiring; clear cancels the reveal.
11. `site/js/copy.js` — add `edgeCase` to the view; add `shareText(view, pageUrl)`.
12. `test/copy.test.js` — cover `edgeCase` and `shareText`.
13. `docs/phase-M2.md` — append a `## Decisions` section at the end only (as M1 did).

Nothing else. In particular: no `package.json`, no `.nojekyll`, no images, no fonts, no favicon file, no `CNAME`, no changes to `valuation.js`, `format.js`, `comparisons.js` or their tests, no changes to `docs/design.md` or `CLAUDE.md`.

Module import rules (unchanged principle):
- `reveal-math.js` imports only `format.js`. It must not touch `document`, `window`, `performance`, `Date.now`, `Math.random` (randomness comes from an injected `rng`), `requestAnimationFrame`.
- `reveal.js` imports `reveal-math.js` (and `format.js` if needed). It never computes valuations or copy.
- `app.js` imports everything, as before.

## 3. Per-file specs

### 3.1 `site/js/reveal-math.js` (pure)

All durations in milliseconds. Export everything listed; keep names so the tests below make sense.

**Timeline (full reveal):**

```js
export const TIMELINE = Object.freeze({
  lineInterval: 350,   // a new theatre line appears every 350ms: at 0, 350, 700
  lineTick: 300,       // each line gets its "OK" 300ms after it appears (except the last)
  countStart: 1000,    // counter starts rolling
  countDuration: 1600, // counter lands at 2600
  land: 2600,          // confetti burst, stamp, theatre fades, groups slide in
  slideStagger: 100,   // group n starts at land + n*100 (n = 0..4)
  slideDuration: 400,  // last group (n=4) finishes at 2600 + 400 + 400 = 3400
  shown: 3400,         // controller sets data-state="shown", announces, focuses
  confettiDuration: 1200, // canvas burst runs 2600 -> 3800, may outlive "shown"
});
export const REPRICE_MS = 600;
export const THEATRE_LINE_COUNT = 3;
```

| t (ms) | Event |
|---|---|
| 0 | `data-state="theatre"`. Line 1 appears. Skip button appears. Everything else in `#result` is invisible but laid out. |
| 300 | Line 1 gets "OK". |
| 350 | Line 2 appears. |
| 650 | Line 2 gets "OK". |
| 700 | Line 3 (always the fixed final line, "Pricing the offering...") appears; it never gets "OK". |
| 1000 | `data-state="counting"`. Total label + total become visible; counter rolls from `$0` (log scale, easeOutCubic). |
| 2600 | `data-state="landing"`. Total shows exactly `view.totalText`, gets `.stamped`. Confetti burst starts from the total's centre. Theatre overlay fades (200ms). Reveal groups 0-4 slide in (CSS stagger). |
| 3400 | `data-state="shown"`. `aria-busy` removed, announcement set, headline focused, skip button hidden. |
| 3800 | Confetti canvas removed. |

Interactive length 3.4s; with the confetti tail 3.8s. A test asserts `3000 <= TIMELINE.shown <= 4000` and ordering (`lineInterval * (THEATRE_LINE_COUNT - 1) < countStart < land <= shown`, `land === countStart + countDuration`, `shown === land + slideStagger * 4 + slideDuration`).

**Functions:**

- `clamp01(x)` — clamp to [0, 1]; `NaN` -> 0.
- `easeOutCubic(t)` — `1 - (1 - clamp01(t)) ** 3`. Exactly 0 at 0 and 1 at 1; monotonic non-decreasing.
- `counterValue(from, to, progress)` — interpolates in `log1p` space: `expm1(log1p(from) + (log1p(to) - log1p(from)) * clamp01(progress))`. Returns exactly `to` when `progress >= 1` and exactly `from` when `progress <= 0` (return the endpoints directly, do not rely on float round-trip). Works for `to < from` (reprice downwards) and `from === to` (constant). Inputs are `>= 0` finite numbers; throw `RangeError` otherwise. Log space is deliberate: from 0 the counter visibly climbs through `$1,000` -> `$1.00M` -> `$1.00bn` rather than sitting in the final unit for the whole roll.
- `counterText(value)` — `formatMoney(Math.max(0, value))`. So `counterText(counterValue(0, total, 1)) === formatMoney(total)`, i.e. equal to `view.totalText`.
- `phaseAt(elapsed)` — `'theatre'` for `< countStart`, `'counting'` for `< land`, `'landing'` for `< shown`, `'shown'` otherwise (negative elapsed -> `'theatre'`).
- `countProgress(elapsed)` — `easeOutCubic((elapsed - countStart) / countDuration)`, so 0 before `countStart`, 1 from `land` on.
- `theatreState(elapsed, lineCount = THEATRE_LINE_COUNT)` — returns `{ visible, ticked }`: `visible = min(lineCount, floor(max(0, elapsed) / lineInterval) + 1)`; `ticked` = number of lines (excluding the last line) whose `appearAt + lineTick <= elapsed`. Examples: `0 -> {1,0}`, `299 -> {1,0}`, `300 -> {1,1}`, `350 -> {2,1}`, `650 -> {2,2}`, `700 -> {3,2}`, `5000 -> {3,2}`.
- `THEATRE_LINES` — frozen object:
  - `general`: at least 10 deadpan ASCII lines, each ending in `...`, each `<= 44` characters (fits one line at 375px in the theatre font). Include the three from design.md ("Consulting the vibes...", "Annualising your best month...", "Adding 'AI' to the household name..."), plus e.g. "Reclassifying the mortgage as capex...", "Ignoring the losses, as is customary...", "Benchmarking against a very large AI lab...", "Pivoting the household to agents...", "Hiring a Chief Vibes Officer...", "Extrapolating from one good quarter...", "Printing the red herring...". Do not name real people; real-company jokes only if affectionate.
  - `byEdgeCase`: `{ 'all-zero': 'Searching for revenue... none found...', 'pre-revenue': 'Confirming the absence of revenue...', 'assets-only': 'Locating the debt... there is no debt...', 'debt-free': 'Looking for leverage... alarmingly little...' }` (wording is the implementor's; keep the "..." ending and length rule).
  - `final`: `'Pricing the offering...'`.
- `pickTheatreLines(edgeCase, rng)` — returns an array of exactly `THEATRE_LINE_COUNT` distinct strings: `[first, second, final]`. `first` is `byEdgeCase[edgeCase]` if present, else a random `general` line; `second` is a random `general` line different from `first`; last is always `final`. `edgeCase` of `null`/`undefined`/unknown -> general. `rng` is a function returning `[0, 1)`.
- `mulberry32(seed)` — tiny seeded PRNG returning a `() => number` in `[0, 1)`. Used by tests; `reveal.js` passes `Math.random` in production.
- `particleCountFor(viewportWidth)` — `90` below 640px, `140` otherwise.
- `spawnParticles(count, origin, rng)` — returns an array of plain objects `{ x, y, vx, vy, w, h, angle, spin, colour, age: 0 }`. `origin = {x, y}` in CSS px. Velocity: angle uniformly in `[-160deg, -20deg]` (upward cone; screen y grows downward), speed `350..750` px/s. `w` 4..8, `h` 8..14, `spin` -12..12 rad/s. `colour` picked from `PARTICLE_COLOURS = ['#a8231a', '#1b1813', '#cfc4ae', '#fffdf7']` (the palette: herring, ink, rule-soft, field — "ticker tape", not rainbow confetti).
- `stepParticles(particles, dt)` — `dt` in seconds (callers clamp to `<= 0.05`). Mutates and returns the same array: `vy += GRAVITY * dt` (`GRAVITY = 1400`), `vx *= 1 - DRAG * dt` (`DRAG = 1.2`, floor at 0 factor), `x += vx*dt`, `y += vy*dt`, `angle += spin*dt`, `age += dt*1000`.
- `particleAlpha(p)` — 1 until `age >= confettiDuration - 300`, then linear to 0 at `confettiDuration`; clamp to [0, 1].

### 3.2 `test/reveal-math.test.js`

Cover at least:
- TIMELINE ordering and total-length assertions above; `REPRICE_MS` between 300 and 1000.
- `clamp01` edges incl. `NaN`, `-1`, `2`.
- `easeOutCubic`: 0 -> 0, 1 -> 1, 0.5 -> 0.875, monotonic over 101 samples, clamps outside [0,1].
- `counterValue`: endpoints exact for `(0, 32986968.56520386)`, `(32986968.56520386, 6151712.454212453)` (Scenario A hype -> Series H), `(0, 0)` stays 0, `(5, 5)` constant; monotonic up for 0 -> 4.4e17 and monotonic down for the reprice case over 101 samples; mid-point of `0 -> 999999` is ~`999` (log scale, not linear); throws on negative / non-finite.
- `counterText(counterValue(0, x, 1)) === formatMoney(x)` for `0, 950000, 32986968.56520386, 1e15, 4.357e17`; intermediate texts over a 0 -> 1e15 roll include at least one `$...M`, `...bn`, `...tn` and `... quadrillion` string (proves it climbs through units).
- `phaseAt` at `-5, 0, 999, 1000, 2599, 2600, 3399, 3400, 1e9`.
- `countProgress` at `0, 1000, 1800, 2600, 9999` (0, 0, 0.875, 1, 1).
- `theatreState` examples listed above.
- `pickTheatreLines`: length 3, distinct, last is `final`, first is the edge-case line for each of the four edge cases, general for `null`/`'unknown'`; deterministic for the same `mulberry32` seed; all lines across `THEATRE_LINES` end with `...`, are ASCII, `<= 44` chars; `general.length >= 10`; covers a spread of outputs over 200 seeds (at least 5 distinct firsts for `null`).
- `mulberry32`: deterministic, values in `[0, 1)`.
- `spawnParticles`: count respected; all fields present and in the stated ranges; every `vy < 0` at spawn (upward); colours from `PARTICLE_COLOURS`; deterministic for a seed.
- `stepParticles`: after one step `vy` increased by `GRAVITY * dt`; y eventually increases (falls) after 1s of 16ms steps; `age` accumulates in ms.
- `particleAlpha`: 1 at age 0 and 800, ~0.5 at 1050, 0 at 1200 and beyond.

### 3.3 `site/js/reveal.js` (DOM controller)

Export one factory:

```js
export function createRevealer({ render, rng = Math.random, prefersReducedMotion }) -> {
  reveal(view),        // full sequence (or instant under reduced motion)
  reprice(view, fromTotal), // quick in-place reprice
  finish(),            // jump the active sequence to its final state (idempotent)
  cancel(),            // stop everything without rendering (used by Clear)
  isActive(),          // true while a full reveal or reprice is animating
}
```

- `render(view)` is `app.js`'s `renderResult` (fills all result content; see 3.6). The controller owns: `#result`'s `data-state` and `aria-busy`, the theatre overlay, the skip button, the counter text in `#result-total` during animation, `aria-hidden` on `#result-total` while it ticks, `#result-announce`, the confetti canvas, the `.stamped` / `.flash` classes, focus and scroll.
- `prefersReducedMotion` is a function (`() => matchMedia('(prefers-reduced-motion: reduce)').matches`), evaluated on every `reveal`/`reprice` call, never cached.
- One rAF loop per sequence driven by `performance.now() - startTime`. No `setTimeout`/`setInterval` chains for the timeline. Each frame: compute `phaseAt`, apply the phase to `data-state` only when it changes; update theatre line visibility/ticks from `theatreState`; during `counting` write `counterText(counterValue(0, view.total, countProgress(elapsed)))` to `#result-total` only when the text changed. On entering `landing`: write `view.totalText` exactly, add `.stamped`, start confetti. On reaching `shown`: run `complete()`.
- Background tabs: rAF pauses; on resume the elapsed time is past `shown`, so the next frame completes. That is the desired behaviour; do not special-case it.

**`reveal(view)` — full path:**
1. If a sequence is active, `finish()` it first (no overlap, no double canvases).
2. `render(view)`; then in the same task (before any paint): set `#result-total.textContent = '$0'`, set `aria-hidden="true"` on `#result-total`, `aria-busy="true"` on `#result`, clear `#result-announce`, fill the theatre `<ol>` with the three `pickTheatreLines(view.edgeCase, rng)` lines (each an `<li>` with the line text in a span and an initially-hidden `<span class="tick">OK</span>`), un-hide `#theatre` and `#skip-reveal`, set `data-state="theatre"`.
3. Reserve the counter's final height to stop layout shift: measure `#result-total.getBoundingClientRect().height` with the final text in it (set `view.totalText`, measure, then set `'$0'`), and set `el.style.minHeight = px` (CSSOM). Clear it in `complete()`.
4. Scroll: `#result.scrollIntoView({ block: 'start' })` (instant, as M1). Do not move focus yet.
5. Install skip listeners (below), start the rAF loop.

**Reduced motion (`prefersReducedMotion()` true):** `render(view)`, `data-state="shown"`, set the announcement, focus the headline with `preventScroll: true`, `scrollIntoView({ block: 'start' })`. No theatre, no counter, no canvas, no skip button, no `aria-busy`. Identical to M1 plus the announcement.

**`complete()` (shared end state, used by the loop, `finish()` and the reduced-motion path):**
- `#result-total.textContent = view.totalText`; remove `aria-hidden` and `style.minHeight`.
- Hide `#theatre` and `#skip-reveal`; `data-state="shown"`; remove `aria-busy`.
- `#result-announce.textContent = announcementFor(view)`: `` `${view.headline} Indicative valuation, ${view.modeLabel}: ${view.totalText}.` `` Set it once per sequence (clear it at sequence start so a repeated identical string is re-announced).
- Remove skip listeners. Cancel the rAF loop.
- Full reveal only: focus `#result-headline` with `{ preventScroll: true }`.
- On `finish()` (a skip), also stop and remove the confetti canvas immediately and remove `.stamped`. When completing naturally at 3400, leave the confetti running to 3800 (it is `pointer-events: none`).

**Skip:**
- Triggers while a full reveal is active: a `click` anywhere (document, capture phase), a `keydown` of any key except `Tab`, `Shift`, `Control`, `Alt`, `Meta` (document, capture), or activating `#skip-reveal`.
- Every trigger calls `finish()`. The event is otherwise left alone, with two exceptions so a skip never restarts the show: `Enter` and `Space` keydowns are `preventDefault()`ed, and a `click` whose target is inside `#submit` is `preventDefault()`ed. Net rule: "while the reveal runs, the first tap or keypress only skips."
- Touch-scrolling does not fire `click`, so scrolling during the reveal does not skip. That is intended.
- Ignore triggers in the first 50ms after `reveal()` started (defensive against the submitting gesture).

**`reprice(view, fromTotal)` — mode switch while a result is shown:**
1. If a full reveal is active, `finish()` it first (then reprice from its final total).
2. `render(view)` (all text swaps instantly: headline, subtitle, breakdown, one-liners, comps, conversion, change-mode label).
3. Reduced motion: done; set the announcement; nothing else.
4. Otherwise: set `aria-hidden` on `#result-total`, clear the announcement, set `data-state="shown"` (unchanged), add `.flash` to `#result-total` and `#breakdown` (CSS animation, `REPRICE_MS`), run a rAF loop writing `counterText(counterValue(fromTotal, view.total, easeOutCubic(elapsed / REPRICE_MS)))`, and at the end write `view.totalText`, remove `aria-hidden`, remove `.flash`, set the announcement.
5. No theatre, no confetti, no skip button, no `scrollIntoView`, no focus change. `window.scrollY` must not change (see 5.4).
6. The reprice counter is not skippable (600ms); any new reprice/reveal/clear call `finish()`es or `cancel()`s it first.

**`cancel()`:** stop the loop, remove the canvas, remove listeners, clear `minHeight`/`aria-hidden`/`aria-busy`, hide theatre and skip button, clear announcement. Does not touch `hidden`/`data-state` (Clear in `app.js` does that).

**Confetti:**
- Create a `<canvas class="confetti" aria-hidden="true">` and append it to `<body>` at `landing`; remove it when all particles have `particleAlpha === 0` or after `confettiDuration`, whichever first.
- Size: `canvas.width = Math.round(innerWidth * dpr)`, `canvas.height = Math.round(innerHeight * dpr)` with `dpr = Math.min(devicePixelRatio || 1, 2)`; `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`. Its CSS box comes from the `.confetti` class (fixed, `inset: 0`, `width: 100%`, `height: 100%`). Never `100vw` (scrollbar width causes horizontal scroll on desktop).
- Origin: centre of `#result-total`'s bounding rect (viewport coordinates, matches a fixed canvas).
- Loop: its own rAF, `dt = min(0.05, frameDelta)`, `stepParticles`, then clear and draw each particle as a rotated filled rect with `globalAlpha = particleAlpha(p)`.
- Only ever one canvas in the DOM.

### 3.4 `site/index.html`

- **Head:** keep the CSP meta unchanged. Add after the description meta:
  - `<meta property="og:type" content="website">`
  - `<meta property="og:title" content="What Am I Worth? A household valuation (a joke)">`
  - `<meta property="og:description" content="...">` (same text as the description meta, or a punchier variant, <= 200 chars)
  - `<meta name="twitter:card" content="summary">`
  - No `og:image`, no `og:url` (no absolute URLs in the HTML; the hygiene test enforces it).
- **Result section** (`#result`, keep `hidden`, `data-state="hidden"`, `aria-labelledby`): restructure to

```html
<section id="result" class="supplement" hidden data-state="hidden" aria-labelledby="result-headline">
  <p class="kicker">Pricing supplement</p>
  <div class="result-head">
    <div id="theatre" class="theatre" hidden>
      <p class="theatre-title">Due diligence in progress</p>
      <ol id="theatre-lines" class="theatre-lines" aria-hidden="true"></ol>
    </div>
    <div data-reveal="0">
      <h2 id="result-headline" tabindex="-1"></h2>
      <p id="result-subtitle" class="subtitle"></p>
    </div>
  </div>
  <div class="total-block">
    <p id="result-total-label" class="total-label"></p>
    <p id="result-total" class="total"></p>
  </div>
  <ul id="result-notices" class="notices" data-reveal="1"></ul>
  <div class="table-wrap" data-reveal="1"> ...breakdown table unchanged... </div>
  <ul id="one-liners" class="one-liners" data-reveal="2"></ul>
  <section id="comps" class="comps" data-reveal="3" ...> ...unchanged... </section>
  <div class="result-actions" data-reveal="4">
    <button id="change-mode" type="button" class="btn-secondary"></button>
    <button id="share" type="button" class="btn-secondary" hidden>Copy summary</button>
    <p id="share-status" class="share-status" role="status"></p>
    <p class="share-note">Copies your headline valuation (not your inputs) to your clipboard. Nothing is sent anywhere; you choose where to paste it.</p>
  </div>
  <p class="fineprint" data-reveal="4">Figures approximate. See the notes to the valuation below.</p>
</section>
```

  - `data-reveal` values 0-4 are the slide-in stagger groups. If `#result-notices` is hidden (empty), group 1 still works via the table.
  - The theatre title ("Due diligence in progress") is readable text; the lines are `aria-hidden` flavour.
- **Outside `#result`**, just before `</main>`:
  - `<button id="skip-reveal" type="button" class="skip-reveal" hidden>Skip due diligence</button>`
  - `<p id="result-announce" class="visually-hidden" aria-live="polite" aria-atomic="true"></p>` — the ONLY live region for the result. `#result-total` must not be a live region.
- **Share status** `#share-status` (`role="status"`) is separate from the result announcement; it only ever says "Summary copied to your clipboard." or "Could not copy. Select and copy the valuation by hand."
- **Note 1 formula:** replace the `<pre><code>` with a narrower layout whose longest line is `<= 64` characters, e.g.

```
valuation = income    * revenueMultiple  // income as "revenue"
          + totalDebt * lossMultiple     // debt as "growth"
          + savings   * 1                // savings at par
```

  Keep the explanatory paragraph under it. design.md's copy of the formula is not changed.
- **Note 5 (Privacy):** add one sentence: "The optional Copy summary button puts your headline valuation on your clipboard only when you press it; it never includes your individual figures."

### 3.5 `site/js/copy.js` and `test/copy.test.js`

- `describeResult` adds `edgeCase: result.edgeCase` (`null` for the normal case) to the view. Tests: Scenario A `edgeCase === null`, all-zero `'all-zero'`, etc. for all four edge cases already exercised in the file.
- New `export function shareText(view, pageUrl)`: returns a single ASCII string, e.g.

  `"What Am I Worth? My household was just valued at $32.99M on an IPO hype basis, using a certain very large AI lab's multiples. About the same as <first comp name>. Price yours (a joke; nothing leaves your device): <pageUrl>"`

  - Uses only `view.totalText`, the mode short label (derive from `view.modeLabel`/mode; add `modeShortLabel` to the view if simpler — then test it), `view.headline` for edge cases if you prefer, and at most the first comparison line.
  - Must NOT contain the user's raw inputs (income, debt, savings) or the breakdown `basis` strings. Test: Scenario A share text contains `$32.99M` and does not contain `$50,000`, `$235,000` or `$10,000`.
  - `pageUrl` omitted/empty -> no trailing URL clause. `app.js` passes `location.origin + location.pathname` (never `search`/`hash`).
  - All-zero: something like "My household was valued at $0: pre-revenue, pre-debt, pure vision." Test it.

### 3.6 `site/js/app.js`

- `state` gains `lastView: null | view`. Still never persisted.
- Create one revealer at init: `createRevealer({ render: renderResult, prefersReducedMotion: () => matchMedia('(prefers-reduced-motion: reduce)').matches })`.
- `renderResult(view)`: unchanged content filling, but it no longer sets `data-state` (the controller owns it). It still sets `#result.hidden = false`.
- `update({ quick })`: computes the view as before, then `presentResult(view, { quick })`, then `state.lastView = view`.
- `presentResult(view, { quick = false } = {})` — the seam:
  - `quick && state.lastView && !#result.hidden` -> `revealer.reprice(view, state.lastView.total)`.
  - otherwise -> `revealer.reveal(view)`.
  - Keep the comment: nothing else renders result DOM.
- Submit -> `update({ quick: false })` (always a full reveal, even when a result is already shown; the user asked to be priced again).
- `setMode` (radio change and `#change-mode`) -> `update({ quick: true })`.
- Clear -> `revealer.cancel()` first, then existing behaviour; also `state.lastView = null`; also reset `#share-status`.
- Validation errors: in addition to `aria-invalid`, toggle `.is-invalid` on the input's closest `.field` (set on error, removed in `clearErrors`).
- Share: at init, if `navigator.clipboard && typeof navigator.clipboard.writeText === 'function'`, un-hide `#share`. On click: `navigator.clipboard.writeText(shareText(state.lastView, location.origin + location.pathname))`, then set `#share-status` text accordingly (success / failure). Clear the status on the next reveal/reprice. No fallback `execCommand`.
- Still must NOT use: `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `localStorage`, `sessionStorage`, `document.cookie`, `history.*State`, `location` writes, `console.log`, `innerHTML`.

### 3.7 `site/styles.css`

Keep the prospectus aesthetic. Motion should feel like print: things are stamped and slid, not bounced. No rounded corners, no gradients, no blur shadows.

- **Utility:** `.visually-hidden` (standard clip pattern, same as `.segments input`).
- **Error state:** replace the two `:has()` rules with `.field.is-invalid .money { border-color: var(--herring); }` and `.field.is-invalid > label { color: var(--herring); }`. No `:has()` anywhere afterwards.
- **Reveal layout:** `.result-head { position: relative; }`. `.theatre { position: absolute; inset: 0; z-index: 1; background: var(--paper); overflow: hidden; }` so it overlays the headline/subtitle area without shifting layout. Theatre lines: mono, `0.875rem`, `line-height: 1.45`, no bullets; `.tick` in `--herring`, bold, preceded by a space. Title small uppercase sans like `.kicker`.
  - The overlay must fit inside `.result-head` at both widths (headline + subtitle is taller than title + 3 lines). Verify in screenshots; if it does not fit at 1280, give `.result-head` a `min-height` in all states (never only during the reveal, which would shift layout at "shown").
- **Phase states** (keyed on `#result[data-state]`):
  - `theatre`: `[data-reveal]` and `.total-block` are `visibility: hidden; opacity: 0`.
  - `counting`: `.total-block` visible; `[data-reveal]` still hidden; `.theatre` still visible.
  - `landing`: `.theatre` fades out over 200ms (`animation`, then hidden by `complete()`); `[data-reveal]` run `@keyframes reveal-in` (from `opacity: 0; transform: translateY(12px)` to none), `400ms` `cubic-bezier(.2,.7,.2,1)` `both`, with `animation-delay: calc(var(--i) * 100ms)`; set `--i` per group in CSS via `[data-reveal="0"] { --i: 0 }` ... `[data-reveal="4"] { --i: 4 }`.
  - `shown` / `hidden`: no reveal styling at all (so the reprice and reduced-motion paths show everything).
  - Vertical translation only. Nothing translates on the x-axis.
- **Stamp:** `.total.stamped { animation: stamp 260ms ease-out; }`, keyframes scale `1.06 -> 1` with `transform-origin: left center`. The scale must not cause page overflow; the scrollWidth sampler (5.3) checks it, and open question 4 covers the fix if it does.
- **Flash (reprice):** `.flash { animation: flash 600ms ease-out; }`, keyframes background from `rgb(168 35 26 / 0.12)` to transparent.
- **Skip button:** `.skip-reveal { position: fixed; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 20; min-height: 44px; padding: 0.5rem 1.25rem; background: var(--ink); color: var(--paper); border: 2px solid var(--ink); }` in the uppercase sans button style. `translateX(-50%)` on a fixed element does not create page overflow; verify anyway.
- **Confetti:** `.confetti { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; }`.
- **Share:** `#share` sits next to `#change-mode` (stacked on mobile, inline >= 640px, with a gap). `.share-status`, `.share-note`: small `--ink-2` text; `.share-status:empty { display: none; }`.
- **Formula:** keep `overflow-x: auto` on `.note pre` as a safety net; with the shorter formula it must not scroll internally at >= 640px.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-delay: 0s !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; } }` as belt-and-braces (the JS path never enters the theatre states anyway).
- **Screenshot polish:** fix whatever the screenshots show (spacing of the result on desktop, the big number's rhythm, the 1024px legend strip overlap, etc.). Record each fix in Decisions.

### 3.8 `test/hygiene.test.js`

A static scan with `node:fs` (no DOM). Read every `site/js/*.js`, `site/index.html`, `site/styles.css`. Assert:
- No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` in JS.
- No `setAttribute('style'` / `setAttribute("style"`, no `.style.cssText`, no `.style = ` string assignment in JS.
- No `fetch(`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `pushState`, `replaceState`, `import(` in JS.
- No `http://` or `https://` in any JS file except `valuation.js` (sources).
- `index.html`: no `style=` attribute, no `<script>` without `src`, no `http://`/`https://` anywhere, CSP meta present with `default-src 'self'` and `connect-src 'none'`.
- `styles.css`: no `@import`, no `url(http`, no `@font-face`, no `:has(`.
- Pure modules (`format.js`, `valuation.js`, `comparisons.js`, `copy.js`, `reveal-math.js`) contain no `document`, `window`, `Math.random`, `Date.now`, `performance.`, `requestAnimationFrame`.
Strip `//` line comments before matching JS rules so explanatory comments like "never use innerHTML" do not trip it (or reword such comments).

### 3.9 `.github/workflows/pages.yml`

```yaml
name: Deploy site to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
      - run: node --test test/*.test.js

  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v5
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with:
          path: site
      - id: deployment
        uses: actions/deploy-pages@v4
```

- GitHub-hosted `ubuntu-latest`, not a self-hosted runner.
- `cancel-in-progress: false` so an in-flight production deploy is not killed mid-way (GitHub's recommended setting for Pages).
- No build step; the artifact is `site/` verbatim. No `.nojekyll` needed (Actions-based Pages does not run Jekyll).
- Lint with actionlint if available (section 0); at minimum check it parses as YAML.

### 3.10 `README.md`

Plain, short, no emojis, no badges that fetch images. Sections:
1. **What it is** — one paragraph: household valuation using a certain AI lab's multiples; it's a joke; not financial advice.
2. **Privacy** — 100% client-side, no network (CSP `connect-src 'none'`), nothing stored, no analytics/cookies/fonts CDN, figures never in the URL; the Copy summary button only writes to your clipboard when pressed and excludes your inputs.
3. **The formula** — the three-term formula and the derived multiples per mode (435.7x / 47.6x hype; 14.8x / 23.0x Series H).
4. **Figures and sources** — the two mode tables (valuation, revenue, losses) with the source URLs from design.md, "as of 2026-09-29", plus a note that hype-mode figures come from a reported, unconfirmed leaked prospectus. Comparables: approximate, as of 2026-09, see Note 3 on the page.
5. **Run locally** — `python3 -m http.server -d site 8000`; ES modules need a server, not `file://`.
6. **Tests** — `node --test test/*.test.js` (Node 24, no install). Mention the hygiene test.
7. **Layout** — `site/`, `test/`, `docs/`.
8. **Deploy** — pushes to `main` (or manual `workflow_dispatch`) run tests then publish `site/` via GitHub Actions. One-time setup: repo Settings -> Pages -> Source: "GitHub Actions". Pages from a private repo needs a paid plan. Expected URL `https://robashton.github.io/what-am-i-worth/` (README may contain URLs; the hygiene test only scans `site/`).
9. **Accessibility / motion** — reveal is skippable (tap, any key, Skip button) and skipped entirely under `prefers-reduced-motion`.

### 3.11 `.ai/robashton/M2-notes.md`

Status, commands used, headless script location, screenshot paths, anything the verifier/finalizer needs. Tracked; do not gitignore.

## 4. Accessibility summary

- One polite live region, `#result-announce`, set exactly once at the end of each reveal/reprice (cleared at the start). Counter ticks are never announced: `#result-total` is `aria-hidden="true"` while ticking and is not a live region.
- `aria-busy="true"` on `#result` for the duration of a full reveal.
- Theatre lines are `aria-hidden`; the theatre title is readable text.
- Skip: a real `<button>` with visible text, plus any key and any click/tap. Enter/Space during the reveal skip without resubmitting.
- Focus: full reveal and reduced-motion reveal end with focus on `#result-headline` (`preventScroll: true`; the section was already scrolled into view at the start). Reprice leaves focus where it was (the radio or `#change-mode`).
- Reduced motion: no theatre, counter, confetti or slide-in; result appears instantly.
- The skip button and share button meet the 44px tap target; focus rings unchanged (3px herring).

## 5. Validation criteria

1. **Unit tests:** `node --test test/*.test.js` passes, 0 failures, no warnings. New files `test/reveal-math.test.js` and `test/hygiene.test.js` cover sections 3.2 and 3.8; `test/copy.test.js` covers `edgeCase` and `shareText`. The 44 M1 tests still pass unchanged (except intentional additions in `copy.test.js`).
2. **Console and network** (headless Chromium, at 375x812 and 1280x800, across every flow below): zero console `error`/`warning`, zero `pageerror`, and every request is same-origin to the local server (`/`, `/styles.css`, `/js/*.js`). No CSP violation reports.
3. **Horizontal scroll during and after the reveal:** at 375x812, install a rAF sampler (via `page.evaluate`) that records the max of `document.documentElement.scrollWidth` every frame from submit until 4000ms. Max `<= 375` for Scenario A and for the quadrillion case (all fields `1000000000000000`). Same at 1280x800 (`<= 1280`). Also `<= 375` in the final state and after a reprice.
4. **Full reveal (Scenario A**: income 50000, savings 10000, mortgage 200000, creditCards 5000, carFinance 10000, studentLoans 20000; hype mode):
   - Record `#result[data-state]` transitions with a MutationObserver: exactly `theatre -> counting -> landing -> shown`.
   - At ~500ms: 2 theatre lines visible, the first ticked; `.total-block` not visible.
   - At ~1800ms: `#result-total` text is a valid money string `!== '$32.99M'` and `!== '$0'` (mid-roll); `aria-hidden="true"` on it.
   - At ~2800ms: exactly one `canvas.confetti` in the DOM.
   - At 4000ms: `data-state="shown"`, total `$32.99M`, `aria-hidden` absent, no `aria-busy`, `#theatre` and `#skip-reveal` hidden, `document.activeElement.id === 'result-headline'`, no canvas, `#result-announce` text contains `$32.99M`.
   - `#result-announce` changed to a non-empty value exactly once during the sequence.
5. **Skip:** for each of (a) `page.mouse.click` on a blank area of the page, (b) `page.keyboard.press('Escape')`, (c) clicking `#skip-reveal`, (d) pressing `Enter` with focus still on `#submit` — triggered at ~400ms: within 2 frames `data-state="shown"`, total `$32.99M`, no canvas, and (d) did not start a second reveal (no further `theatre` transition in the next 1000ms).
6. **Reduced motion:** `page.emulateMedia({ reducedMotion: 'reduce' })`, submit Scenario A: within 100ms `data-state="shown"`, total `$32.99M`; the observer never saw `theatre`/`counting`/`landing`; no canvas ever created; focus on the headline; announcement set.
7. **Mode switch does not replay the theatre:** after a full reveal completes, record `window.scrollY`, then click the Series H segment label. Observer sees no `theatre` state; no canvas; `scrollY` unchanged (+/- 1px); focus stays on the radio; after 800ms total is `$6.15M`, subtitle/breakdown updated. Then click `#change-mode`: back to `$32.99M`, focus stays on `#change-mode`, no scroll. Mode switch during a reveal (~500ms) completes the reveal then reprices, ending at `$6.15M`, no errors.
8. **Clear during reveal** (~1500ms): result hidden, no canvas, skip button hidden, no errors; a subsequent submit plays a clean full reveal.
9. **Edge cases through the reveal:** all-blank submit shows first theatre line from `byEdgeCase['all-zero']`, ends at `$0` with the "pure vision" headline; quadrillion case ends at the M1 quadrillion total with the counter having passed through `tn` (sample text at ~2200ms).
10. **Errors:** `-5` in every field -> no reveal starts, errors shown, the `.money` boxes and labels are red via `.is-invalid` (check computed `border-color` on one `.money`), no `:has(` in CSS.
11. **Share:** in headless Chromium grant `clipboard-read`/`clipboard-write` (context permissions) and click `#share`: clipboard text contains `$32.99M`, does not contain `50,000`/`235,000`, `#share-status` says copied. No network request results.
12. **Formula:** at 1280x800 and 768x1024, `pre.scrollWidth <= pre.clientWidth` for the Note 1 formula.
13. **Screenshots** saved in `/tmp/waiw-m2/` at both 375x812 and 1280x800: `theatre` (~500ms), `counting` (~1800ms), `landing` with confetti (~2800ms), `final` (viewport, after 4000ms), `final-full` (full page), `reprice-seriesH`, `reduced-motion`, `errors`, `formula`. The implementor looks at them and fixes anything ugly; the verifier re-inspects.
14. **Privacy by grep** still holds (the hygiene test automates it); the CSP meta is byte-identical to M1.
15. **Workflow:** `.github/workflows/pages.yml` parses (actionlint clean if available), triggers on push to `main` and `workflow_dispatch`, has `pages: write` + `id-token: write` + `contents: read`, `concurrency: group: pages`, uses configure-pages / upload-pages-artifact (`path: site`) / deploy-pages, with tests gating deploy.
16. **Scope:** only the files in section 2 were created or modified.

## 6. Sequencing

1. `test/hygiene.test.js` first, run it against the M1 code (it should pass apart from `:has(` in CSS; that rule goes green in step 6).
2. `site/js/reveal-math.js` + `test/reveal-math.test.js` until green.
3. `copy.js` (`edgeCase`, `shareText`) + `copy.test.js`.
4. `index.html` markup (result restructure, theatre, skip, announce, share, OG meta, formula, Note 5).
5. `site/js/reveal.js`.
6. `app.js` integration (`presentResult` seam, reprice path, `.is-invalid`, share, clear/cancel) and the CSS: states, keyframes, skip, confetti, flash, reduced-motion, `:has()` removal, formula.
7. Manual check in a real browser at a phone width and desktop, including skipping and mode flips.
8. Headless checks from section 5 (script in `/tmp/waiw-m2/`), screenshots, polish iterations. Re-run unit tests after every CSS/JS change.
9. `.github/workflows/pages.yml` (+ actionlint).
10. `README.md`.
11. `.ai/robashton/M2-notes.md` and the `## Decisions` section appended to this file.

## 7. Open questions for the implementor (decide, record in Decisions, don't block)

1. **Scroll at reveal start.** Instant `scrollIntoView` (M1 behaviour) is specified for determinism. `behavior: 'smooth'` may feel nicer on a phone; if you switch, make sure the theatre is on-screen by ~300ms and the headless mid-reveal screenshots still capture it, and keep instant under reduced motion.
2. **Theatre overlay fit.** If the 3-line overlay does not fit inside `.result-head` for short headlines at 1280, choose between a permanent `.result-head` min-height or dropping to 2 random lines + final. Do not introduce a layout shift at `shown`.
3. **Resubmit behaviour.** Specified as full theatre every submit. If identical inputs and mode are resubmitted it may feel tedious; a quick reprice (from the current total) is an acceptable alternative. Pick one.
4. **Stamp overflow.** `scale(1.06)` on a quadrillion total at 375px could poke past the sheet for 260ms. If the scrollWidth sampler catches it, use `overflow: clip` on `.supplement` or reduce the scale; do not use `overflow-x: clip` on `html/body`.
5. **Share copy.** Exact wording, whether to include the first comparable, and whether to include the page URL are yours. Hard rules: no raw inputs, no figures in the URL, ASCII, nothing sent anywhere. If the clipboard permission handling proves flaky in headless, keep the feature and test it via the permission grant only; do not add `execCommand` fallbacks.
6. **Action versions.** Specified `checkout@v5`, `setup-node@v5`, `configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v4`. If a newer major is current and you can confirm it, use it; never pin to a branch.
7. **Confetti density.** 90 / 140 particles is a guess. If it looks sparse or stutters in headless screenshots, adjust `particleCountFor` and its test.
8. **Theatre lines.** Write the pool in the site's deadpan prospectus voice. Keep them affectionate; avoid naming real people.

## Decisions

Implementor decisions and deviations (M2 implementation, 2026-09-29).

1. **Scroll at reveal start (Q1).** Kept instant `scrollIntoView({ block: 'start' })` on `#result`. The result sits directly under the submit button, so the jump is short; instant keeps the mid-reveal checks deterministic.
2. **Theatre overlay fit (Q2).** Three lines kept. At < 640px the overlay (title + 3 lines at 0.8125rem) fits inside headline + subtitle. At >= 640px `.result-head` has a permanent `min-height: 5.75rem` (all states, so nothing shifts at "shown"), and the theatre lines use 0.875rem there. Mobile uses 0.8125rem because 44 mono characters at 0.875rem (~370px) do not fit a 343px column; a long line may still wrap, which the flex layout tolerates.
3. **Resubmit (Q3).** Every submit plays the full theatre, as specified. Skip is one tap away.
4. **Stamp overflow (Q4).** The scrollWidth sampler caught it at 375px: `.total` is a full-width block, so `scale(1.06)` widened the page by ~10px. Fixed with `overflow-x: clip` on `.total-block` (it contains no focusable elements, so no focus rings get clipped; vertical overflow stays visible). Not applied to `.supplement`, `html` or `body`.
5. **Share copy (Q5).** `shareText` gives "What Am I Worth? My household was just valued at $X on a/an <basis> basis, using a certain very large AI lab's multiples." Edge cases add the headline. The first comparable is included as "Nearest comparable: ...". The URL clause is included when `pageUrl` is given (`location.origin + location.pathname`). The all-zero case is "My household was valued at $0: pre-revenue, pre-debt, pure vision." With no URL it ends "A joke; nothing leaves your device." The view gains `modeShortLabel` (tested). Clipboard works in headless Chromium with the permission grant; no `execCommand` fallback.
6. **Action versions (Q6).** Checked with the GitHub releases API on 2026-09-29. The latest releases are checkout v7.0.1, setup-node v7.0.0, configure-pages v6.0.0, upload-pages-artifact v5.0.0 and deploy-pages v5.0.1, and each major tag exists. Pinned to `checkout@v7`, `setup-node@v7`, `configure-pages@v6`, `upload-pages-artifact@v5`, `deploy-pages@v5`. `actionlint` 1.7.11 (via `nix run nixpkgs#actionlint`) reports no issues.
7. **Confetti density (Q7).** Kept 90 / 140. It reads well in the landing screenshots at both widths. Draw details: each strip gets a tumbling squash (scaleY by `|cos|`, floored at 0.12). The two light colours get a 0.75px ink hairline so they show on paper.
8. **Theatre lines (Q8).** 14 general lines (the 10 from the plan, plus "Restating the grocery bill as R&D...", "Counting the sofa as a data centre...", "Describing the cat as key personnel..." and "Adjusting EBITDA until it looks nice..."). Edge-case lines are as the plan suggested; the debt-free one is 44 characters.
9. **`edgeCase` mapping.** `computeValuation` returns `'normal'` for the ordinary case. `describeResult` maps that to `null`, as the plan requires.
10. **Confetti origin (deviation).** The burst starts from the centre of the rendered figure (a `Range` over `#result-total`'s contents), not from the full-width element's box. The box centre put the burst well to the right of the number on desktop. It falls back to the element rect if the range is empty.
11. **Extra visual devices (CSS only, no new data).**
    - A "PRICED" rubber stamp (`.total-block::after`, herring double border, rotated -6deg) sits beside the total label. It is present in every shown state. During a reveal it is hidden while counting and stamps in at landing, scaling 1.5 to 1 with an ease-in "coming down" curve; the scale was reduced from 1.8 so it stays inside the sheet. `.total-label` has `padding-right: 6.5rem` to keep clear of it, so on phones the label wraps to two lines.
    - A 2px "diligence" hairline along the bottom of the theatre fills (scaleX, left origin) over 2600ms.
    - Theatre lines "type in" with a stepped `clip-path` reveal. Each "OK" arrives with a dotted table-of-contents leader. The line being worked on shows a blinking `_` caret.
    - While counting, the total is `--ink-2`, and the stamp keyframe turns it herring to ink as it lands (`.counting` class, owned by the controller).
    - None of this translates on the x-axis.
12. **Markup additions.** `#change-mode` and `#share` are wrapped in `div.result-buttons` (grid on mobile, wrapped flex row at >= 640px). The Note 1 paragraph now says `Here "savings" is ...` to match the new formula text. og:description is a punchier variant (~170 chars).
13. **Spacing regressions from the restructure.** `.subtitle` and `.total` became last children, so the M1 rule `p:last-child { margin-bottom: 0 }` zeroed their margins. Fixed by putting the margins on `.result-head` and `.total-block` (1.5rem each).
14. **Scroll anchoring on reprice.** Clicking `#change-mode` changes text above the button (one-liners reflow), and Chrome's scroll anchoring adjusts `scrollY` (~25px at 375) to keep the button where it is. That keeps the button still under the user's finger, which is the point of "no scroll", so the headless check accepts either an unchanged `scrollY` or an unchanged button position. The code never scrolls on reprice. Clicking a segment label leaves `scrollY` unchanged.
15. **Reduced-motion announcements.** On the reduced-motion paths the announcement is cleared and then set on the next animation frame, so an identical repeated string is still re-announced. On the animated paths it is cleared at the start and set at the end, as specified.
16. **Hygiene test.** It strips `/* */` comments and `//` comments that start a line or follow whitespace, so URLs inside strings (`https://`) are not mistaken for comments. `\.style\s*=[^=]` catches string assignment to `.style` while allowing CSSOM property writes.
17. **1024px legend strip.** No overlap found: the strip ends at 52px and the sheet starts at 170px, and scrollWidth equals 1024. No change made.
