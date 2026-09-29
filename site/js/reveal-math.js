// Pure maths for the reveal: timeline, easing, counter, theatre lines,
// a seeded RNG and the ticker-tape particles. No DOM, no clock, no Math.random;
// callers pass in elapsed times and an rng.

import { formatMoney } from './format.js';

// All durations in milliseconds.
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

export function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

export function easeOutCubic(t) {
  return 1 - (1 - clamp01(t)) ** 3;
}

function assertAmount(name, x) {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < 0) {
    throw new RangeError(`counterValue: ${name} must be a finite number >= 0, got ${x}`);
  }
}

// Interpolates in log1p space, so a roll from $0 climbs visibly through
// thousands, millions, billions... instead of sitting in the final unit.
export function counterValue(from, to, progress) {
  assertAmount('from', from);
  assertAmount('to', to);
  const p = clamp01(progress);
  if (p >= 1) return to;
  if (p <= 0) return from;
  if (from === to) return to;
  const a = Math.log1p(from);
  const b = Math.log1p(to);
  return Math.expm1(a + (b - a) * p);
}

export function counterText(value) {
  return formatMoney(Math.max(0, value));
}

export function phaseAt(elapsed) {
  if (!(elapsed >= TIMELINE.countStart)) return 'theatre';
  if (elapsed < TIMELINE.land) return 'counting';
  if (elapsed < TIMELINE.shown) return 'landing';
  return 'shown';
}

export function countProgress(elapsed) {
  return easeOutCubic((elapsed - TIMELINE.countStart) / TIMELINE.countDuration);
}

export function theatreState(elapsed, lineCount = THEATRE_LINE_COUNT) {
  const e = Math.max(0, elapsed);
  const visible = Math.min(lineCount, Math.floor(e / TIMELINE.lineInterval) + 1);
  let ticked = 0;
  for (let i = 0; i < lineCount - 1; i += 1) {
    if (i * TIMELINE.lineInterval + TIMELINE.lineTick <= e) ticked += 1;
  }
  return { visible, ticked };
}

export const THEATRE_LINES = Object.freeze({
  general: Object.freeze([
    'Consulting the vibes...',
    'Annualising your best month...',
    "Adding 'AI' to the household name...",
    'Reclassifying the mortgage as capex...',
    'Ignoring the losses, as is customary...',
    'Benchmarking against a very large AI lab...',
    'Pivoting the household to agents...',
    'Hiring a Chief Vibes Officer...',
    'Extrapolating from one good quarter...',
    'Printing the red herring...',
    'Restating the grocery bill as R&D...',
    'Counting the sofa as a data centre...',
    'Describing the cat as key personnel...',
    'Adjusting EBITDA until it looks nice...',
  ]),
  byEdgeCase: Object.freeze({
    'all-zero': 'Searching for revenue... none found...',
    'pre-revenue': 'Confirming the absence of revenue...',
    'assets-only': 'Locating the debt... there is no debt...',
    'debt-free': 'Looking for leverage... alarmingly little...',
  }),
  final: 'Pricing the offering...',
});

function pick(list, rng) {
  const i = Math.min(list.length - 1, Math.floor(rng() * list.length));
  return list[i];
}

export function pickTheatreLines(edgeCase, rng) {
  const general = THEATRE_LINES.general;
  const first = Object.hasOwn(THEATRE_LINES.byEdgeCase, edgeCase ?? '')
    ? THEATRE_LINES.byEdgeCase[edgeCase]
    : pick(general, rng);
  const rest = general.filter((line) => line !== first);
  const second = pick(rest, rng);
  return [first, second, THEATRE_LINES.final];
}

// Tiny seeded PRNG (mulberry32). Returns a function yielding [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Ticker-tape particles ------------------------------------------------

// herring, ink, rule-soft, field: ticker tape, not rainbow confetti.
export const PARTICLE_COLOURS = Object.freeze(['#a8231a', '#1b1813', '#cfc4ae', '#fffdf7']);
export const GRAVITY = 1400; // px/s^2
export const DRAG = 1.2;     // per second, horizontal only

export function particleCountFor(viewportWidth) {
  return viewportWidth < 640 ? 90 : 140;
}

const between = (rng, lo, hi) => lo + (hi - lo) * rng();

export function spawnParticles(count, origin, rng) {
  const particles = [];
  for (let i = 0; i < count; i += 1) {
    const angle = between(rng, -160, -20) * (Math.PI / 180);
    const speed = between(rng, 350, 750);
    particles.push({
      x: origin.x,
      y: origin.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      w: between(rng, 4, 8),
      h: between(rng, 8, 14),
      angle: between(rng, 0, Math.PI * 2),
      spin: between(rng, -12, 12),
      colour: pick(PARTICLE_COLOURS, rng),
      age: 0,
    });
  }
  return particles;
}

export function stepParticles(particles, dt) {
  const drag = Math.max(0, 1 - DRAG * dt);
  for (const p of particles) {
    p.vy += GRAVITY * dt;
    p.vx *= drag;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.spin * dt;
    p.age += dt * 1000;
  }
  return particles;
}

export function particleAlpha(p) {
  const fadeFrom = TIMELINE.confettiDuration - 300;
  if (p.age < fadeFrom) return 1;
  return clamp01(1 - (p.age - fadeFrom) / 300);
}
