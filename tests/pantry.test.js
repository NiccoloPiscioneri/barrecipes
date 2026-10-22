import test from 'node:test';
import assert from 'node:assert/strict';
import { availableSet, pickSource, consume } from '../js/pantry.js';
import { types } from './helpers.js';

const idx = types();
const pantry = { items: { gin: { oz: 10 }, 'rum-bianco': { oz: 2 }, 'rum-scuro': { oz: 5 }, lime: { oz: null } } };

test('availableSet esclude spenti, aggiunge base', () => {
  const a = availableSet(idx, pantry, ['gin'], true);
  assert.equal(a.has('gin'), false);
  assert.equal(a.get('rum-scuro'), 5);
  assert.equal(a.get('ghiaccio'), null);
  assert.equal(a.has('sale'), true);
  assert.equal(availableSet(idx, pantry, [], false).has('ghiaccio'), false);
});

test('pickSource preferisce non tracciato, poi più oz', () => {
  const a = availableSet(idx, pantry, [], true);
  assert.equal(pickSource(idx, a, 'rum'), 'rum-scuro');
  assert.equal(pickSource(idx, a, 'lime'), 'lime');
  assert.equal(pickSource(idx, a, 'vodka'), null);
  const b = availableSet(idx, { items: { rum: { oz: null }, 'rum-scuro': { oz: 5 } } }, [], false);
  assert.equal(pickSource(idx, b, 'rum'), 'rum');
});

test('consume scala e rimuove a zero', () => {
  const p = consume({ items: { tequila: { oz: 1.5 }, lime: { oz: null }, gin: { oz: 3 } } },
    [{ typeId: 'tequila', oz: 1.5 }, { typeId: 'lime', oz: 1 }, { typeId: 'gin', oz: 1 }]);
  assert.equal(p.items.tequila, undefined);
  assert.deepEqual(p.items.lime, { oz: null });
  assert.deepEqual(p.items.gin, { oz: 2 });
});

test('consume non va mai negativo e non muta l\'input', () => {
  const orig = { items: { gin: { oz: 1 } } };
  const p = consume(orig, [{ typeId: 'gin', oz: 2 }]);
  assert.equal(p.items.gin, undefined);
  assert.deepEqual(orig, { items: { gin: { oz: 1 } } });
});
