import { state, drinks, avail, persist, render, renderOverlay, toast } from '../app.js';
import { esc, safeUrl } from '../dom.js';
import { typeName } from '../types.js';
import { evaluate } from '../match.js';
import { pickSource, consume } from '../pantry.js';
import { PORTIONS, STRENGTH, computeDose, feasible, usage, pruneDrops } from '../dose.js';
import { formatAmount, displayAmount } from '../measure.js';
import { missingLabel, outing, isDisliked, isSaved } from './drinks.js';

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
  const amount = esc(displayAmount(line, state.ui.card.unit));
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

const likeButtons = (d) => `<button class="btn" data-action="save" aria-pressed="${isSaved(d)}">${isSaved(d)
  ? '⭐ Salvato' : '☆ Salva'}</button>
  <button class="btn" data-action="dislike" aria-pressed="${isDisliked(d)}">${isDisliked(d)
  ? '👍 Rimetti in lista' : '👎 Non mi piace'}</button>`;

const shell = (d, body) => `<div class="backdrop" data-action="closeCard"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(d.name)}">
    <button class="btn close" data-action="closeCard" aria-label="Chiudi">✕</button>
    <div class="card"><div>${d.thumb ? `<img src="${esc(d.thumb)}" alt="${esc(d.name)}" onerror="this.removeAttribute('src')">` : '<div class="ph"></div>'}</div>
    <div>${body}</div></div></div></div>`;

const videoLink = (d) => (safeUrl(d.url)
  ? `<p class="small"><a href="${esc(safeUrl(d.url))}" target="_blank" rel="noopener">Video originale</a></p>` : '');

// At the bar: what is in it and how it is made, nothing about bottles or portions.
function renderOutingCard(d) {
  const rows = d.ingredients.map((l) => {
    const name = typeName(state.idx, l.type);
    const raw = l.raw && l.raw.toLowerCase() !== name.toLowerCase() ? ` <span class="muted small">(${esc(l.raw)})</span>` : '';
    return `<tr><td>${esc(name)}${raw}</td><td>${esc(displayAmount(l, state.settings.unit))}</td></tr>`;
  }).join('');
  return shell(d, `<h2>${esc(d.name)}</h2>
    ${d.alcoholic === 'no' ? '<span class="badge na">analcolico</span>' : ''}
    <table class="ings" style="margin-top:8px"><tbody>${rows}</tbody></table>
    <h3 style="margin-top:16px">Procedimento</h3>
    <p class="instructions">${esc(d.instructions || 'Nessun procedimento.')}</p>
    ${videoLink(d)}${likeButtons(d)}`);
}

export function renderCard() {
  const c = state.ui.card;
  const d = findDrink(c.id);
  if (!d) return '';
  if (outing()) return renderOutingCard(d);
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
  const why = canDo ? '' : `<p class="small muted">${combos.length
    ? 'Questa combinazione supera quello che resta nelle bottiglie.'
    : 'Ti manca qualcosa (o non basta): usa un\'alternativa o aggiorna la dispensa.'}</p>`;

  return shell(d, `
      <h2>${esc(d.name)}</h2>
      ${d.alcoholic === 'no' ? '<span class="badge na">analcolico</span>' : ''}
      <div class="controls">${portions}${strengths}${units}</div>
      <table class="ings"><tbody>${lines.map((l) => ingredientRow(l, a, missing)).join('')}</tbody></table>
      ${c.sub ? `<p class="small">Sostituzione: ${esc(typeName(state.idx, c.sub.from))} → ${esc(typeName(state.idx, c.sub.to))}
        <button class="btn" data-action="clearSub">Annulla</button></p>` : ''}
      ${c.strength === 'leggero' && d.alcoholic !== 'no' ? '<p class="small muted">Leggero: meno alcol, stesso equilibrio.</p>' : ''}
      <h3 style="margin-top:16px">Procedimento</h3>
      <p class="instructions">${esc(d.instructions || 'Nessun procedimento.')}</p>
      ${videoLink(d)}
      ${why}
      <button class="btn primary" data-action="done" ${canDo ? '' : 'disabled'}>Fatto! (scala dalle bottiglie)</button>
      ${likeButtons(d)}`);
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
  dislike: () => {
    const id = state.ui.card.id;
    const was = state.disliked.includes(id);
    state.disliked = was ? state.disliked.filter((x) => x !== id) : [...state.disliked, id];
    persist('disliked');
    toast(was ? 'Rimesso in lista.' : 'Tolto dalla lista e dai consigli. Lo ritrovi cercandolo per nome.');
    render();
  },
  save: () => {
    const id = state.ui.card.id;
    state.saved = state.saved.includes(id) ? state.saved.filter((x) => x !== id) : [...state.saved, id];
    persist('saved');
    render();
  },
  unit: (el) => { state.ui.card.unit = el.dataset.v; renderOverlay(); },
  done: (el) => {
    el.disabled = true;
    const c = state.ui.card;
    const a = avail();
    const { lines } = computeDose(state.idx, findDrink(c.id), c, c.sub);
    const before = Object.keys(state.pantry.items);
    const used = usage(state.idx, lines, a);
    state.pantry = pruneDrops(state.idx, consume(state.pantry, used), drinks(), used.map((u) => u.typeId));
    persist('pantry');
    const gone = before.filter((id) => !state.pantry.items[id]).map((id) => typeName(state.idx, id));
    toast(gone.length ? `Salute! 🍹 Finita: ${gone.join(', ')}` : 'Salute! 🍹 Bottiglie aggiornate.');
    render();
  },
};
