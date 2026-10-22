import { parseMeasure } from './measure.js';

export const CATALOG_URL = 'https://www.thecocktaildb.com/api/json/v1/1/search.php?f=';
export const LETTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';

const ALCOHOLIC = { Alcoholic: 'yes', 'Non alcoholic': 'no', 'Optional alcohol': 'optional' };

export function normalizeDrink(raw) {
  const ingredients = [];
  for (let i = 1; i <= 15; i++) {
    const name = raw[`strIngredient${i}`]?.trim();
    if (!name) continue;
    const { oz, text } = parseMeasure(raw[`strMeasure${i}`]);
    ingredients.push({ raw: name, type: null, oz, text });
  }
  return {
    id: `cdb:${raw.idDrink}`,
    name: raw.strDrink,
    thumb: raw.strDrinkThumb || null,
    alcoholic: ALCOHOLIC[raw.strAlcoholic] ?? 'yes',
    instructions: raw.strInstructionsIT || raw.strInstructions || '',
    ingredients,
    source: 'cocktaildb',
  };
}

async function fetchLetter(fetchFn, letter) {
  const res = await fetchFn(CATALOG_URL + letter);
  if (!res.ok) throw new Error(`TheCocktailDB ${letter}: HTTP ${res.status}`);
  return (await res.json()).drinks ?? [];
}

// Free key cannot filter by several ingredients, so we download everything once.
// Rejects on any failure: the caller keeps its old cache in that case.
export async function fetchCatalog(fetchFn = fetch, onProgress = () => {}) {
  const byId = new Map();
  const letters = [...LETTERS];
  for (let i = 0; i < letters.length; i += 6) {
    const chunk = await Promise.all(letters.slice(i, i + 6).map((l) => fetchLetter(fetchFn, l)));
    for (const raw of chunk.flat()) byId.set(raw.idDrink, normalizeDrink(raw));
    onProgress(Math.min(i + 6, letters.length) / letters.length);
  }
  return [...byId.values()];
}
