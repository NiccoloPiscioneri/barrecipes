import { state, avail, renderOverlay, refreshGrid, toast, drinks } from '../app.js';
import { esc } from '../dom.js';
import { typeName, siblings } from '../types.js';
import { pickSource } from '../pantry.js';
import { formatAmount } from '../measure.js';
import { computeDose } from '../dose.js';
import { callGemini, alternativePrompt, validateAlternatives, ALT_SCHEMA,
  recommendPrompt, validateRecommend, REC_SCHEMA } from '../gemini.js';
import { altHook, initCard } from './card.js';
import { recommendBox, gridExtras, drinkTile, results, inPool, outing } from './drinks.js';
import { geminiKey } from './settings.js';

function needKey() {
  const key = geminiKey();
  if (!key) toast('Aggiungi la chiave Gemini in Impostazioni per usare questa funzione.', 5000);
  return key;
}

// ---- Alternativa (drink card) ----

const useButton = (to, oz, ok) => `<button class="btn" data-action="useSub" data-to="${esc(to)}"
  ${oz != null ? `data-oz="${oz}"` : ''} ${ok ? '' : 'disabled'}>Usa questa</button>`;

altHook.render = (line, m) => {
  const c = state.ui.card;
  if (c.alts?.for !== m.type) return ` <button class="btn" data-action="alt" data-type="${esc(m.type)}">Alternativa</button>`;
  const a = avail();
  const sibs = siblings(state.idx, m.type).filter((id) => pickSource(state.idx, a, id));
  const rows = sibs.map((id) => `<div class="alt"><span>${esc(typeName(state.idx, id))} <span class="small muted">stessa dose</span></span>${useButton(id, null, true)}</div>`);
  const g = c.alts.gemini;
  if (g === 'loading') rows.push('<p class="small muted">Cerco alternative…</p>');
  else if (g === 'nokey') rows.push('<p class="small muted">Per altre idee aggiungi la chiave Gemini in Impostazioni.</p>');
  else if (g?.error) rows.push(`<p class="small">${esc(g.error)}</p><button class="btn" data-action="askAlt">Riprova</button>`);
  else if (Array.isArray(g)) {
    if (!g.length) rows.push('<p class="small muted">Nessun\'altra idea trovata.</p>');
    for (const alt of g) {
      const has = !!pickSource(state.idx, a, alt.type);
      rows.push(`<div class="alt"><span>${esc(alt.name)}${alt.oz != null ? ` · ${formatAmount(alt.oz, c.unit)}` : ''}
        ${has ? '' : '<span class="badge">non in dispensa</span>'}
        ${alt.note ? `<br><span class="small muted">${esc(alt.note)}</span>` : ''}</span>${useButton(alt.type, alt.oz, has)}</div>`);
    }
  }
  return `<div class="alts">${rows.join('')}</div>`;
};

async function askAlternative() {
  const c = state.ui.card;
  const key = needKey();
  if (!key) return;
  const d = drinks().find((x) => x.id === c.id);
  const a = avail();
  const recipe = computeDose(state.idx, d, { portion: 1, strength: 'normale' }).lines
    .map((l) => `${l.oz != null ? formatAmount(l.oz, 'oz') : l.text} ${typeName(state.idx, l.type)}`.trim()).join('; ');
  const pantryNames = [...a.keys()].map((id) => typeName(state.idx, id));
  const forType = c.alts.for;
  c.alts.gemini = 'loading';
  renderOverlay();
  let result;
  try {
    const json = await callGemini({ key, model: state.settings.model, schema: ALT_SCHEMA,
      parts: alternativePrompt(d.name, typeName(state.idx, forType), pantryNames, recipe) });
    result = validateAlternatives(json, state.idx);
  } catch (e) {
    result = { error: e.message };
  }
  if (state.ui.card?.alts?.for === forType) { state.ui.card.alts.gemini = result; renderOverlay(); }
}

// ---- Consigliami (drinks view) ----

recommendBox.render = () => `<form data-submit="recommend" style="display:flex;gap:10px;flex:1;flex-wrap:wrap">
  <input class="input" name="q" style="flex:1 1 220px;width:auto" placeholder="✨ Consigliami: fruttato con tequila…"
    value="${esc(state.ui.picks?.query ?? '')}" aria-label="Consigliami un drink">
  <button class="btn primary" ${state.ui.picks?.status === 'loading' ? 'disabled' : ''}>Consiglia</button></form>`;

gridExtras.top = () => {
  const p = state.ui.picks;
  if (!p) return '';
  const head = (t) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
    <h2 class="section-title">${t}</h2><button class="btn" data-action="clearPicks" aria-label="Chiudi consigli">✕</button></div>`;
  if (p.status === 'loading') return '<p class="muted">✨ Cerco il drink giusto…</p>';
  if (p.status === 'error') return `${head('Consigli')}<p>${esc(p.error)}</p>`;
  const byId = new Map(results().map((r) => [r.drink.id, r]));
  // A picked recipe may have been deleted since.
  const tiles = p.picks.filter((x) => byId.has(x.id)).map((x) => drinkTile(byId.get(x.id), x.why));
  const ext = p.external.map((e) => `<div class="drink"><div class="ph"></div><div class="body">
    <span class="name">${esc(e.name)}</span><span class="why">${esc(e.why)}</span>
    <div class="badges"><span class="badge try">da provare</span></div></div></div>`);
  const body = tiles.length || ext.length ? `<div class="grid">${[...tiles, ...ext].join('')}</div>`
    : '<p class="muted">Nessun drink adatto, prova a riformulare.</p>';
  return head(`Consigliati per «${esc(p.query)}»`) + body;
};

async function recommend(query) {
  const key = needKey();
  if (!key || !query.trim()) return;
  const pool = results().filter(inPool);
  const compact = pool.map((r) => ({ id: r.drink.id, name: r.drink.name, alcoholic: r.drink.alcoholic,
    types: r.drink.ingredients.map((i) => typeName(state.idx, i.type)) }));
  state.ui.picks = { query, status: 'loading' };
  refreshGrid();
  try {
    const json = await callGemini({ key, model: state.settings.model, schema: REC_SCHEMA,
      parts: recommendPrompt(query, compact, outing() ? 'bar' : 'casa') });
    state.ui.picks = { query, status: 'done', ...validateRecommend(json, new Set(compact.map((d) => d.id))) };
  } catch (e) {
    state.ui.picks = { query, status: 'error', error: e.message };
  }
  if (state.ui.tab === 'drinks' && document.getElementById('grid')) refreshGrid();
}

export const aiActions = {
  // Starts right away: pantry siblings show at once, Gemini ideas follow.
  alt: (el) => {
    const hasKey = !!geminiKey();
    state.ui.card.alts = { for: el.dataset.type, gemini: hasKey ? 'loading' : 'nokey' };
    if (hasKey) askAlternative(); else renderOverlay();
  },
  askAlt: () => askAlternative(),
  useSub: (el) => {
    const c = state.ui.card;
    const sub = { from: c.alts.for, to: el.dataset.to, oz: el.dataset.oz != null ? Number(el.dataset.oz) : null };
    state.ui.card = { ...initCard(c.id, sub), unit: c.unit };
    renderOverlay();
  },
  clearSub: () => {
    const c = state.ui.card;
    state.ui.card = { ...initCard(c.id, null), unit: c.unit };
    renderOverlay();
  },
  clearPicks: () => { state.ui.picks = null; refreshGrid(); },
};

export const aiSubmits = {
  recommend: (form) => recommend(new FormData(form).get('q') ?? ''),
};
