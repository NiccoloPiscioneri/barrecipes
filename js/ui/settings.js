import { state, drinks, persist, render, toast, loadCatalog } from '../app.js';
import { store } from '../store.js';
import { esc } from '../dom.js';
import { exportData, parseImport } from '../backup.js';
import { modelOrDefault, DEFAULT_MODEL } from '../gemini.js';

export const geminiKey = () => store.get('br.geminiKey', '');

export function renderSettings() {
  const s = state.settings;
  const cat = state.catalog;
  const date = cat ? new Date(cat.fetchedAt).toLocaleDateString('it-IT') : '—';
  return `<h1>Impostazioni</h1>
    <div class="box">
      <h2>Preferenze</h2>
      <div class="field"><label>Unità di misura predefinita</label>
        <div class="seg" role="group" aria-label="Unità predefinita">${['oz', 'ml', 'cl'].map((u) =>
          `<button data-action="setUnit" data-v="${u}" aria-pressed="${s.unit === u}">${u}</button>`).join('')}</div></div>
      <label class="toggle" style="max-width:520px"><span>Ghiaccio, acqua, zucchero e sale sempre disponibili</span>
        <input type="checkbox" data-change="basics" ${s.basics ? 'checked' : ''}></label>
    </div>
    <div class="box">
      <h2>Non mi piacciono</h2>
      ${state.disliked.length ? `<div class="list">${state.disliked.map((id) => `<div class="row">
        <span class="grow">${esc(drinks().find((d) => d.id === id)?.name ?? id)}</span>
        <button class="btn" data-action="undislike" data-id="${esc(id)}">Rimetti in lista</button></div>`).join('')}</div>`
        : '<p class="small muted">Nessuno. Usa 👎 nella scheda di un drink per toglierlo da lista e consigli.</p>'}
    </div>
    <div class="box">
      <h2>Gemini</h2>
      <p class="small">Serve per alternative, consigli e ricette da YouTube. Crea la chiave su
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com</a>
        in un progetto <strong>senza fatturazione</strong>: così non paghi mai nulla, al massimo raggiungi il limite gratuito.
        La chiave resta solo su questo dispositivo e non finisce nei backup.</p>
      <div class="field"><label for="gkey">Chiave API</label>
        <input id="gkey" class="input" type="password" autocomplete="off" value="${esc(geminiKey())}" data-change="geminiKey"></div>
      <div class="field"><label for="gmodel">Modello</label>
        <input id="gmodel" class="input" value="${esc(s.model)}" data-change="model">
        <span class="small muted">Lascia vuoto per usare ${DEFAULT_MODEL}, che Google aggiorna da solo. Se il modello scelto è sovraccarico o ritirato, l'app ripiega su questo.</span></div>
    </div>
    <div class="box">
      <h2>Catalogo</h2>
      <p class="small muted">${cat ? cat.drinks.length : 0} drink da TheCocktailDB, aggiornato il ${date}.</p>
      <button class="btn" data-action="refreshCatalog" ${state.ui.loading != null ? 'disabled' : ''}>
        ${state.ui.loading != null ? 'Aggiorno…' : 'Aggiorna catalogo'}</button>
    </div>
    <div class="box">
      <h2>Backup</h2>
      <p class="small muted">Esporta dispensa, ricette personali e preferenze in un file. L'import sostituisce i dati attuali.</p>
      <button class="btn" data-action="exportData">Esporta</button>
      <label class="btn" style="display:inline-flex;align-items:center">Importa
        <input type="file" accept="application/json,.json" data-change="importFile" hidden></label>
    </div>`;
}

const saveSettings = (patch) => { state.settings = { ...state.settings, ...patch }; persist('settings'); };

export const settingsActions = {
  setUnit: (el) => { saveSettings({ unit: el.dataset.v }); render(); },
  undislike: (el) => { state.disliked = state.disliked.filter((x) => x !== el.dataset.id); persist('disliked'); render(); },
  refreshCatalog: () => { loadCatalog(); render(); },
  exportData: () => {
    const blob = new Blob([JSON.stringify(exportData(state), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `barrecipes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
};

export const settingsChanges = {
  basics: (el) => saveSettings({ basics: el.checked }),
  model: (el) => { saveSettings({ model: modelOrDefault(el.value.trim()) }); el.value = state.settings.model; },
  geminiKey: (el) => {
    store.set('br.geminiKey', el.value.trim());
    toast(el.value.trim() ? 'Chiave salvata su questo dispositivo.' : 'Chiave rimossa.');
  },
  importFile: async (el) => {
    const file = el.files[0];
    el.value = '';
    if (!file) return;
    const r = parseImport(await file.text());
    if (!r.ok) { toast(r.error, 5000); return; }
    const { pantry, recipes } = r.data;
    if (!confirm(`Sostituire dispensa e ricette attuali con il backup (${Object.keys(pantry.items).length} ingredienti, ${recipes.length} ricette)?`)) return;
    state.pantry = pantry;
    state.recipes = recipes;
    state.settings = { ...state.settings, ...r.data.settings };
    state.settings.model = modelOrDefault(state.settings.model);
    state.disliked = r.data.disliked;
    state.saved = r.data.saved;
    state.off = [];
    ['pantry', 'recipes', 'settings', 'off', 'disliked', 'saved'].forEach(persist);
    toast('Backup importato.');
    render();
  },
};
