# M2 notes (implementor)

Status: M2 implemented; awaiting impl verifier. No git operations done.

- Tests: `node --test test/*.test.js` -> 77 pass, 0 fail (44 M1 + 4 new copy + reveal-math + hygiene).
- Headless: `/tmp/waiw-m2/check.mjs` (outside the repo). Serve first with
  `python3 -m http.server -d site 8766`. It uses the npx-cached playwright 1.59 alpha
  (`~/.npm/_npx/9833c18b2d85bc59`) with `chromium_headless_shell-1234` via
  executablePath. Run `SHOTS=0 node check.mjs` to skip screenshots. Result: 134/134 checks
  pass at 375x812 and 1280x800 (plus a 768x1024 formula check).
- Screenshots: `/tmp/waiw-m2/{375x812,1280x800}-{theatre,counting,landing,final,final-full,result-section,reprice-seriesH,reprice-midflash,reduced-motion,errors,formula,quadrillion-landing,quadrillion-final}.png`.
- Workflow: actionlint 1.7.11 is clean. Actions pinned to checkout@v7, setup-node@v7,
  configure-pages@v6, upload-pages-artifact@v5 and deploy-pages@v5 (latest majors, checked via the GitHub API).
- Decisions and deviations: see "## Decisions" at the end of docs/phase-M2.md. The main ones:
  - The PRICED stamp pseudo-element.
  - The confetti origin is the text rect, not the box.
  - `overflow-x: clip` on `.total-block` for the stamp scale.
  - The scroll-anchoring allowance in the change-mode check.
  - Theatre font is 0.8125rem on mobile.
- The finalizer still needs to append "## Phase M2 outcomes" to docs/design.md. Note that the M1
  outcomes claim that node --test checked forbidden patterns; that is now true (test/hygiene.test.js).
