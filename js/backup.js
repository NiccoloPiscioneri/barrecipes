const VERSION = 1;

export function exportData({ pantry, recipes, settings }) {
  const { geminiKey, ...safe } = settings; // the key never leaves the device
  return { app: 'barrecipes', version: VERSION, exportedAt: new Date().toISOString(), pantry, recipes, settings: safe };
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const validOz = (oz) => oz === null || (typeof oz === 'number' && Number.isFinite(oz) && oz >= 0);

function check(d) {
  if (!isObj(d) || d.app !== 'barrecipes') return 'Questo file non è un backup di BarRecipes.';
  if (d.version !== VERSION) return 'Versione del backup non supportata.';
  if (!isObj(d.pantry) || !isObj(d.pantry.items)) return 'Dispensa non valida nel file.';
  for (const [id, item] of Object.entries(d.pantry.items)) {
    if (!isObj(item) || !validOz(item.oz)) return `Quantità non valida per "${id}".`;
  }
  if (!Array.isArray(d.recipes)) return 'Ricette non valide nel file.';
  for (const r of d.recipes) {
    if (!isObj(r) || typeof r.id !== 'string' || typeof r.name !== 'string' || !Array.isArray(r.ingredients)) {
      return 'Una ricetta nel file non è valida.';
    }
    if (r.url !== undefined && !/^https:\/\//i.test(String(r.url))) return `Link non valido in "${r.name}".`;
    if (r.ingredients.some((i) => !isObj(i) || typeof i.raw !== 'string' || !validOz(i.oz ?? null)
      || (i.type != null && typeof i.type !== 'string'))) {
      return `Ingredienti non validi in "${r.name}".`;
    }
  }
  const st = d.settings;
  if (st !== undefined && (!isObj(st) || (st.unit !== undefined && !['oz', 'ml', 'cl'].includes(st.unit))
    || (st.basics !== undefined && typeof st.basics !== 'boolean')
    || (st.model !== undefined && typeof st.model !== 'string'))) return 'Impostazioni non valide nel file.';
  return null;
}

export function parseImport(text) {
  let d;
  try { d = JSON.parse(text); } catch { return { ok: false, error: 'Il file non è un JSON valido. Questo file non è un backup di BarRecipes.' }; }
  const error = check(d);
  if (error) return { ok: false, error };
  const { geminiKey, ...settings } = d.settings ?? {};
  return { ok: true, data: { pantry: { items: d.pantry.items }, recipes: d.recipes, settings } };
}
