# M1 notes (implementor)

Status: M1 implemented; awaiting impl verifier. No git operations done.

- Tests: `node --test test/*.test.js` -> 44 pass, 0 fail, no warnings.
- Headless: `/tmp/waiw-m1/check.mjs` (outside the repo). It serves `site/` with `python3 -m http.server -d site 8765` and uses the npx-cached playwright plus `chromium_headless_shell-1234` via executablePath. 51/51 checks pass at 375x812 and 1280x800.
- Screenshots: `/tmp/waiw-m1/{375x812,1280x800}-{blank,scenarioA,quadrillion,errors}.png`.
- Deviations and resolved open questions: see "## Decisions" at the end of docs/phase-M1.md. The main ones are the a/an article helper, "1.0" counting as singular, and static mode hints.
- For M2: `presentResult(view)` in app.js is the seam. `#result[data-state]` toggles hidden/shown. Flipping the radio currently re-scrolls to the result; consider a quieter path for mode flips.
- Known cosmetic issue: on desktop the Note 1 formula `<pre>` scrolls horizontally, because the design.md comments are long. On phone the whole page never scrolls sideways.
