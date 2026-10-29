import { state, drinks, evaluated, persist, render, refreshGrid, openCard } from '../app.js';
import { esc } from '../dom.js';
import { typeName } from '../types.js';
import { sortForGrid, spiritGroups, SPIRIT_GROUPS } from '../match.js';

export const CATEGORIES = [
  ['spirit', 'Distillati'], ['liqueur', 'Liquori e vini'], ['sweet', 'Sciroppi e dolcificanti'],
  ['sour', 'Agrumi'], ['juice', 'Succhi'], ['mixer', 'Soda e mixer'],
  ['fresh', 'Frutta, erbe e latticini'], ['other', 'Altro'], ['base', 'Base'],
];

export function groupByCategory(ids) {
  return CATEGORIES.map(([cat, label]) => [label, ids
    .filter((id) => (state.idx.byId[id]?.cat ?? 'other') === cat)
    .sort((a, b) => typeName(state.idx, a).localeCompare(typeName(state.idx, b)))])
    .filter(([, list]) => list.length);
}

export function missingLabel(m) {
  const name = typeName(state.idx, m.type);
  if (m.reason === 'low') return `poco ${name}`;
  return `manca: ${name}${m.reason === 'off' ? ' (spento)' : ''}`;
}

// Outing mode: the pantry does not matter, every drink is on the menu.
export const outing = () => state.settings.mode === 'uscita';
export const isDisliked = (d) => state.disliked.includes(d.id);
export const isSaved = (d) => state.saved.includes(d.id);
export const results = () => (outing() ? drinks().map((drink) => ({ drink })) : evaluated());

export function badges(r) {
  const out = [];
  if (!r.status) { /* outing: no pantry status */ } else if (r.status === 'ok') out.push('<span class="badge ok">ok</span>');
  else if (r.status === 'miss1') out.push(`<span class="badge miss">${esc(missingLabel(r.missing[0]))}</span>`);
  else out.push(`<span class="badge">mancano ${r.missing.length}</span>`);
  if (r.drink.alcoholic === 'no') out.push('<span class="badge na">analcolico</span>');
  if (r.drink.source !== 'cocktaildb') out.push('<span class="badge na">mia</span>');
  if (isDisliked(r.drink)) out.push('<span class="badge">👎</span>');
  return `<div class="badges">${out.join('')}</div>`;
}

// TheCocktailDB serves a 200px version at "<thumb>/small".
const thumb = (d) => (d.thumb ? `${d.thumb}${d.source === 'cocktaildb' ? '/small' : ''}` : null);

