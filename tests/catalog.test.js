import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeDrink, fetchCatalog, CATALOG_URL, LETTERS } from '../js/catalog.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/margarita.json', import.meta.url)));

test('normalize margarita', () => {
  const d = normalizeDrink(fixture);
  assert.equal(d.id, 'cdb:11007');
  assert.equal(d.name, 'Margarita');
  assert.equal(d.alcoholic, 'yes');
  assert.equal(d.source, 'cocktaildb');
  assert.match(d.thumb, /^https:\/\//);
  assert.match(d.instructions, /Strofina il bordo/);
  assert.deepEqual(d.ingredients[0], { raw: 'Tequila', type: null, oz: 1.5, text: '1 1/2 oz' });
  assert.equal(d.ingredients.length, 4);
  assert.equal(d.ingredients[3].oz, null);
});

test('fallback a strInstructions se IT manca', () => {
  const d = normalizeDrink({ ...fixture, strInstructionsIT: null });
  assert.equal(d.instructions, fixture.strInstructions);
});

test('alcoholic mapping', () => {
  assert.equal(normalizeDrink({ ...fixture, strAlcoholic: 'Non alcoholic' }).alcoholic, 'no');
  assert.equal(normalizeDrink({ ...fixture, strAlcoholic: 'Optional alcohol' }).alcoholic, 'optional');
});

const ok = (drinks) => ({ ok: true, json: async () => ({ drinks }) });

test('fetchCatalog unisce le lettere, salta drinks:null, dedup per id', async () => {
  const calls = [];
  const drinks = await fetchCatalog(async (u) => {
    calls.push(u);
    if (u === CATALOG_URL + 'm') return ok([fixture, fixture]);
    if (u === CATALOG_URL + 'a') return ok([{ ...fixture, idDrink: '1', strDrink: 'A1' }]);
    return ok(null);
  });
  assert.equal(calls.length, LETTERS.length);
  assert.deepEqual(drinks.map((d) => d.id).sort(), ['cdb:1', 'cdb:11007']);
});

test('fetchCatalog rigetta se una lettera fallisce (rete o !ok)', async () => {
  await assert.rejects(fetchCatalog(async (u) => (u.endsWith('=q') ? { ok: false, status: 500 } : ok(null))));
  await assert.rejects(fetchCatalog(async (u) => { if (u.endsWith('=z')) throw new Error('offline'); return ok(null); }));
});
