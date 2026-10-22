import { store } from './store.js';
import { loadTypes, attachTypes } from './types.js';
import { fetchCatalog } from './catalog.js';
import { availableSet } from './pantry.js';
import { evaluate } from './match.js';
import { esc } from './dom.js';
import { renderDrinks, renderGrid, drinkActions, drinkChanges, drinkInputs } from './ui/drinks.js';
import { renderCard, initCard, cardActions } from './ui/card.js';
import { renderPantry, pantryActions, pantryChanges, pantryInputs } from './ui/pantry.js';
import { renderSettings, settingsActions, settingsChanges } from './ui/settings.js';
import { aiActions, aiSubmits } from './ui/ai.js';
import { renderRecipes, recipeActions, recipeInputs, recipeChanges, recipeSubmits } from './ui/recipes.js';

const KEYS = { catalog: 'br.catalog', recipes: 'br.recipes', pantry: 'br.pantry', off: 'br.off', settings: 'br.settings' };

export const state = {
  idx: null,
  catalog: store.get(KEYS.catalog, null),
  recipes: store.get(KEYS.recipes, []),
  pantry: store.get(KEYS.pantry, { items: {} }),
  off: store.get(KEYS.off, []),
  settings: { unit: 'oz', basics: true, model: 'gemini-2.5-flash', ...store.get(KEYS.settings, {}) },
  ui: { tab: 'drinks', filter: 'all', search: '', card: null, picks: null, loading: null, error: null },
};

let warned = false;
export function persist(name) {
  if (store.set(KEYS[name], state[name]) || warned) return;
  warned = true;
  toast('Memoria del browser non disponibile: le modifiche restano solo finché la pagina è aperta.', 6000);
}

// Replace catalog/recipes with new objects (never mutate) so this memo stays valid.
let memo = {};
export function drinks() {
  if (memo.catalog !== state.catalog || memo.recipes !== state.recipes) {
    memo = { catalog: state.catalog, recipes: state.recipes,
      list: attachTypes(state.idx, [...(state.catalog?.drinks ?? []), ...state.recipes]) };
  }
  return memo.list;
}

export const avail = () => availableSet(state.idx, state.pantry, state.off, state.settings.basics);

export function evaluated() {
  const a = avail();
  return drinks().map((drink) => ({ drink, ...evaluate(state.idx, drink, a, state.off) }));
}

let toastTimer;
export function toast(msg, ms = 3000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.textContent = ''; }, ms);
}

const views = {
  drinks: renderDrinks,
  pantry: renderPantry,
  recipes: renderRecipes,
  settings: renderSettings,
};

function renderLoading() {
  if (state.ui.error) {
    return `<div class="center"><h2>Impossibile scaricare il catalogo</h2>
      <p class="muted">${esc(state.ui.error)}</p>
      <button class="btn primary" data-action="retry">Riprova</button></div>`;
  }
  return `<div class="center"><h2>Scarico il catalogo…</h2>
    <progress id="progress" max="1" value="${state.ui.loading ?? 0}"></progress>
    <p class="muted small">Serve solo la prima volta.</p></div>`;
}

export function render() {
  for (const b of document.querySelectorAll('#nav button')) {
    if (b.dataset.tab === state.ui.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  document.getElementById('view').innerHTML = state.catalog ? views[state.ui.tab]() : renderLoading();
  renderOverlay();
}

export function renderOverlay() {
  document.getElementById('overlay').innerHTML = state.ui.card ? renderCard() : '';
}

export const refreshGrid = () => { document.getElementById('grid').innerHTML = renderGrid(); };

export function navigate(tab) {
  state.ui.tab = tab;
  state.ui.card = null;
  render();
  scrollTo(0, 0);
}

export function openCard(id, sub = null) {
  state.ui.card = initCard(id, sub);
  renderOverlay();
}

// Keeps the old cache when the download fails.
export async function loadCatalog() {
  const first = !state.catalog;
  state.ui.error = null;
  state.ui.loading = 0;
  if (first) render();
  try {
    const list = await fetchCatalog(fetch, (p) => {
      state.ui.loading = p;
      const bar = document.getElementById('progress');
      if (bar) bar.value = p;
    });
    state.catalog = { fetchedAt: Date.now(), drinks: list };
    persist('catalog');
    if (!first) toast(`Catalogo aggiornato: ${list.length} drink.`);
  } catch (e) {
    state.ui.error = `${e.message}. Controlla la connessione.`;
    if (!first) toast('Aggiornamento non riuscito, tengo il catalogo attuale.');
  }
  state.ui.loading = null;
  render();
}

const actions = {
  nav: (el) => navigate(el.dataset.tab),
  retry: () => loadCatalog(),
  ...drinkActions,
  ...cardActions,
  ...pantryActions,
  ...settingsActions,
  ...aiActions,
  ...recipeActions,
};
const submits = { ...aiSubmits, ...recipeSubmits };
const changes = { ...drinkChanges, ...pantryChanges, ...settingsChanges, ...recipeChanges };
const inputs = { ...drinkInputs, ...pantryInputs, ...recipeInputs };

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && !el.disabled) actions[el.dataset.action]?.(el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el) changes[el.dataset.change]?.(el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el) inputs[el.dataset.input]?.(el, e);
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-submit]');
  if (!form) return;
  e.preventDefault();
  submits[form.dataset.submit]?.(form, e);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.ui.card) { state.ui.card = null; renderOverlay(); }
});

async function boot() {
  state.idx = loadTypes(await (await fetch('data/types.json')).json());
  render();
  if (!state.catalog) loadCatalog();
}

boot();
