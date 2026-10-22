import { state, drinks, persist, render, toast } from '../app.js';
import { esc } from '../dom.js';
import { typeName, resolveType } from '../types.js';
import { formatAmount, parseQty, PER_OZ } from '../measure.js';
import { groupByCategory } from './drinks.js';

const ui = { query: '', unit: null };
const unit = () => ui.unit ?? state.settings.unit;

// Suggestions: every known type (catalog ingredients included) matching the query.
export function typeSuggestions(query, exclude = []) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  drinks(); // registers 'x:' types for every catalog ingredient
  return Object.values(state.idx.byId)
    .filter((t) => !exclude.includes(t.id) && t.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.toLowerCase().indexOf(q) - b.name.toLowerCase().indexOf(q) || a.name.localeCompare(b.name))
    .slice(0, 12);
}

export function renderSuggestList(query, action, exclude = []) {
  const list = typeSuggestions(query, exclude);
  const exact = list.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());
  const items = list.map((t) => `<li><button data-action="${action}" data-id="${esc(t.id)}">${esc(t.name)}</button></li>`);
  if (query.trim() && !exact) {
    items.push(`<li><button data-action="${action}" data-new="${esc(query.trim())}">➕ Nuovo ingrediente: «${esc(query.trim())}»</button></li>`);
  }
  return items.length ? `<ul>${items.join('')}</ul>` : '';
}

const shown = (oz) => (oz == null ? '' : String(Math.round(oz * PER_OZ[unit()] * 100) / 100));

function renderList() {
  const ids = Object.keys(state.pantry.items);
  if (!ids.length) return '<p class="muted">La dispensa è vuota. Cerca qui sopra la prima bottiglia.</p>';
  return groupByCategory(ids).map(([label, list]) => `<h2 class="section-title">${esc(label)}</h2>
    <div class="list">${list.map((id) => {
      const { oz } = state.pantry.items[id];
      const name = typeName(state.idx, id);
      return `<div class="row"><span class="grow">${esc(name)}
          ${oz != null && oz < 2 ? '<span class="badge miss">quasi finita</span>' : ''}</span>
        <input class="input qty" inputmode="decimal" placeholder="—" value="${shown(oz)}"
          data-change="qty" data-id="${esc(id)}" aria-label="Quantità di ${esc(name)} in ${unit()}">
        <span class="muted small">${unit()}</span>
        <button class="btn danger" data-action="removeItem" data-id="${esc(id)}" aria-label="Rimuovi ${esc(name)}">Rimuovi</button>
      </div>`;
    }).join('')}</div>`).join('');
}

export function renderPantry() {
  return `<h1>Dispensa</h1>
    <div class="box">
      <div class="suggest">
        <input class="input" type="search" placeholder="Aggiungi: rum bianco, tonica, granatina…"
          value="${esc(ui.query)}" data-input="pantrySearch" aria-label="Cerca un ingrediente da aggiungere">
        <div id="pantry-suggest">${renderSuggestList(ui.query, 'addItem', Object.keys(state.pantry.items))}</div>
      </div>
      <p class="small muted">Quantità in
        <span class="seg" role="group" aria-label="Unità">${['oz', 'ml', 'cl'].map((u) =>
          `<button data-action="pantryUnit" data-v="${u}" aria-pressed="${unit() === u}">${u}</button>`).join('')}</span>.
        Lascia vuoto per ciò che non misuri (lime, menta…). Una bottiglia da 70 cl ≈ 23,5 oz.</p>
    </div>
    ${renderList()}`;
}

function setItems(items) {
  state.pantry = { ...state.pantry, items };
  persist('pantry');
}

export const pantryActions = {
  addItem: (el) => {
    const id = el.dataset.id ?? resolveType(state.idx, el.dataset.new);
    setItems({ ...state.pantry.items, [id]: { oz: null } });
    ui.query = '';
    render();
    toast(`${typeName(state.idx, id)} aggiunto. Inserisci la quantità se vuoi tracciarla.`);
  },
  removeItem: (el) => {
    const { [el.dataset.id]: _, ...rest } = state.pantry.items;
    setItems(rest);
    state.off = state.off.filter((x) => x !== el.dataset.id);
    persist('off');
    render();
  },
  pantryUnit: (el) => { ui.unit = el.dataset.v; render(); },
};

export const pantryChanges = {
  qty: (el) => {
    const oz = parseQty(el.value, unit());
    if (oz === undefined) { toast('Quantità non valida.'); el.value = shown(state.pantry.items[el.dataset.id].oz); return; }
    if (oz === 0) {
      pantryActions.removeItem(el);
      toast(`${typeName(state.idx, el.dataset.id)} finito: rimosso dalla dispensa.`);
      return;
    }
    setItems({ ...state.pantry.items, [el.dataset.id]: { oz } });
    toast(oz == null ? 'Quantità non tracciata.' : `Restano ${formatAmount(oz, unit())}.`);
  },
};

export const pantryInputs = {
  pantrySearch: (el) => {
    ui.query = el.value;
    document.getElementById('pantry-suggest').innerHTML = renderSuggestList(ui.query, 'addItem', Object.keys(state.pantry.items));
  },
};
