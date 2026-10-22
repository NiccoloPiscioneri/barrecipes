import test from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../js/store.js';

test('usa localStorage quando disponibile', () => {
  const data = {};
  globalThis.localStorage = { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
  assert.equal(store.set('br.x', { a: 1 }), true);
  assert.equal(data['br.x'], '{"a":1}');
  assert.deepEqual(store.get('br.x', null), { a: 1 });
  assert.equal(store.get('br.none', 'fb'), 'fb');
});

test('store in memoria se localStorage lancia', () => {
  globalThis.localStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
  assert.equal(store.set('br.y', [1]), false);
  assert.equal(store.ok, false);
  assert.deepEqual(store.get('br.y', null), [1]);
  assert.equal(store.get('br.z', 'fb'), 'fb');
  delete globalThis.localStorage;
});

test('JSON corrotto → fallback', () => {
  globalThis.localStorage = { getItem: () => '{bad', setItem() {} };
  assert.equal(store.get('br.bad', 'fb'), 'fb');
  delete globalThis.localStorage;
});
