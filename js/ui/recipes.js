import { state, persist, render, toast } from '../app.js';
import { esc, safeUrl } from '../dom.js';
import { typeName, resolveType } from '../types.js';
import { parseQty, PER_OZ } from '../measure.js';
import { newRecipe } from '../recipes.js';
import { callGemini, isYoutubeUrl, youtubeParts, validateExtracted, EXTRACT_SCHEMA } from '../gemini.js';
import { renderSuggestList } from './pantry.js';
import { geminiKey } from './settings.js';

// form: draft being edited; drafts: recipes extracted from YouTube waiting for review.
const ui = { form: null, drafts: [], yt: '', ytLoading: false, rowQuery: {} };

const emptyRow = () => ({ type: null, qty: '', unit: state.settings.unit, text: '' });

function toDraft(d) {
  return {
    id: d.id ?? null,
    source: d.source === 'youtube' ? 'youtube' : 'manual', url: d.url ?? '',
    name: d.name, alcoholic: d.alcoholic === 'no' ? 'no' : 'yes', instructions: d.instructions ?? '',
    rows: d.ingredients.map((i) => ({ type: i.type, qty: i.oz != null ? String(Math.round(i.oz * 100) / 100) : '',
      unit: 'oz', text: i.oz == null ? i.text : '' })),
  };
}