export function drinkTile(r, why = '') {
  const src = thumb(r.drink);
  return `<button class="drink" data-action="open" data-id="${esc(r.drink.id)}">
    ${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.removeAttribute('src')">` : '<div class="ph"></div>'}
    <div class="body"><span class="name">${esc(r.drink.name)}</span>
    ${why ? `<span class="why">${esc(why)}</span>` : ''}${badges(r)}</div></button>`;
}

export const passesFilter = (d) => (state.ui.filter === 'all'
  || (state.ui.filter === 'cocktail' ? d.alcoholic !== 'no' : d.alcoholic !== 'yes'))
  && (!outing() || !state.ui.spirits.length || spiritGroups(state.idx, d).some((g) => state.ui.spirits.includes(g)));

// What the grid and the recommendations draw from; disliked drinks only come back through search.
export const inPool = (r) => passesFilter(r.drink) && !isDisliked(r.drink) && (outing() || r.status !== 'missN');
const byName = (rs) => [...rs].sort((a, b) => a.drink.name.localeCompare(b.drink.name));

const section = (title, rs) => (rs.length
  ? `<h2 class="section-title">${esc(title)} (${rs.length})</h2><div class="grid">${rs.map((r) => drinkTile(r)).join('')}</div>`
  : '');

// Recommendation results (Task 9) render through this hook.
export const gridExtras = { top: () => '' };

export function renderGrid() {
  const all = results().filter((r) => passesFilter(r.drink));
  const q = state.ui.search.trim().toLowerCase();
  if (q) {
    const hits = all.filter((r) => r.drink.name.toLowerCase().includes(q));
    const found = outing() ? byName(hits) : sortForGrid(hits);
    return found.length ? section('Risultati', found) : '<p class="muted">Nessun drink con questo nome.</p>';
  }
  if (outing()) {
    const pool = byName(all.filter(inPool));
    return gridExtras.top() + (pool.length ? section('Tutti i drink', pool) : '<p class="muted">Nessun drink con questi filtri.</p>');
  }
  const sorted = sortForGrid(all.filter(inPool));
  const ok = sorted.filter((r) => r.status === 'ok');
  const miss1 = sorted.filter((r) => r.status === 'miss1');
  const empty = !ok.length && !miss1.length
    ? '<p class="muted">Nessun drink possibile con la dispensa attuale. Aggiungi qualche bottiglia nella scheda Dispensa.</p>'
    : '';
  return gridExtras.top() + section('Puoi farli ora', ok) + section('Manca 1 ingrediente', miss1) + empty;
}

function renderFilters() {
  return `<p class="small muted" style="margin:0 0 8px">Fuori casa la dispensa non conta: qui ci sono tutti i drink.</p>
    <h3>Base alcolica</h3>
    <div class="chips">${SPIRIT_GROUPS.map(([g, label]) => `<button class="chip" data-action="spirit" data-v="${g}"
      aria-pressed="${state.ui.spirits.includes(g)}">${label}</button>`).join('')}</div>
    ${state.ui.spirits.length ? '<button class="btn" style="margin-top:12px;width:100%" data-action="clearSpirits">Tutte le basi</button>' : ''}`;
}

const MODES = [['casa', '🏠 Casa'], ['uscita', '🍹 Uscita']];

function renderPanel() {
  const ids = Object.keys(state.pantry.items);
  if (!ids.length) {
    return '<h3>Stasera uso</h3><p class="muted small">Dispensa vuota: aggiungi bottiglie nella scheda Dispensa.</p>';
  }
  const groups = groupByCategory(ids).map(([label, list]) => `<h3>${esc(label)}</h3>${list.map((id) => `
    <label class="toggle"><span>${esc(typeName(state.idx, id))}</span>
      <input type="checkbox" data-change="tonight" data-id="${esc(id)}" ${state.off.includes(id) ? '' : 'checked'}
        aria-label="Usa ${esc(typeName(state.idx, id))} stasera"></label>`).join('')}`).join('');
  return `<p class="small muted" style="margin:0 0 8px">Spento = ignorato solo per ora. La dispensa non cambia.</p>
    ${groups}
    ${state.off.length ? '<button class="btn" style="margin-top:12px;width:100%" data-action="wakeAll">Riaccendi tutto</button>' : ''}`;
}

const FILTERS = [['all', 'Tutti'], ['cocktail', 'Cocktail'], ['mocktail', 'Mocktail']];

export function renderDrinks() {
  return `<div class="toolbar"><div class="seg" role="group" aria-label="Modalità">${MODES.map(([v, l]) =>
      `<button data-action="mode" data-v="${v}" aria-pressed="${state.settings.mode === v}">${l}</button>`).join('')}</div></div>
    <div class="layout">
    <aside class="panel" aria-label="${outing() ? 'Filtri' : 'Stasera uso'}">${outing() ? renderFilters() : renderPanel()}</aside>
    <section>
      <div class="toolbar" id="recommend">${recommendBox.render()}</div>
      <div class="toolbar">
        <input class="input" type="search" placeholder="Cerca un drink per nome…" value="${esc(state.ui.search)}"
          data-input="search" aria-label="Cerca un drink">
        <div class="seg" role="group" aria-label="Tipo di drink">${FILTERS.map(([v, l]) =>
          `<button data-action="filter" data-v="${v}" aria-pressed="${state.ui.filter === v}">${l}</button>`).join('')}</div>
      </div>
      <div id="grid">${renderGrid()}</div>
    </section></div>`;
}

// Replaced by the Gemini box in Task 9.
export const recommendBox = {
  render: () => '<input class="input" placeholder="✨ Consigliami: fruttato con tequila…" disabled aria-label="Consigliami">',
};

export function renderSaved() {
  const rs = byName(results().filter((r) => isSaved(r.drink)));
  return `<h1>Salvati</h1>${rs.length
    ? `<div class="grid">${rs.map((r) => drinkTile(r)).join('')}</div>`
    : '<p class="muted">Nessun drink salvato. Usa ☆ Salva nella scheda di un drink.</p>'}`;
}

export const drinkActions = {
  open: (el) => openCard(el.dataset.id),
  filter: (el) => { state.ui.filter = el.dataset.v; render(); },
  wakeAll: () => { state.off = []; persist('off'); render(); },
  mode: (el) => {
    state.settings = { ...state.settings, mode: el.dataset.v };
    persist('settings');
    state.ui.picks = null; // picks came from the other pool
    render();
  },
  spirit: (el) => {
    const g = el.dataset.v;
    state.ui.spirits = state.ui.spirits.includes(g) ? state.ui.spirits.filter((x) => x !== g) : [...state.ui.spirits, g];
    render();
  },
  clearSpirits: () => { state.ui.spirits = []; render(); },
};

export const drinkChanges = {
  tonight: (el) => {
    const id = el.dataset.id;
    state.off = el.checked ? state.off.filter((x) => x !== id) : [...state.off, id];
    persist('off');
    const scroll = document.querySelector('.panel')?.scrollTop;
    render();
    const panel = document.querySelector('.panel');
    if (panel) panel.scrollTop = scroll;
  },
};

export const drinkInputs = {
  search: (el) => { state.ui.search = el.value; refreshGrid(); },
};
