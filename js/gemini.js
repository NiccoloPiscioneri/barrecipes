import { resolveType } from './types.js';

export class GeminiError extends Error {}

const API = 'https://generativelanguage.googleapis.com/v1beta/models/';

export async function callGemini({ key, model, parts, schema, fetchFn = fetch }) {
  let res;
  try {
    res = await fetchFn(`${API}${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', ...(schema && { responseSchema: schema }) },
      }),
    });
  } catch {
    throw new GeminiError('Gemini non raggiungibile: controlla la connessione.');
  }
  if (res.status === 429) throw new GeminiError('Limite gratuito raggiunto, riprova più tardi.');
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new GeminiError('Chiave Gemini non valida o non autorizzata (o modello non disponibile): controlla le Impostazioni.');
  }
  if (!res.ok) throw new GeminiError(`Gemini ha risposto con un errore (${res.status}), riprova.`);
  try {
    const data = await res.json();
    return JSON.parse(data.candidates[0].content.parts[0].text);
  } catch {
    throw new GeminiError('Risposta non valida, riprova.');
  }
}

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

export const ALT_SCHEMA = {
  type: 'OBJECT',
  properties: { alternatives: { type: 'ARRAY', items: { type: 'OBJECT',
    properties: { name: { type: 'STRING' }, oz: { type: 'NUMBER' }, note: { type: 'STRING' } }, required: ['name'] } } },
  required: ['alternatives'],
};

export function alternativePrompt(drinkName, missingName, pantryNames, recipe = '') {
  return [{ text: `Sei un bartender esperto. Per il drink "${drinkName}" (ricetta per 1 porzione: ${recipe}) manca "${missingName}".
Proponi da 1 a 3 sostituti, preferendo ingredienti presenti in questa dispensa: ${pantryNames.join(', ') || '(vuota)'}.
Per ogni sostituto dai: "name" (scritto esattamente come nella dispensa se viene da lì), "oz" (dose in once per 1 porzione, aggiustata per mantenere l'equilibrio) e "note" (una frase in italiano su come cambia il drink).` }];
}

export function validateAlternatives(json, idx) {
  return arr(json?.alternatives)
    .filter((a) => str(a?.name))
    .slice(0, 3)
    .map((a) => ({ type: resolveType(idx, str(a.name)), name: str(a.name), oz: num(a.oz), note: str(a.note) }));
}

export const REC_SCHEMA = {
  type: 'OBJECT',
  properties: {
    picks: { type: 'ARRAY', items: { type: 'OBJECT', properties: { id: { type: 'STRING' }, why: { type: 'STRING' } }, required: ['id'] } },
    external: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, why: { type: 'STRING' } }, required: ['name'] } },
  },
  required: ['picks'],
};

export function recommendPrompt(query, compact) {
  const list = compact.map((d) => `${d.id} | ${d.name} | ${d.types.join(', ')}${d.alcoholic === 'no' ? ' | analcolico' : ''}`).join('\n');
  return [{ text: `Sei un bartender. Richiesta: "${query}".
Scegli da 3 a 5 drink SOLO da questo elenco (formato: id | nome | ingredienti) e restituisci in "picks" il loro id esatto con "why": una riga in italiano sul perché.
Se nessuno è adatto, lascia "picks" vuoto e proponi in "external" fino a 2 drink famosi (name, why) che non sono nell'elenco.
Elenco:
${list}` }];
}

export function validateRecommend(json, ids) {
  const picks = arr(json?.picks).filter((p) => ids.has(str(p?.id))).slice(0, 5)
    .map((p) => ({ id: str(p.id), why: str(p.why) }));
  const external = arr(json?.external).filter((e) => str(e?.name)).slice(0, 2)
    .map((e) => ({ name: str(e.name), why: str(e.why) }));
  return { picks, external };
}
