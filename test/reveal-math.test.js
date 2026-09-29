import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIMELINE, REPRICE_MS, THEATRE_LINE_COUNT, THEATRE_LINES, PARTICLE_COLOURS, GRAVITY,
  clamp01, easeOutCubic, counterValue, counterText, phaseAt, countProgress, theatreState,
  pickTheatreLines, mulberry32, particleCountFor, spawnParticles, stepParticles, particleAlpha,
} from '../site/js/reveal-math.js';
import { formatMoney } from '../site/js/format.js';

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('timeline ordering and length', () => {
  const T = TIMELINE;
  assert.ok(T.shown >= 3000 && T.shown <= 4000);
  assert.ok(T.lineInterval * (THEATRE_LINE_COUNT - 1) < T.countStart);
  assert.ok(T.countStart < T.land && T.land <= T.shown);
  assert.equal(T.land, T.countStart + T.countDuration);
  assert.equal(T.shown, T.land + T.slideStagger * 4 + T.slideDuration);
  assert.ok(REPRICE_MS >= 300 && REPRICE_MS <= 1000);
  assert.ok(Object.isFrozen(T));
});

test('clamp01', () => {
  assert.equal(clamp01(NaN), 0);
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(0.25), 0.25);
});

test('easeOutCubic', () => {
  assert.equal(easeOutCubic(0), 0);
  assert.equal(easeOutCubic(1), 1);
  assert.ok(close(easeOutCubic(0.5), 0.875));
  assert.equal(easeOutCubic(-3), 0);
  assert.equal(easeOutCubic(7), 1);
  let prev = -Infinity;
  for (let i = 0; i <= 100; i += 1) {
    const v = easeOutCubic(i / 100);
    assert.ok(v >= prev);
    prev = v;
  }
});

test('counterValue endpoints are exact', () => {
  const a = 32986968.56520386;
  const b = 6151712.454212453;
  assert.equal(counterValue(0, a, 0), 0);
  assert.equal(counterValue(0, a, 1), a);
  assert.equal(counterValue(a, b, 0), a);
  assert.equal(counterValue(a, b, 1), b);
  assert.equal(counterValue(a, b, 5), b);
  assert.equal(counterValue(a, b, -5), a);
  assert.equal(counterValue(0, 0, 0.5), 0);
  assert.equal(counterValue(5, 5, 0.3), 5);
});

test('counterValue is monotonic both ways', () => {
  let prev = -Infinity;
  for (let i = 0; i <= 100; i += 1) {
    const v = counterValue(0, 4.4e17, i / 100);
    assert.ok(v >= prev, `up at ${i}`);
    prev = v;
  }
  prev = Infinity;
  for (let i = 0; i <= 100; i += 1) {
    const v = counterValue(32986968.56520386, 6151712.454212453, i / 100);
    assert.ok(v <= prev, `down at ${i}`);
    prev = v;
  }
});

test('counterValue is log scale', () => {
  const mid = counterValue(0, 999999, 0.5);
  assert.ok(mid > 990 && mid < 1010, `mid was ${mid}`);
});

test('counterValue rejects bad input', () => {
  assert.throws(() => counterValue(-1, 5, 0.5), RangeError);
  assert.throws(() => counterValue(0, -5, 0.5), RangeError);
  assert.throws(() => counterValue(0, Infinity, 0.5), RangeError);
  assert.throws(() => counterValue(NaN, 5, 0.5), RangeError);
});

test('counterText lands on formatMoney(total)', () => {
  for (const x of [0, 950000, 32986968.56520386, 1e15, 4.357e17]) {
    assert.equal(counterText(counterValue(0, x, 1)), formatMoney(x));
  }
  assert.equal(counterText(-3), '$0');
});

test('counterText climbs through the units', () => {
  const texts = [];
  for (let i = 0; i <= 200; i += 1) texts.push(counterText(counterValue(0, 1e15, i / 200)));
  assert.ok(texts.some((t) => /^\$[\d.,]+M$/.test(t)), 'no M');
  assert.ok(texts.some((t) => t.endsWith('bn')), 'no bn');
  assert.ok(texts.some((t) => t.endsWith('tn')), 'no tn');
  assert.ok(texts.some((t) => t.endsWith(' quadrillion')), 'no quadrillion');
});

test('phaseAt', () => {
  const cases = [
    [-5, 'theatre'], [0, 'theatre'], [999, 'theatre'], [1000, 'counting'], [2599, 'counting'],
    [2600, 'landing'], [3399, 'landing'], [3400, 'shown'], [1e9, 'shown'],
  ];
  for (const [t, phase] of cases) assert.equal(phaseAt(t), phase, `t=${t}`);
});

test('countProgress', () => {
  assert.equal(countProgress(0), 0);
  assert.equal(countProgress(1000), 0);
  assert.ok(close(countProgress(1800), 0.875));
  assert.equal(countProgress(2600), 1);
  assert.equal(countProgress(9999), 1);
});

test('theatreState', () => {
  const cases = [
    [0, 1, 0], [299, 1, 0], [300, 1, 1], [350, 2, 1], [650, 2, 2], [700, 3, 2], [5000, 3, 2], [-10, 1, 0],
  ];
  for (const [t, visible, ticked] of cases) {
    assert.deepEqual(theatreState(t), { visible, ticked }, `t=${t}`);
  }
});