function renderRow(r, n) {
  const typeCell = r.type
    ? `<span class="grow"><strong>${esc(typeName(state.idx, r.type))}</strong>
        <button class="btn" data-action="rowClearType" data-row="${n}" aria-label="Cambia ingrediente">Cambia</button></span>`
    : `<div class="suggest grow"><input class="input" placeholder="Ingrediente…" value="${esc(ui.rowQuery[n] ?? '')}"
        data-input="rowSearch" data-row="${n}" aria-label="Ingrediente ${n + 1}">
        <div id="row-suggest-${n}">${renderSuggestList(ui.rowQuery[n] ?? '', 'rowPickType')}</div></div>`;
  return `<div class="row" data-row="${n}">${typeCell}
    <input class="input qty" inputmode="decimal" placeholder="dose" value="${esc(r.qty)}" data-input="rowField" data-field="qty" data-row="${n}" aria-label="Dose">
    <select class="input qty" data-change="rowUnit" data-row="${n}" aria-label="Unità">${Object.keys(PER_OZ).map((u) =>
      `<option ${r.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
    <input class="input" style="flex:1 1 120px;width:auto" placeholder="o testo: top, 1 fetta…" value="${esc(r.text)}"
      data-input="rowField" data-field="text" data-row="${n}" aria-label="Dose a testo">
    <button class="btn danger" data-action="rowRemove" data-row="${n}" aria-label="Rimuovi ingrediente">✕</button></div>`;
}

function renderForm() {
  const f = ui.form;
  return `<div class="box"><h2>${f.id ? 'Modifica ricetta' : 'Nuova ricetta'}</h2>
    ${safeUrl(f.url) ? `<p class="small muted">Da <a href="${esc(safeUrl(f.url))}" target="_blank" rel="noopener">${esc(f.url)}</a></p>` : ''}
    <div class="field"><label for="rname">Nome</label>
      <input id="rname" class="input" value="${esc(f.name)}" data-input="formField" data-field="name"></div>
    <label class="toggle" style="max-width:260px"><span>Analcolico</span>
      <input type="checkbox" data-change="formAlcoholic" ${f.alcoholic === 'no' ? 'checked' : ''}></label>
    <h3>Ingredienti</h3>
    <div class="list">${f.rows.map(renderRow).join('')}</div>
    <button class="btn" style="margin:8px 0 16px" data-action="rowAdd">+ Ingrediente</button>
    <div class="field"><label for="rinstr">Procedimento</label>
      <textarea id="rinstr" class="input" rows="4" data-input="formField" data-field="instructions">${esc(f.instructions)}</textarea></div>
    <button class="btn primary" data-action="formSave">Salva</button>
    <button class="btn" data-action="formCancel">Annulla</button></div>`;
}

function renderList() {
  if (!state.recipes.length) return '<p class="muted">Nessuna ricetta personale ancora.</p>';
  return `<div class="list">${state.recipes.map((r) => `<div class="row">
    <span class="grow"><strong>${esc(r.name)}</strong> <span class="badge ${r.source === 'youtube' ? 'miss' : 'na'}">${r.source === 'youtube' ? 'YouTube' : 'manuale'}</span>
      ${r.alcoholic === 'no' ? '<span class="badge na">analcolico</span>' : ''}</span>
    <button class="btn" data-action="open" data-id="${esc(r.id)}">Apri</button>
    <button class="btn" data-action="recipeEdit" data-id="${esc(r.id)}">Modifica</button>
    <button class="btn danger" data-action="recipeDelete" data-id="${esc(r.id)}">Elimina</button></div>`).join('')}</div>`;
}

export function renderRecipes() {
  if (ui.form) return `<h1>Le mie ricette</h1>${renderForm()}`;
  const drafts = ui.drafts.length ? `<div class="box"><h2>Estratti dal video (${ui.drafts.length})</h2>
    <p class="small muted">Controlla e salva ciascuno.</p><div class="list">${ui.drafts.map((d, n) => `<div class="row">
      <span class="grow"><strong>${esc(d.name)}</strong> · ${d.ingredients.length} ingredienti</span>
      <button class="btn primary" data-action="draftEdit" data-n="${n}">Controlla e salva</button>
      <button class="btn danger" data-action="draftDrop" data-n="${n}">Scarta</button></div>`).join('')}</div></div>` : '';
  return `<h1>Le mie ricette</h1>
    <div class="box"><button class="btn primary" data-action="recipeNew">+ Nuova ricetta</button></div>
    <div class="box"><h2>Da YouTube</h2>
      <form data-submit="youtube" style="display:flex;gap:10px;flex-wrap:wrap">
        <input class="input" name="url" style="flex:1 1 260px;width:auto" placeholder="https://www.youtube.com/watch?v=…"
          value="${esc(ui.yt)}" aria-label="Link del video YouTube">
        <button class="btn" ${ui.ytLoading ? 'disabled' : ''}>${ui.ytLoading ? 'Analizzo…' : 'Estrai drink'}</button></form>
      <p class="small muted">Solo video pubblici. Gemini guarda il video ed estrae le ricette.</p></div>
    ${drafts}${renderList()}`;
}

function saveForm() {
  const f = ui.form;
  if (!f.name.trim()) return toast('Dai un nome alla ricetta.');
  const rows = f.rows.filter((r) => r.type);
  if (!rows.length) return toast('Aggiungi almeno un ingrediente.');
  const ingredients = [];
  for (const r of rows) {
    const oz = parseQty(r.qty, r.unit);
    if (oz === undefined) return toast(`Dose non valida per ${typeName(state.idx, r.type)}.`);
    ingredients.push({ type: r.type, oz, text: r.text });
  }
  const recipe = newRecipe(state.idx, { ...f, id: f.id ?? undefined, url: f.url || undefined, ingredients });
  const exists = state.recipes.some((x) => x.id === recipe.id);
  state.recipes = exists ? state.recipes.map((x) => (x.id === recipe.id ? recipe : x)) : [...state.recipes, recipe];
  persist('recipes');
  if (f.draftIndex != null) ui.drafts = ui.drafts.filter((_, n) => n !== f.draftIndex);
  ui.form = null;
  ui.rowQuery = {};
  toast(`«${recipe.name}» salvata. La trovi anche nella griglia dei drink.`);
  render();
}

async function extract(url) {
  ui.yt = url;
  if (!isYoutubeUrl(url)) return toast('Incolla un link YouTube valido (youtube.com/watch, youtu.be o shorts).');
  const key = geminiKey();
  if (!key) return toast('Aggiungi la chiave Gemini in Impostazioni per usare questa funzione.', 5000);
  if (!confirm('Analizzo il video con Gemini (conta sul limite gratuito giornaliero). Procedo?')) return;
  ui.ytLoading = true;
  render();
  try {
    const names = Object.values(state.idx.byId).filter((t) => !t.id.startsWith('x:')).map((t) => t.name);
    const json = await callGemini({ key, model: state.settings.model, schema: EXTRACT_SCHEMA, parts: youtubeParts(url.trim(), names) });
    const found = validateExtracted(json, state.idx, url.trim());
    if (!found.length) toast('Nessun drink trovato nel video.');
    ui.drafts = [...ui.drafts, ...found];
    ui.yt = '';
  } catch (e) {
    toast(e.message, 6000);
  }
  ui.ytLoading = false;
  if (state.ui.tab === 'recipes') render();
}

const row = (el) => ui.form.rows[Number(el.dataset.row)];

export const recipeActions = {
  recipeNew: () => { ui.form = { id: null, source: 'manual', url: '', name: '', alcoholic: 'yes', instructions: '', rows: [emptyRow()] }; render(); },
  recipeEdit: (el) => { ui.form = toDraft(state.recipes.find((r) => r.id === el.dataset.id)); render(); },
  recipeDelete: (el) => {
    const r = state.recipes.find((x) => x.id === el.dataset.id);
    if (!confirm(`Eliminare «${r.name}»?`)) return;
    state.recipes = state.recipes.filter((x) => x.id !== r.id);
    persist('recipes');
    render();
  },
  draftEdit: (el) => { const n = Number(el.dataset.n); ui.form = { ...toDraft(ui.drafts[n]), draftIndex: n }; render(); },
  draftDrop: (el) => { ui.drafts = ui.drafts.filter((_, n) => n !== Number(el.dataset.n)); render(); },
  rowAdd: () => { ui.form.rows.push(emptyRow()); render(); },
  rowRemove: (el) => { ui.form.rows.splice(Number(el.dataset.row), 1); ui.rowQuery = {}; render(); },
  rowClearType: (el) => { row(el).type = null; render(); },
  rowPickType: (el) => {
    const n = Number(el.closest('[data-row]').dataset.row);
    ui.form.rows[n].type = el.dataset.id ?? resolveType(state.idx, el.dataset.new);
    delete ui.rowQuery[n];
    render();
  },
  formSave: () => saveForm(),
  formCancel: () => { ui.form = null; ui.rowQuery = {}; render(); },
};

export const recipeInputs = {
  formField: (el) => { ui.form[el.dataset.field] = el.value; },
  rowField: (el) => { row(el)[el.dataset.field] = el.value; },
  rowSearch: (el) => {
    const n = Number(el.dataset.row);
    ui.rowQuery[n] = el.value;
    document.getElementById(`row-suggest-${n}`).innerHTML = renderSuggestList(el.value, 'rowPickType');
  },
};

export const recipeChanges = {
  formAlcoholic: (el) => { ui.form.alcoholic = el.checked ? 'no' : 'yes'; },
  rowUnit: (el) => { row(el).unit = el.value; },
};

export const recipeSubmits = {
  youtube: (form) => extract(String(new FormData(form).get('url') ?? '')),
};

