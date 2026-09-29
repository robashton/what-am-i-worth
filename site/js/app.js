// DOM wiring only. All maths and copy live in the pure modules.
// Nothing here is persisted, and nothing talks to the network.

import {
  MODES, DEFAULT_MODE_ID, FIELD_IDS, FIGURES_AS_OF,
  getMode, multiples, parseAmount, computeValuation,
} from './valuation.js';
import { ITEMS, AS_OF, DATASET_NOTE, pickComparisons } from './comparisons.js';
import { describeResult, article, shareText, FIELD_ERRORS } from './copy.js';
import { formatMoney, formatMultiple, formatDecimal } from './format.js';
import { createRevealer } from './reveal.js';

// In-memory only; never persisted.
const state = { modeId: DEFAULT_MODE_ID, lastInputs: null, lastView: null };
let revealer = null;

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---- Methodology footer -------------------------------------------------

function renderMethodology() {
  const figures = $('methodology-figures');
  figures.replaceChildren();

  const asOf = el('p', 'as-of', `Figures as of ${FIGURES_AS_OF}. Reported, rounded and in some cases leaked; treat accordingly.`);
  figures.append(asOf);

  for (const mode of Object.values(MODES)) {
    const block = el('div', 'mode-figures');
    block.append(el('h4', null, mode.label));

    const wrap = el('div', 'table-wrap');
    const table = el('table', 'figures');
    const tbody = el('tbody');
    const rows = [
      ['Valuation', mode.valuation, mode.notes.valuation],
      ['Revenue', mode.revenue, mode.notes.revenue],
      ['Losses', mode.losses, mode.notes.losses],
    ];
    for (const [label, value, note] of rows) {
      const tr = el('tr');
      const th = el('th', null, label);
      th.scope = 'row';
      const tdValue = el('td', 'num', formatMoney(value));
      const tdNote = el('td', 'figure-note', note);
      tr.append(th, tdValue, tdNote);
      tbody.append(tr);
    }
    table.append(tbody);
    wrap.append(table);
    block.append(wrap);

    const m = multiples(mode);
    block.append(el('p', 'derived',
      `Derived: revenue multiple ${formatMultiple(m.revenueMultiple)}, loss multiple ${formatMultiple(m.lossMultiple)}, loss-to-revenue ratio ${formatDecimal(m.lossToRevenue)}.`));

    const sources = el('ul', 'sources');
    for (const source of mode.sources) {
      const li = el('li');
      const a = el('a', null, source.label);
      a.href = source.url;
      a.rel = 'noopener noreferrer';
      li.append(a);
      sources.append(li);
    }
    block.append(el('p', 'sources-label', 'Sources'), sources);
    figures.append(block);
  }

  $('comps-note').textContent = `As of ${AS_OF}. ${DATASET_NOTE}`;
  $('comps-dataset').querySelector('summary').textContent = `All ${ITEMS.length} comparables`;
  const list = $('comps-dataset-list');
  list.replaceChildren();
  for (const item of ITEMS) {
    const li = el('li');
    li.append(
      el('span', 'ds-name', `${item.name}: `),
      el('span', 'num', `~${formatMoney(item.value)}`),
      el('span', 'ds-note', ` (${item.note})`),
    );
    list.append(li);
  }
}

// ---- Result rendering ---------------------------------------------------

function fillList(listEl, lines, className) {
  listEl.replaceChildren(...lines.map((line) => el('li', className, line)));
  listEl.hidden = lines.length === 0;
}

