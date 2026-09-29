# what-am-i-worth

Joke static site: "value your household like an AI lab". Enter (optional) household
finances, get a valuation using Anthropic's multiples, with a reveal animation and
silly comparisons. Published via GitHub Pages from `site/`.

## Hard constraints

- 100% client-side. No network calls at runtime (no analytics, no fonts CDN, no
  fetch). Nothing stored (no localStorage/cookies). The page must say so plainly.
- Plain HTML/CSS/JS (ES modules). No build step, no npm dependencies.
- Mobile-first: must work well on a phone (~375px wide) as well as desktop.
- USD only.

## Layout

- `site/` — the deployable static site (index.html, styles.css, js modules, data).
- `test/` — `node --test` unit tests for pure logic modules in `site/js/`.
- `docs/design.md` — master design doc / roadmap; phase plans live next to it.
- `.ai/robashton/` — scratchpad notes (tracked, never gitignored).

## Commands

No nix shell needed; system `node` (v24) is fine.

- Unit tests: `node --test test/*.test.js` (or a single file: `node --test test/valuation.test.js`)
- Serve locally: `python3 -m http.server -d site 8000`
- Headless browser checks: Playwright's Chromium is at
  `~/Library/Caches/ms-playwright/chromium-1234`; drive it with a throwaway script
  (e.g. `npx -y playwright@1.x` or python playwright) — don't add deps to the repo.
