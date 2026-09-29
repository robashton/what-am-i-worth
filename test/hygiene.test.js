// Static scan of site/ for patterns the CSP and privacy promises forbid.
// No DOM; just reads the files.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const SITE = fileURLToPath(new URL('../site/', import.meta.url));
const JS_DIR = join(SITE, 'js');

// Remove // line comments and /* */ block comments so explanatory comments
// do not trip the rules. Crude but adequate: no rule below looks for "//"
// inside a string except the URL rule, which strips only comments that start
// a line or follow whitespace.
function stripJsComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

const jsFiles = readdirSync(JS_DIR)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: f, src: stripJsComments(readFileSync(join(JS_DIR, f), 'utf8')) }));

const html = readFileSync(join(SITE, 'index.html'), 'utf8');
const css = readFileSync(join(SITE, 'styles.css'), 'utf8');

function assertAbsent(files, patterns) {
  for (const { name, src } of files) {
    for (const pattern of patterns) {
      const hit = typeof pattern === 'string' ? src.includes(pattern) : pattern.test(src);
      assert.ok(!hit, `${name} contains forbidden pattern ${pattern}`);
    }
  }
}

test('there are JS files to scan', () => {
  assert.ok(jsFiles.length >= 5, `only found ${jsFiles.length} JS files`);
});

test('JS: no HTML string injection', () => {
  assertAbsent(jsFiles, ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write']);
});

test('JS: no inline style writes', () => {
  assertAbsent(jsFiles, [
    /setAttribute\(\s*['"]style['"]/,
    /\.style\.cssText/,
    /\.style\s*=[^=]/,
  ]);
});

test('JS: no network, storage, history or dynamic import', () => {
  assertAbsent(jsFiles, [
    /\bfetch\s*\(/, 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource',
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie',
    'pushState', 'replaceState', /\bimport\s*\(/,
  ]);
});

test('JS: no absolute URLs outside the sources in valuation.js', () => {
  assertAbsent(jsFiles.filter((f) => f.name !== 'valuation.js'), ['http://', 'https://']);
});

test('pure modules do not touch the browser, the clock or Math.random', () => {
  const pure = ['format.js', 'valuation.js', 'comparisons.js', 'copy.js', 'reveal-math.js'];
  const files = jsFiles.filter((f) => pure.includes(f.name));
  assert.equal(files.length, pure.length, 'a pure module is missing');
  assertAbsent(files, [
    /\bdocument\b/, /\bwindow\b/, 'Math.random', 'Date.now', 'performance.', 'requestAnimationFrame',
  ]);
});

test('index.html: no inline styles, inline scripts or absolute URLs', () => {
  assert.ok(!/\sstyle\s*=/i.test(html), 'style= attribute found');
  const scripts = html.match(/<script\b[^>]*>/gi) || [];
  assert.ok(scripts.length > 0);
  for (const tag of scripts) assert.ok(/\ssrc\s*=/.test(tag), `inline script: ${tag}`);
  assert.ok(!html.includes('http://'), 'http:// in index.html');
  assert.ok(!html.includes('https://'), 'https:// in index.html');
});

test('index.html: CSP meta present and locked down', () => {
  const m = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
  assert.ok(m, 'CSP meta missing');
  assert.ok(m[1].includes("default-src 'self'"));
  assert.ok(m[1].includes("connect-src 'none'"));
});

test('styles.css: no imports, remote urls, web fonts or :has()', () => {
  assert.ok(!css.includes('@import'));
  assert.ok(!/url\(\s*['"]?http/i.test(css));
  assert.ok(!css.includes('@font-face'));
  assert.ok(!css.includes(':has('));
});
