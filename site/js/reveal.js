// The reveal controller: theatre lines, counter roll-up, ticker tape, skip,
// and the quiet reprice used when the basis is switched. It owns the result's
// data-state, aria-busy, the live announcement, focus and scroll. It never
// computes valuations or copy; app.js hands it a finished view and a render
// function. Nothing here is persisted and nothing talks to the network.

import {
  TIMELINE, REPRICE_MS, pickTheatreLines, phaseAt, countProgress, theatreState,
  counterValue, counterText, easeOutCubic, particleCountFor, spawnParticles,
  stepParticles, particleAlpha,
} from './reveal-math.js';

const SKIP_GRACE_MS = 50;
const MODIFIER_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta']);

export function announcementFor(view) {
  return `${view.headline} Indicative valuation, ${view.modeLabel}: ${view.totalText}.`;
}

function restartAnimation(node, className) {
  node.classList.remove(className);
  void node.offsetWidth; // reflow so re-adding the class replays the animation
  node.classList.add(className);
}

export function createRevealer({ render, rng = Math.random, prefersReducedMotion }) {
  const $ = (id) => document.getElementById(id);
  const els = {
    result: $('result'),
    total: $('result-total'),
    breakdown: $('breakdown'),
    headline: $('result-headline'),
    theatre: $('theatre'),
    lines: $('theatre-lines'),
    skip: $('skip-reveal'),
    announce: $('result-announce'),
  };

  let seq = null;        // the active sequence: { kind, view, start, raf, phase, ... }
  let confetti = null;   // { canvas, ctx, particles, start, last, raf }
  let announceRaf = 0;   // a deferred announcement (reduced-motion paths)

  // ---- Announcement ------------------------------------------------------

  function clearAnnouncement() {
    cancelAnimationFrame(announceRaf);
    announceRaf = 0;
    els.announce.textContent = '';
  }

  function announce(view) {
    cancelAnimationFrame(announceRaf);
    announceRaf = 0;
    els.announce.textContent = announcementFor(view);
  }

  // Clear now, set on the next frame, so an identical string is re-announced.
  function announceNextFrame(view) {
    clearAnnouncement();
    announceRaf = requestAnimationFrame(() => announce(view));
  }

  // ---- Ticker tape -------------------------------------------------------

  function stopConfetti() {
    if (!confetti) return;
    cancelAnimationFrame(confetti.raf);
    confetti.canvas.remove();
    confetti = null;
  }

  function drawConfetti() {
    const { ctx, particles } = confetti;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of particles) {
      const alpha = particleAlpha(p);
      if (alpha <= 0) continue;
      // A strip of paper tumbling end over end: squash one axis over time.
      const flip = Math.cos(p.age * 0.001 * (4 + Math.abs(p.spin)) + p.w);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.scale(1, Math.max(0.12, Math.abs(flip)));
      ctx.fillStyle = p.colour;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      if (p.colour === '#fffdf7' || p.colour === '#cfc4ae') {
        ctx.lineWidth = 0.75;
        ctx.strokeStyle = 'rgba(27, 24, 19, 0.35)';
        ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }
  }

  function confettiFrame(now) {
    if (!confetti) return;
    const dt = Math.min(0.05, Math.max(0, (now - confetti.last) / 1000));
    confetti.last = now;
    stepParticles(confetti.particles, dt);
    const done = now - confetti.start >= TIMELINE.confettiDuration
      || confetti.particles.every((p) => particleAlpha(p) === 0);
    if (done) {
      stopConfetti();
      return;
    }
    drawConfetti();
    confetti.raf = requestAnimationFrame(confettiFrame);
  }

  function startConfetti() {
    stopConfetti();
    // Burst from the figure itself, not the centre of its full-width block.
    const range = document.createRange();
    range.selectNodeContents(els.total);
    const textRect = range.getBoundingClientRect();
    const rect = textRect.width > 0 ? textRect : els.total.getBoundingClientRect();
    const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti';
    canvas.setAttribute('aria-hidden', 'true');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    document.body.append(canvas);
    const now = performance.now();
    confetti = {
      canvas,
      ctx,
      particles: spawnParticles(particleCountFor(innerWidth), origin, rng),
      start: now,
      last: now,
      raf: 0,
    };
    drawConfetti();
    confetti.raf = requestAnimationFrame(confettiFrame);
  }

  // ---- Skip --------------------------------------------------------------

  function skipAllowed() {
    return seq && seq.kind === 'reveal' && performance.now() - seq.start >= SKIP_GRACE_MS;
  }

  function onSkipClick(event) {
    if (!skipAllowed()) return;
    const submit = $('submit');
    if (submit && event.target instanceof Node && submit.contains(event.target)) {
      event.preventDefault();
    }
    finish();
  }

  function onSkipKey(event) {
    if (MODIFIER_KEYS.has(event.key)) return;
    if (!skipAllowed()) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
    }
    finish();
  }

  function addSkipListeners() {
    document.addEventListener('click', onSkipClick, true);
    document.addEventListener('keydown', onSkipKey, true);
  }

  function removeSkipListeners() {
    document.removeEventListener('click', onSkipClick, true);
    document.removeEventListener('keydown', onSkipKey, true);
  }

  // ---- Theatre -----------------------------------------------------------

  function fillTheatre(lines) {
    els.lines.replaceChildren(...lines.map((line) => {
      const li = document.createElement('li');
      const text = document.createElement('span');
      text.className = 'line-text';
      text.textContent = line;
      const tick = document.createElement('span');
      tick.className = 'tick';
      tick.textContent = 'OK';
      tick.hidden = true;
      li.append(text, tick);
      li.hidden = true;
      return li;
    }));
  }

  function updateTheatre(elapsed) {
    const items = els.lines.children;
    const { visible, ticked } = theatreState(elapsed, items.length);
    if (visible === seq.visible && ticked === seq.ticked) return;
    seq.visible = visible;
    seq.ticked = ticked;
    for (let i = 0; i < items.length; i += 1) {
      const li = items[i];
      li.hidden = i >= visible;
      li.lastElementChild.hidden = i >= ticked;
      li.classList.toggle('current', i === visible - 1 && i >= ticked);
    }
  }

  function hideTheatre() {
    els.theatre.hidden = true;
    els.skip.hidden = true;
  }

  // ---- Full reveal -------------------------------------------------------

  function setPhase(phase) {
    if (seq.phase === phase) return;
    seq.phase = phase;
    els.result.dataset.state = phase;
  }

  function land() {
    seq.landed = true;
    setPhase('landing');
    els.total.textContent = seq.view.totalText;
    seq.text = seq.view.totalText;
    els.total.classList.remove('counting');
    restartAnimation(els.total, 'stamped');
    startConfetti();
  }

  function completeReveal({ skipped }) {
    const { view } = seq;
    cancelAnimationFrame(seq.raf);
    seq = null;
    removeSkipListeners();
    els.total.textContent = view.totalText;
    els.total.removeAttribute('aria-hidden');
    els.total.classList.remove('counting');
    els.total.style.minHeight = '';
    hideTheatre();
    els.result.dataset.state = 'shown';
    els.result.removeAttribute('aria-busy');
    announce(view);
    if (skipped) {
      stopConfetti();
      els.total.classList.remove('stamped');
    }
    els.headline.focus({ preventScroll: true });
  }

  function revealFrame() {
    if (!seq || seq.kind !== 'reveal') return;
    const elapsed = performance.now() - seq.start;
    const phase = phaseAt(elapsed);

    if (phase === 'shown') {
      completeReveal({ skipped: false });
      return;
    }
    if (phase === 'theatre' || phase === 'counting') updateTheatre(elapsed);
    if (phase === 'counting') {
      if (seq.phase !== 'counting') {
        setPhase('counting');
        els.total.classList.add('counting');
      }
      const text = counterText(counterValue(0, seq.view.total, countProgress(elapsed)));
      if (text !== seq.text) {
        els.total.textContent = text;
        seq.text = text;
      }
    }
    if (phase === 'landing' && !seq.landed) land();

    seq.raf = requestAnimationFrame(revealFrame);
  }

  function revealInstantly(view) {
    render(view);
    hideTheatre();
    els.total.removeAttribute('aria-hidden');
    els.total.style.minHeight = '';
    els.total.classList.remove('stamped', 'flash', 'counting');
    els.breakdown.classList.remove('flash');
    els.result.removeAttribute('aria-busy');
    els.result.dataset.state = 'shown';
    announceNextFrame(view);
    els.headline.focus({ preventScroll: true });
    els.result.scrollIntoView({ block: 'start' });
  }

  function reveal(view) {
    finish();
    stopConfetti();
    if (prefersReducedMotion()) {
      revealInstantly(view);
      return;
    }

    render(view);
    const total = els.total;
    total.classList.remove('stamped', 'flash', 'counting');
    els.breakdown.classList.remove('flash');
    // Reserve the final height so the landing does not shift the layout.
    total.style.minHeight = '';
    total.textContent = view.totalText;
    total.style.minHeight = `${total.getBoundingClientRect().height}px`;
    total.textContent = '$0';
    total.setAttribute('aria-hidden', 'true');
    els.result.setAttribute('aria-busy', 'true');
    clearAnnouncement();
    fillTheatre(pickTheatreLines(view.edgeCase, rng));
    els.theatre.hidden = false;
    els.skip.hidden = false;

    seq = {
      kind: 'reveal',
      view,
      start: performance.now(),
      raf: 0,
      phase: null,
      text: '$0',
      visible: -1,
      ticked: -1,
      landed: false,
    };
    setPhase('theatre');
    updateTheatre(0);
    els.result.scrollIntoView({ block: 'start' });
    addSkipListeners();
    seq.raf = requestAnimationFrame(revealFrame);
  }

  // ---- Reprice -----------------------------------------------------------

  function completeReprice() {
    const { view } = seq;
    cancelAnimationFrame(seq.raf);
    seq = null;
    els.total.textContent = view.totalText;
    els.total.removeAttribute('aria-hidden');
    els.total.classList.remove('flash');
    els.breakdown.classList.remove('flash');
    announce(view);
  }

  function repriceFrame() {
    if (!seq || seq.kind !== 'reprice') return;
    const elapsed = performance.now() - seq.start;
    if (elapsed >= REPRICE_MS) {
      completeReprice();
      return;
    }
    const value = counterValue(seq.from, seq.view.total, easeOutCubic(elapsed / REPRICE_MS));
    const text = counterText(value);
    if (text !== seq.text) {
      els.total.textContent = text;
      seq.text = text;
    }
    seq.raf = requestAnimationFrame(repriceFrame);
  }

  function reprice(view, fromTotal) {
    finish();
    render(view);
    els.result.dataset.state = 'shown';
    if (prefersReducedMotion()) {
      announceNextFrame(view);
      return;
    }
    const from = Number.isFinite(fromTotal) && fromTotal >= 0 ? fromTotal : view.total;
    const text = counterText(from);
    els.total.textContent = text;
    els.total.setAttribute('aria-hidden', 'true');
    clearAnnouncement();
    restartAnimation(els.total, 'flash');
    restartAnimation(els.breakdown, 'flash');
    seq = { kind: 'reprice', view, from, start: performance.now(), raf: 0, text };
    seq.raf = requestAnimationFrame(repriceFrame);
  }

  // ---- Public controls ---------------------------------------------------

  function finish() {
    if (!seq) return;
    if (seq.kind === 'reveal') completeReveal({ skipped: true });
    else completeReprice();
  }

  function cancel() {
    if (seq) cancelAnimationFrame(seq.raf);
    seq = null;
    stopConfetti();
    removeSkipListeners();
    clearAnnouncement();
    els.total.style.minHeight = '';
    els.total.removeAttribute('aria-hidden');
    els.total.classList.remove('stamped', 'flash', 'counting');
    els.breakdown.classList.remove('flash');
    els.result.removeAttribute('aria-busy');
    hideTheatre();
  }

  return {
    reveal,
    reprice,
    finish,
    cancel,
    isActive: () => seq !== null,
  };
}
