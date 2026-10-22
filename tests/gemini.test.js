import test from 'node:test';
import assert from 'node:assert/strict';
import { callGemini, GeminiError, validateRecommend, validateAlternatives, recommendPrompt, alternativePrompt } from '../js/gemini.js';
import { types } from './helpers.js';

const reply = (obj, status = 200) => async () => ({
  ok: status < 400, status,
  json: async () => (typeof obj === 'string' ? { candidates: [{ content: { parts: [{ text: obj }] } }] } : obj),
});

test('callGemini: invia chiave e modello, ritorna JSON', async () => {
  let seen;
  const out = await callGemini({ key: 'K', model: 'm-1', parts: [{ text: 'hi' }], schema: { type: 'OBJECT' },
    fetchFn: async (url, opts) => { seen = { url, opts }; return reply('{"a":1}')(); } });
  assert.deepEqual(out, { a: 1 });
  assert.match(seen.url, /models\/m-1:generateContent$/);
  assert.equal(seen.opts.headers['x-goog-api-key'], 'K');
  const body = JSON.parse(seen.opts.body);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(body.contents[0].parts, [{ text: 'hi' }]);
});

test('callGemini: 429 → GeminiError limite', async () => {
  await assert.rejects(callGemini({ key: 'K', model: 'm', parts: [], fetchFn: reply({}, 429) }),
    (e) => e instanceof GeminiError && /Limite gratuito/.test(e.message));
});

test('callGemini: 400/403 → chiave non valida', async () => {
  await assert.rejects(callGemini({ key: 'K', model: 'm', parts: [], fetchFn: reply({}, 403) }), /Chiave Gemini non valida/);
});

test('callGemini: testo non JSON o mancante → Risposta non valida', async () => {
  await assert.rejects(callGemini({ key: 'K', model: 'm', parts: [], fetchFn: reply('ciao') }), /Risposta non valida, riprova/);
  await assert.rejects(callGemini({ key: 'K', model: 'm', parts: [], fetchFn: reply({ candidates: [] }) }), /Risposta non valida, riprova/);
});

test('callGemini: errore di rete → GeminiError', async () => {
  await assert.rejects(callGemini({ key: 'K', model: 'm', parts: [], fetchFn: async () => { throw new TypeError('fail'); } }),
    (e) => e instanceof GeminiError && /connessione/.test(e.message));
});

test('validateRecommend scarta id inventati', () => {
  const r = validateRecommend({ picks: [{ id: 'cdb:1', why: 'x' }, { id: 'boh', why: 'y' }] }, new Set(['cdb:1']));
  assert.deepEqual(r.picks, [{ id: 'cdb:1', why: 'x' }]);
});

test('validateRecommend tollera campi mancanti e taglia a 5', () => {
  assert.deepEqual(validateRecommend(null, new Set()), { picks: [], external: [] });
  assert.deepEqual(validateRecommend({ picks: 'x', external: [{ why: 'no name' }, { name: 'Nuovo', why: 'w' }] }, new Set()),
    { picks: [], external: [{ name: 'Nuovo', why: 'w' }] });
  const ids = new Set(['1', '2', '3', '4', '5', '6']);
  assert.equal(validateRecommend({ picks: [...ids].map((id) => ({ id, why: '' })) }, ids).picks.length, 5);
});

test('validateAlternatives risolve tipi e taglia a 3', () => {
  const idx = types();
  const r = validateAlternatives({ alternatives: [
    { name: 'Bitter arancio (tipo Aperol)', oz: 1.25, note: 'più dolce' },
    { name: 'Aperol', oz: 'tanto', note: '' }, { note: 'senza nome' }, { name: 'Vermouth rosso' }, { name: 'Amaretto' },
  ] }, idx);
  assert.equal(r.length, 3);
  assert.deepEqual(r[0], { type: 'bitter-arancio', name: 'Bitter arancio (tipo Aperol)', oz: 1.25, note: 'più dolce' });
  assert.equal(r[1].type, 'bitter-arancio');
  assert.equal(r[1].oz, null);
  assert.equal(r[2].type, 'vermouth-rosso');
});

test('i prompt contengono i dati', () => {
  const p = recommendPrompt('fruttato con tequila', [{ id: 'cdb:1', name: 'Tequila Sunrise', types: ['Tequila'], alcoholic: 'yes' }]);
  assert.match(p[0].text, /fruttato con tequila/);
  assert.match(p[0].text, /cdb:1/);
  const a = alternativePrompt('Negroni', 'Bitter rosso', ['Gin', 'Bitter arancio'], '1 oz Gin; 1 oz Bitter rosso');
  assert.match(a[0].text, /Negroni/);
  assert.match(a[0].text, /Bitter arancio/);
});

test('callGemini: 400 mostra il messaggio di Gemini (es. video privato)', async () => {
  await assert.rejects(callGemini({ key: 'K', model: 'm', parts: [], fetchFn: reply({ error: { message: 'Video unavailable' } }, 400) }),
    (e) => e instanceof GeminiError && /Video unavailable/.test(e.message));
});