function renderResult(view) {
  $('result-headline').textContent = view.headline;
  $('result-subtitle').textContent = view.subtitle;
  $('result-total-label').textContent = `Indicative valuation, ${view.modeLabel}`;
  $('result-total').textContent = view.totalText;

  fillList($('result-notices'), view.notices);

  const tbody = $('breakdown').querySelector('tbody');
  tbody.replaceChildren();
  for (const row of view.breakdown) {
    const tr = el('tr', row.isTotal ? 'total-row' : null);
    const th = el('th');
    th.scope = 'row';
    th.append(el('span', 'row-label', row.label));
    if (row.basis) th.append(el('span', 'basis', row.basis));
    const td = el('td', 'num', row.value);
    tr.append(th, td);
    tbody.append(tr);
  }

  fillList($('one-liners'), view.oneLiners);

  const compsList = $('comps-list');
  compsList.replaceChildren(...view.comps.map((line) => el('li', null, line)));
  compsList.hidden = view.comps.length === 0;
  const empty = $('comps-empty');
  empty.textContent = view.compsEmpty || '';
  empty.hidden = !view.compsEmpty;
  const conversion = $('conversion');
  conversion.textContent = view.conversion || '';
  conversion.hidden = !view.conversion;

  const changeMode = $('change-mode');
  const other = view.otherModeShortLabel;
  changeMode.textContent = `Reprice on ${article(other)} ${other} basis`;
  changeMode.dataset.target = view.otherModeId;

  // data-state belongs to the reveal controller.
  $('result').hidden = false;
}

// The single seam for showing a result. The revealer calls renderResult(view)
// and runs the reveal (or the quiet reprice) around it. Nothing else may
// render result DOM directly.
function presentResult(view, { quick = false } = {}) {
  $('share-status').textContent = '';
  if (quick && state.lastView && !$('result').hidden) {
    revealer.reprice(view, state.lastView.total);
  } else {
    revealer.reveal(view);
  }
}

function update({ quick = false } = {}) {
  const mode = getMode(state.modeId);
  const result = computeValuation(state.lastInputs, mode);
  const picks = pickComparisons(result.total);
  const view = describeResult(result, mode, picks);
  presentResult(view, { quick });
  state.lastView = view;
}

// ---- Form handling ------------------------------------------------------

function clearErrors() {
  for (const id of FIELD_IDS) {
    const input = $(id);
    input.removeAttribute('aria-invalid');
    input.closest('.field').classList.remove('is-invalid');
    const error = $(`${id}-error`);
    error.textContent = '';
    error.hidden = true;
  }
}

function onSubmit(event) {
  event.preventDefault();
  clearErrors();

  const inputs = {};
  let firstInvalid = null;
  for (const id of FIELD_IDS) {
    const input = $(id);
    const parsed = parseAmount(input.value);
    if (parsed.ok) {
      inputs[id] = parsed.value;
    } else {
      const error = $(`${id}-error`);
      error.textContent = FIELD_ERRORS[parsed.error];
      error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.closest('.field').classList.add('is-invalid');
      if (!firstInvalid) firstInvalid = input;
    }
  }

  if (firstInvalid) {
    firstInvalid.focus();
    return;
  }

  state.lastInputs = inputs;
  update({ quick: false });
}

function setMode(modeId) {
  getMode(modeId); // throws on an unknown id
  state.modeId = modeId;
  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.checked = radio.value === modeId;
  }
  if (state.lastInputs) update({ quick: true });
}

function onClear() {
  revealer.cancel();
  $('valuation-form').reset();
  clearErrors();
  // Keep the selected basis; reset() would otherwise revert the radios.
  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.checked = radio.value === state.modeId;
  }
  state.lastInputs = null;
  state.lastView = null;
  $('share-status').textContent = '';
  const result = $('result');
  result.hidden = true;
  result.dataset.state = 'hidden';
  $('income').focus();
}

// ---- Share (clipboard only; nothing is sent anywhere) --------------------

async function onShare() {
  const status = $('share-status');
  if (!state.lastView) return;
  try {
    await navigator.clipboard.writeText(shareText(state.lastView, location.origin + location.pathname));
    status.textContent = 'Summary copied to your clipboard.';
  } catch {
    status.textContent = 'Could not copy. Select and copy the valuation by hand.';
  }
}

function init() {
  revealer = createRevealer({
    render: renderResult,
    prefersReducedMotion: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  renderMethodology();
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    const share = $('share');
    share.hidden = false;
    share.addEventListener('click', onShare);
  }
  $('valuation-form').addEventListener('submit', onSubmit);
  $('clear').addEventListener('click', onClear);
  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.addEventListener('change', () => {
      if (radio.checked) setMode(radio.value);
    });
    if (radio.checked) state.modeId = radio.value;
  }
  $('change-mode').addEventListener('click', (event) => {
    setMode(event.currentTarget.dataset.target);
  });
}

init();
