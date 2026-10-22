import { state, drinks, avail, persist, render, renderOverlay, toast } from '../app.js';
import { esc } from '../dom.js';
import { typeName } from '../types.js';
import { evaluate } from '../match.js';
import { pickSource, consume } from '../pantry.js';
import { PORTIONS, STRENGTH, computeDose, feasible, usage } from '../dose.js';
import { formatAmount } from '../measure.js';
import { missingLabel } from './drinks.js';

const FULL_BOTTLE_OZ = 25; // ~750 ml
const LOW_OZ = 2;
const PORTION_LABEL = { 0.5: '½', 1: '1', 2: '2', 3: '3', 4: '4' };
const STRENGTH_LABEL = { leggero: 'Leggero', normale: 'Normale', forte: 'Forte' };

const findDrink = (id) => drinks().find((d) => d.id === id);

// Biggest feasible portion; prefer normal strength, then light, then strong.
function defaultCombo(combos) {
  if (combos.some((c) => c.portion === 1 && c.strength === 'normale')) return { portion: 1, strength: 'normale' };
  const rank = { normale: 0, leggero: 1, forte: 2 };
  const best = [...combos].sort((a, b) => b.portion - a.portion || rank[a.strength] - rank[b.strength])[0];
  return best ?? { portion: 1, strength: 'normale' };
}

export function initCard(id, sub = null) {
  const d = findDrink(id);
  const combo = d ? defaultCombo(feasible(state.idx, d, avail(), sub)) : { portion: 1, strength: 'normale' };
  return { id, ...combo, unit: state.settings.unit, sub, alts: null };
}

// Hook for Task 9: renders the "Alternativa" control under a missing ingredient.
export const altHook = { render: () => '' };

function ingredientRow(line, a, missing) {
  const name = line.added ? 'Top di soda' : typeName(state.idx, line.type);
  const raw = !line.added && line.raw && line.raw.toLowerCase() !== name.toLowerCase()
    ? ` <span class="muted small">(${esc(line.raw)})</span>` : '';
  const amount = line.oz != null ? formatAmount(line.oz, state.ui.card.unit) : esc(line.text || '—');
  const src = pickSource(state.idx, a, line.type);
  const have = src ? a.get(src) : undefined;
  let extra = '';
  if (have != null) {
    const pct = Math.min(100, (have / FULL_BOTTLE_OZ) * 100);
    const low = have < LOW_OZ;
    extra = `<div class="bar${low ? ' low' : ''}" title="Restano ${formatAmount(have, state.ui.card.unit)}"><i style="width:${pct}%"></i></div>
      <span class="small muted">restano ${formatAmount(have, state.ui.card.unit)}${low ? ' · quasi finita' : ''}</span>`;
  }
  const m = missing.find((x) => x.type === line.type);
  if (m && !(state.ui.card.sub && state.ui.card.sub.to === line.type)) {
    extra += ` <span class="badge miss">${esc(missingLabel(m))}</span>${altHook.render(line, m)}`;
  }
  if (state.ui.card.sub?.to === line.type) extra += ' <span class="badge try">sostituto</span>';
  return `<tr><td>${esc(name)}${raw}${extra}</td><td>${amount}</td></tr>`;
}

export function renderCard() {
  const c = state.ui.card;
  const d = findDrink(c.id);
  if (!d) return '';
  const a = avail();
  const { missing } = evaluate(state.idx, d, a, state.off);
  const combos = feasible(state.idx, d, a, c.sub);
  const has = (p, s) => combos.some((x) => x.portion === p && x.strength === s);
  const { lines } = computeDose(state.idx, d, c, c.sub);
  const canDo = has(c.portion, c.strength);
  const seg = (label, items) => `<div class="seg" role="group" aria-label="${label}">${items.join('')}</div>`;

  const portions = seg('Porzioni', PORTIONS.map((p) => `<button data-action="portion" data-v="${p}"
    aria-pressed="${c.portion === p}" ${combos.some((x) => x.portion === p) ? '' : 'disabled'}>${PORTION_LABEL[p]}</button>`));
  const strengths = d.alcoholic === 'no' ? '' : seg('Intensità', Object.keys(STRENGTH).map((s) => `<button data-action="strength"
    data-v="${s}" aria-pressed="${c.strength === s}" ${has(c.portion, s) ? '' : 'disabled'}>${STRENGTH_LABEL[s]}</button>`));
  const units = seg('Unità', ['oz', 'ml', 'cl'].map((u) => `<button data-action="unit" data-v="${u}"
    aria-pressed="${c.unit === u}">${u}</button>`));
  const img = d.thumb ? `<img src="${esc(d.thumb)}" alt="${esc(d.name)}">` : '<div class="ph"></div>';
  const why = canDo ? '' : `<p class="small muted">${combos.length
    ? 'Questa combinazione supera quello che resta nelle bottiglie.'
    : 'Ti manca qualcosa (o non basta): usa un\'alternativa o aggiorna la dispensa.'}</p>`;

  return `<div class="backdrop" data-action="closeCard"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(d.name)}">
    <button class="btn close" data-action="closeCard" aria-label="Chiudi">✕</button>
    <div class="card"><div>${img}</div><div>
      <h2>${esc(d.name)}</h2>
      ${d.alcoholic === 'no' ? '<span class="badge na">analcolico</span>' : ''}
      <div class="controls">${portions}${strengths}${units}</div>
      <table class="ings"><tbody>${lines.map((l) => ingredientRow(l, a, missing)).join('')}</tbody></table>
      ${c.strength === 'leggero' && d.alcoholic !== 'no' ? '<p class="small muted">Leggero: meno alcol, stesso equilibrio.</p>' : ''}
      <h3 style="margin-top:16px">Procedimento</h3>
      <p class="instructions">${esc(d.instructions || 'Nessun procedimento.')}</p>
      ${d.url ? `<p class="small"><a href="${esc(d.url)}" target="_blank" rel="noopener">Video originale</a></p>` : ''}
      ${why}
      <button class="btn primary" data-action="done" ${canDo ? '' : 'disabled'}>Fatto! (scala dalle bottiglie)</button>
    </div></div></div></div>`;
}

export const cardActions = {
  closeCard: (el, e) => {
    if (el.classList.contains('backdrop') && e.target !== el) return;
    state.ui.card = null;
    renderOverlay();
  },
  portion: (el) => {
    const c = state.ui.card;
    c.portion = Number(el.dataset.v);
    const combos = feasible(state.idx, findDrink(c.id), avail(), c.sub).filter((x) => x.portion === c.portion);
    if (!combos.some((x) => x.strength === c.strength) && combos.length) c.strength = defaultCombo(combos).strength;
    renderOverlay();
  },
  strength: (el) => { state.ui.card.strength = el.dataset.v; renderOverlay(); },
  unit: (el) => { state.ui.card.unit = el.dataset.v; renderOverlay(); },
  done: (el) => {
    el.disabled = true;
    const c = state.ui.card;
    const a = avail();
    const { lines } = computeDose(state.idx, findDrink(c.id), c, c.sub);
    const before = Object.keys(state.pantry.items);
    state.pantry = consume(state.pantry, usage(state.idx, lines, a));
    persist('pantry');
    const gone = before.filter((id) => !state.pantry.items[id]).map((id) => typeName(state.idx, id));
    toast(gone.length ? `Salute! 🍹 Finita: ${gone.join(', ')}` : 'Salute! 🍹 Bottiglie aggiornate.');
    render();
  },
};
