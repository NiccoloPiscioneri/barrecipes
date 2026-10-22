import test from 'node:test';
import assert from 'node:assert/strict';
import { exportData, parseImport } from '../js/backup.js';

const recipe = { id: 'my:1', name: 'Mio', alcoholic: 'yes', instructions: '', source: 'manual',
  ingredients: [{ raw: 'Gin', type: 'gin', oz: 1, text: '1 oz' }] };
const state = {
  pantry: { items: { gin: { oz: 10 }, lime: { oz: null } } },
  recipes: [recipe],
  settings: { unit: 'oz', basics: true, model: 'gemini-2.5-flash', geminiKey: 'SEGRETO' },
};

test('export non contiene la chiave Gemini', () => {
  const out = JSON.stringify(exportData(state));
  assert.ok(!out.includes('SEGRETO'));
  assert.ok(!out.includes('geminiKey'));
});

test('roundtrip export → parseImport', () => {
  const r = parseImport(JSON.stringify(exportData(state)));
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.pantry, state.pantry);
  assert.deepEqual(r.data.recipes, [recipe]);
  assert.equal(r.data.settings.unit, 'oz');
});

const bad = (obj) => parseImport(typeof obj === 'string' ? obj : JSON.stringify(obj));
const base = () => JSON.parse(JSON.stringify(exportData(state)));

test('rifiuta JSON non valido e file di altre app', () => {
  assert.equal(bad('{nope').ok, false);
  assert.equal(bad({}).ok, false);
  assert.equal(bad({ ...base(), app: 'altro' }).ok, false);
  assert.equal(bad({ ...base(), version: 99 }).ok, false);
  assert.equal(bad('null').ok, false);
});

test('rifiuta dispensa malformata', () => {
  assert.equal(bad({ ...base(), pantry: { items: [] } }).ok, false);
  assert.equal(bad({ ...base(), pantry: { items: { gin: { oz: -1 } } } }).ok, false);
  assert.equal(bad({ ...base(), pantry: { items: { gin: { oz: 'tanto' } } } }).ok, false);
  assert.equal(bad({ ...base(), pantry: null }).ok, false);
});

test('rifiuta ricette malformate', () => {
  assert.equal(bad({ ...base(), recipes: {} }).ok, false);
  assert.equal(bad({ ...base(), recipes: [{ id: 'my:1' }] }).ok, false);
  assert.equal(bad({ ...base(), recipes: [{ ...recipe, ingredients: 'gin' }] }).ok, false);
});

test('errore leggibile', () => assert.match(bad({}).error, /BarRecipes/));

test('rifiuta url non https, type non stringa e impostazioni non valide', () => {
  assert.equal(bad({ ...base(), recipes: [{ ...recipe, url: 'javascript:alert(1)' }] }).ok, false);
  assert.equal(bad({ ...base(), recipes: [{ ...recipe, ingredients: [{ raw: 'Gin', type: 5, oz: 1, text: '' }] }] }).ok, false);
  assert.equal(bad({ ...base(), settings: { unit: 'gallon' } }).ok, false);
  assert.equal(bad({ ...base(), settings: { basics: 'no' } }).ok, false);
  assert.equal(bad({ ...base(), settings: { model: 3 } }).ok, false);
  assert.equal(bad({ ...base(), recipes: [{ ...recipe, url: 'https://youtu.be/a' }] }).ok, true);
});
