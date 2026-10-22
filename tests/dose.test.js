import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDose, feasible, usage } from '../js/dose.js';
import { availableSet } from '../js/pantry.js';
import { attachTypes } from '../js/types.js';
import { types } from './helpers.js';

const idx = types();
const drink = (name, ings, alcoholic = 'yes') => attachTypes(idx, [{ id: name, name, alcoholic,
  ingredients: ings.map(([raw, oz]) => ({ raw, type: null, oz, text: '' })) }])[0];
const margarita = drink('Margarita', [['Tequila', 1.5], ['Triple sec', 0.5], ['Lime juice', 1], ['Salt', null]]);
const ozs = (r) => r.lines.map((l) => (l.oz == null ? null : Math.round(l.oz * 1000) / 1000));
const avail = (items) => availableSet(idx, { items }, [], true);

test('margarita normale ×1 invariata', () => {
  const r = computeDose(idx, margarita, { portion: 1, strength: 'normale' });
  assert.deepEqual(ozs(r), [1.5, 0.5, 1, null]);
});

test('margarita leggero: alcol, dolce e acido ×0.7 + top di soda', () => {
  const r = computeDose(idx, margarita, { portion: 1, strength: 'leggero' });
  assert.deepEqual(ozs(r), [1.05, 0.35, 0.7, null, 0.9]);
  assert.equal(r.lines[4].type, 'soda');
  assert.equal(r.lines[4].added, true);
});

test('gin tonic leggero: gin ×0.7, tonica +0.3×gin', () => {
  const gt = drink('Gin Tonic', [['Gin', 2], ['Tonic water', 5]]);
  assert.deepEqual(ozs(computeDose(idx, gt, { portion: 1, strength: 'leggero' })), [1.4, 5.6]);
});

test('long con mixer senza misura: mixer resta null', () => {
  const gt = drink('Gin Tonic', [['Gin', 2], ['Tonic water', null]]);
  assert.deepEqual(ozs(computeDose(idx, gt, { portion: 1, strength: 'leggero' })), [1.4, null]);
});

test('forte su long: mixer ridotto, mai negativo', () => {
  const gt = drink('Gin Tonic', [['Gin', 2], ['Tonic water', 0.4]]);
  assert.deepEqual(ozs(computeDose(idx, gt, { portion: 1, strength: 'forte' })), [2.5, 0]);
});

test('succo ≥ 2 oz rende il drink lungo', () => {
  const sd = drink('Screwdriver', [['Vodka', 2], ['Orange juice', 4]]);
  assert.deepEqual(ozs(computeDose(idx, sd, { portion: 1, strength: 'leggero' })), [1.4, 4.6]);
});

test('mezza porzione dimezza tutto', () => {
  assert.deepEqual(ozs(computeDose(idx, margarita, { portion: 0.5, strength: 'normale' })), [0.75, 0.25, 0.5, null]);
});

test('mocktail ignora strength', () => {
  const vm = drink('Virgin', [['Lime juice', 1], ['Sugar syrup', 0.5]], 'no');
  assert.deepEqual(ozs(computeDose(idx, vm, { portion: 1, strength: 'forte' })), [1, 0.5]);
});

test('sostituzione cambia tipo e dose', () => {
  const neg = drink('Negroni', [['Gin', 1], ['Campari', 1], ['Sweet Vermouth', 1]]);
  const r = computeDose(idx, neg, { portion: 1, strength: 'normale' }, { from: 'bitter-rosso', to: 'bitter-arancio', oz: 1.25 });
  assert.equal(r.lines[1].type, 'bitter-arancio');
  assert.equal(r.lines[1].oz, 1.25);
});

test('feasible: resta 0.6 oz tequila → solo ½ leggero', () => {
  const a = avail({ tequila: { oz: 0.6 }, 'triple-sec': { oz: 5 }, 'succo-lime': { oz: null } });
  assert.deepEqual(feasible(idx, margarita, a), [{ portion: 0.5, strength: 'leggero' }]);
});

test('feasible: ingrediente assente → nessuna combinazione', () => {
  assert.deepEqual(feasible(idx, margarita, avail({ tequila: { oz: 10 } })), []);
});

test('feasible: mocktail solo normale', () => {
  const vm = drink('Virgin', [['Lime juice', 1]], 'no');
  assert.deepEqual(feasible(idx, vm, avail({ 'succo-lime': { oz: null } })).map((c) => c.strength), ['normale', 'normale', 'normale', 'normale', 'normale']);
});

test('feasible con sostituzione usa la bottiglia sostitutiva e la sua dose', () => {
  const neg = drink('Negroni', [['Gin', 1], ['Campari', 1], ['Sweet Vermouth', 1]]);
  const a = avail({ gin: { oz: 10 }, 'vermouth-rosso': { oz: 10 }, 'bitter-arancio': { oz: 0.6 } });
  assert.deepEqual(feasible(idx, neg, a, { from: 'bitter-rosso', to: 'bitter-arancio', oz: 1 }),
    [{ portion: 0.5, strength: 'leggero' }, { portion: 0.5, strength: 'normale' }]);
});

test('usage salta righe null, somma per fonte e sceglie la fonte con pickSource', () => {
  const d = drink('Rums', [['Rum', 1], ['Light rum', 0.5], ['Lime', null]]);
  const a = avail({ 'rum-bianco': { oz: 5 }, lime: { oz: null } });
  const lines = computeDose(idx, d, { portion: 1, strength: 'normale' }).lines;
  assert.deepEqual(usage(idx, lines, a), [{ typeId: 'rum-bianco', oz: 1.5 }]);
});
