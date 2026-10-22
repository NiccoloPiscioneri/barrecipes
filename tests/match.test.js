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