test('theatre lines: shape of the pool', () => {
  const all = [...THEATRE_LINES.general, ...Object.values(THEATRE_LINES.byEdgeCase), THEATRE_LINES.final];
  assert.ok(THEATRE_LINES.general.length >= 10);
  for (const line of all) {
    assert.ok(line.endsWith('...'), line);
    assert.ok(/^[\x20-\x7e]+$/.test(line), `non-ASCII: ${line}`);
    assert.ok(line.length <= 44, `too long (${line.length}): ${line}`);
  }
  assert.equal(new Set(THEATRE_LINES.general).size, THEATRE_LINES.general.length);
  assert.equal(THEATRE_LINES.final, 'Pricing the offering...');
});

test('pickTheatreLines', () => {
  for (const edge of [null, undefined, 'unknown', 'all-zero', 'pre-revenue', 'assets-only', 'debt-free']) {
    const lines = pickTheatreLines(edge, mulberry32(7));
    assert.equal(lines.length, THEATRE_LINE_COUNT);
    assert.equal(new Set(lines).size, lines.length);
    assert.equal(lines[2], THEATRE_LINES.final);
    if (edge in THEATRE_LINES.byEdgeCase) {
      assert.equal(lines[0], THEATRE_LINES.byEdgeCase[edge]);
    } else {
      assert.ok(THEATRE_LINES.general.includes(lines[0]));
    }
    assert.ok(THEATRE_LINES.general.includes(lines[1]));
  }
  assert.deepEqual(pickTheatreLines(null, mulberry32(42)), pickTheatreLines(null, mulberry32(42)));
  const firsts = new Set();
  for (let seed = 0; seed < 200; seed += 1) {
    const lines = pickTheatreLines(null, mulberry32(seed));
    assert.notEqual(lines[0], lines[1]);
    firsts.add(lines[0]);
  }
  assert.ok(firsts.size >= 5, `only ${firsts.size} distinct first lines`);
});

test('pickTheatreLines survives an rng that returns values just under 1', () => {
  const lines = pickTheatreLines(null, () => 0.9999999999);
  assert.equal(new Set(lines).size, 3);
});

test('mulberry32', () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  for (let i = 0; i < 1000; i += 1) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('particleCountFor', () => {
  assert.equal(particleCountFor(375), 90);
  assert.equal(particleCountFor(639), 90);
  assert.equal(particleCountFor(640), 140);
  assert.equal(particleCountFor(1280), 140);
});

test('spawnParticles', () => {
  const origin = { x: 100, y: 200 };
  const ps = spawnParticles(60, origin, mulberry32(9));
  assert.equal(ps.length, 60);
  for (const p of ps) {
    for (const k of ['x', 'y', 'vx', 'vy', 'w', 'h', 'angle', 'spin', 'colour', 'age']) {
      assert.ok(k in p, `missing ${k}`);
    }
    assert.equal(p.x, 100);
    assert.equal(p.y, 200);
    assert.equal(p.age, 0);
    assert.ok(p.vy < 0, 'must start upward');
    const speed = Math.hypot(p.vx, p.vy);
    assert.ok(speed >= 350 - 1e-9 && speed <= 750 + 1e-9, `speed ${speed}`);
    const deg = Math.atan2(p.vy, p.vx) * (180 / Math.PI);
    assert.ok(deg >= -160 - 1e-9 && deg <= -20 + 1e-9, `angle ${deg}`);
    assert.ok(p.w >= 4 && p.w <= 8);
    assert.ok(p.h >= 8 && p.h <= 14);
    assert.ok(p.spin >= -12 && p.spin <= 12);
    assert.ok(PARTICLE_COLOURS.includes(p.colour));
  }
  assert.deepEqual(spawnParticles(10, origin, mulberry32(3)), spawnParticles(10, origin, mulberry32(3)));
});

test('stepParticles', () => {
  const ps = spawnParticles(20, { x: 0, y: 0 }, mulberry32(5));
  const vy0 = ps.map((p) => p.vy);
  const same = stepParticles(ps, 0.016);
  assert.equal(same, ps);
  ps.forEach((p, i) => assert.ok(close(p.vy, vy0[i] + GRAVITY * 0.016, 1e-6)));
  assert.ok(close(ps[0].age, 16, 1e-9));
  for (let i = 0; i < 62; i += 1) stepParticles(ps, 0.016);
  for (const p of ps) assert.ok(p.vy > 0, 'falling after ~1s');
  const y1 = ps.map((p) => p.y);
  stepParticles(ps, 0.016);
  ps.forEach((p, i) => assert.ok(p.y > y1[i]));
  assert.ok(close(ps[0].age, 64 * 16, 1e-6));
});

test('particleAlpha', () => {
  assert.equal(particleAlpha({ age: 0 }), 1);
  assert.equal(particleAlpha({ age: 800 }), 1);
  assert.ok(close(particleAlpha({ age: 1050 }), 0.5));
  assert.equal(particleAlpha({ age: 1200 }), 0);
  assert.equal(particleAlpha({ age: 5000 }), 0);
});
