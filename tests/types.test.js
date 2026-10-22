import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTypes, resolveType, typeName, satisfiers, siblings, attachTypes } from '../js/types.js';

const json = JSON.parse(readFileSync(new URL('../data/types.json', import.meta.url)));
const idx = () => loadTypes(json);

test('marche → tipo', () => {
  const i = idx();
  assert.equal(resolveType(i, 'Bacardi'), 'rum-bianco');
  assert.equal(resolveType(i, 'Light rum'), 'rum-bianco');
  assert.equal(resolveType(i, 'Absolut Citron'), 'vodka');
  assert.equal(resolveType(i, 'Campari'), 'bitter-rosso');
  assert.equal(resolveType(i, 'Aperol'), 'bitter-arancio');
});

test('mappa case-insensitive', () => assert.equal(resolveType(idx(), 'LIME JUICE'), 'succo-lime'));

test('generico soddisfatto dai figli', () => {
  const s = satisfiers(idx(), 'rum');
  for (const t of ['rum', 'rum-bianco', 'rum-scuro']) assert.ok(s.includes(t), t);
});

test('fratelli non si soddisfano', () => assert.ok(!satisfiers(idx(), 'bitter-rosso').includes('bitter-arancio')));
test('siblings', () => {
  const s = siblings(idx(), 'bitter-rosso');
  assert.ok(s.includes('bitter-arancio'));
  assert.ok(!s.includes('bitter-rosso'));
});

test('sconosciuto → x:', () => {
  const i = idx();
  assert.equal(resolveType(i, 'Dragon Fruit '), 'x:dragon fruit');
  assert.equal(typeName(i, 'x:dragon fruit'), 'Dragon Fruit');
  assert.equal(i.byId['x:dragon fruit'].cat, 'other');
});

test('base esistono', () => {
  const i = idx();
  for (const b of ['ghiaccio', 'acqua', 'zucchero', 'sale']) assert.equal(i.byId[b].cat, 'base');
});

test('ogni map punta a un tipo esistente e ogni parent esiste', () => {
  const ids = new Set(json.types.map((t) => t.id));
  for (const [k, v] of Object.entries(json.map)) assert.ok(ids.has(v), `${k} → ${v}`);
  for (const t of json.types) if (t.parent) assert.ok(ids.has(t.parent), `${t.id}.parent`);
});

test('copertura: ogni ingrediente con frequenza ≥ 3 è mappato', () => {
  const i = idx();
  const freq = readFileSync(new URL('./fixtures/freq.txt', import.meta.url), 'utf8').trim().split('\n');
  const missing = freq.map((l) => l.split('\t')).filter(([n]) => Number(n) >= 3)
    .map(([, name]) => name).filter((name) => resolveType(i, name).startsWith('x:'));
  assert.deepEqual(missing, []);
});

test('attachTypes riempie type', () => {
  const [d] = attachTypes(idx(), [{ ingredients: [{ raw: 'Tequila', type: null }] }]);
  assert.equal(d.ingredients[0].type, 'tequila');
});

test('typeName di un x: non registrato usa il nome dopo il prefisso', () => assert.equal(typeName(idx(), 'x:frutto del drago'), 'frutto del drago'));

test('risolve anche i nomi italiani dei tipi', () => {
  assert.equal(resolveType(idx(), 'Rum bianco'), 'rum-bianco');
  assert.equal(resolveType(idx(), 'bitter arancio (tipo aperol)'), 'bitter-arancio');
});
