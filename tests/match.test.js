import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, sortForGrid } from '../js/match.js';
import { availableSet } from '../js/pantry.js';
import { attachTypes } from '../js/types.js';
import { types } from './helpers.js';

const idx = types();
const drink = (name, ings) => attachTypes(idx, [{ id: name, name, ingredients: ings.map(([raw, oz]) => ({ raw, type: null, oz, text: '' })) }])[0];
const margarita = drink('Margarita', [['Tequila', 1.5], ['Triple sec', 0.5], ['Lime juice', 1], ['Salt', null]]);
const avail = (items, off = []) => availableSet(idx, { items }, off, true);

test('ok se tutto disponibile, base inclusi', () => {
  const r = evaluate(idx, margarita, avail({ tequila: { oz: 10 }, 'triple-sec': { oz: null }, 'succo-lime': { oz: null } }), []);
  assert.deepEqual(r, { status: 'ok', missing: [] });
});

test('padre richiesto, figlio posseduto → ok', () => {
  const d = drink('Rum shot', [['Rum', 1]]);
  assert.equal(evaluate(idx, d, avail({ 'rum-scuro': { oz: 5 } }), []).status, 'ok');
});

test('figlio richiesto, solo fratello posseduto → manca', () => {
  const d = drink('Negroni', [['Campari', 1]]);
  assert.equal(evaluate(idx, d, avail({ 'bitter-arancio': { oz: 5 } }), []).status, 'miss1');
});

test('mancante uno → miss1 con reason absent', () => {
  const r = evaluate(idx, margarita, avail({ tequila: { oz: 10 }, 'succo-lime': { oz: null } }), []);
  assert.deepEqual(r, { status: 'miss1', missing: [{ type: 'triple-sec', reason: 'absent' }] });
});

test('spento → reason off', () => {
  const off = ['tequila'];
  const r = evaluate(idx, margarita, avail({ tequila: { oz: 10 }, 'triple-sec': { oz: 5 }, 'succo-lime': { oz: null } }, off), off);
  assert.deepEqual(r.missing, [{ type: 'tequila', reason: 'off' }]);
});

test('poco: 0.4 oz di tequila → low; 0.6 oz → ok', () => {
  const items = (oz) => ({ tequila: { oz }, 'triple-sec': { oz: 5 }, 'succo-lime': { oz: null } });
  assert.deepEqual(evaluate(idx, margarita, avail(items(0.4)), []).missing, [{ type: 'tequila', reason: 'low' }]);
  assert.equal(evaluate(idx, margarita, avail(items(0.6)), []).status, 'ok');
});

test('misura null non blocca per quantità', () => {
  const d = drink('Tonic', [['Tonic water', null]]);
  assert.equal(evaluate(idx, d, avail({ tonica: { oz: 0.1 } }), []).status, 'ok');
});

test('due mancanti → missN', () => {
  assert.equal(evaluate(idx, margarita, avail({ 'succo-lime': { oz: null } }), []).status, 'missN');
});

test('stesso tipo due volte conta una volta', () => {
  const d = drink('Double', [['Tequila', 1], ['Tequila', 1]]);
  assert.equal(evaluate(idx, d, avail({}), []).missing.length, 1);
});

test('sortForGrid: ok, poi miss1, nome A–Z', () => {
  const rs = [
    { drink: { name: 'B' }, status: 'miss1' }, { drink: { name: 'Z' }, status: 'ok' },
    { drink: { name: 'A' }, status: 'ok' }, { drink: { name: 'C' }, status: 'missN' },
  ];
  assert.deepEqual(sortForGrid(rs).map((r) => r.drink.name), ['A', 'Z', 'B', 'C']);
});

test('nessuna combinazione fattibile anche se ogni minimo singolo basta → low', () => {
  const gt = drink('Gin Tonic', [['Gin', 2], ['Tonic water', 5]]);
  const r = evaluate(idx, gt, avail({ gin: { oz: 0.9 }, tonica: { oz: 2.6 } }), []);
  assert.equal(r.status, 'miss1');
  assert.deepEqual(r.missing, [{ type: 'tonica', reason: 'low' }]);
});

test('spiritGroups: base alcolica per i filtri dell\'uscita', async () => {
  const { spiritGroups, SPIRIT_GROUPS } = await import('../js/match.js');
  assert.deepEqual(SPIRIT_GROUPS.map(([id]) => id), ['gin', 'rum', 'tequila', 'vodka', 'whisky', 'brandy', 'altro']);
  assert.deepEqual(spiritGroups(idx, margarita), ['tequila']);
  assert.deepEqual(spiritGroups(idx, drink('Daiquiri', [['Light rum', 2], ['Lime juice', 1]])), ['rum']);
  assert.deepEqual(spiritGroups(idx, drink('Manhattan', [['Bourbon', 2], ['Sweet Vermouth', 1]])), ['whisky']);
  assert.deepEqual(spiritGroups(idx, drink('Sidecar', [['Cognac', 2], ['Triple sec', 1]])), ['brandy']);
  assert.deepEqual(spiritGroups(idx, drink('Long Island', [['Gin', 1], ['Vodka', 1], ['Tequila', 1]])), ['gin', 'tequila', 'vodka']);
  assert.deepEqual(spiritGroups(idx, drink('Spritz', [['Aperol', 2], ['Prosecco', 3]])), ['altro']);
  assert.deepEqual(spiritGroups(idx, drink('Caipirinha', [['Cachaca', 2]])), ['altro']);
});
