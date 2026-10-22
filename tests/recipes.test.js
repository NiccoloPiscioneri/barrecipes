import test from 'node:test';
import assert from 'node:assert/strict';
import { newRecipe } from '../js/recipes.js';
import { isYoutubeUrl, youtubeParts, validateExtracted } from '../js/gemini.js';
import { types } from './helpers.js';

test('isYoutubeUrl', () => {
  for (const u of ['https://www.youtube.com/watch?v=abc123', 'https://youtu.be/abc123', 'https://youtube.com/shorts/abc123',
    'https://m.youtube.com/watch?v=abc123&t=10']) assert.equal(isYoutubeUrl(u), true, u);
  for (const u of ['https://vimeo.com/1', 'ciao', 'https://youtube.com/channel/x', '', 'javascript:alert(1)']) assert.equal(isYoutubeUrl(u), false, u);
});

test('youtubeParts: video + prompt con i tipi', () => {
  const p = youtubeParts('https://youtu.be/abc', ['Gin', 'Rum bianco']);
  assert.deepEqual(p[0], { fileData: { fileUri: 'https://youtu.be/abc' } });
  assert.match(p[1].text, /Rum bianco/);
});

test('validateExtracted: più drink, tipi risolti, scarta vuoti', () => {
  const idx = types();
  const out = validateExtracted({ drinks: [
    { name: 'Spritz casa', alcoholic: true, instructions: 'Mescola', ingredients: [
      { name: 'Bitter arancio (tipo Aperol)', oz: 2 }, { name: 'Prosecco', oz: 3 }, { name: 'Soda', text: 'top' }] },
    { name: 'Vuoto', ingredients: [] },
    { ingredients: [{ name: 'Gin', oz: 1 }] },
    { name: 'Limonata', alcoholic: false, ingredients: [{ name: 'Succo di limone', oz: 'boh' }] },
  ] }, idx, 'https://youtu.be/abc', 1000);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0].ingredients.map((i) => i.type), ['bitter-arancio', 'spumante', 'soda']);
  assert.equal(out[0].ingredients[2].oz, null);
  assert.equal(out[0].ingredients[2].text, 'top');
  assert.equal(out[0].id, 'my:1000-0');
  assert.equal(out[0].source, 'youtube');
  assert.equal(out[0].url, 'https://youtu.be/abc');
  assert.equal(out[0].alcoholic, 'yes');
  assert.equal(out[1].alcoholic, 'no');
  assert.equal(out[1].ingredients[0].oz, null);
  assert.deepEqual(validateExtracted(null, idx, 'u', 1), []);
});

test('newRecipe genera id my: e source manual', () => {
  const idx = types();
  const d = newRecipe(idx, { name: ' Mio ', alcoholic: 'yes', instructions: 'x',
    ingredients: [{ type: 'gin', oz: 1.5, text: '' }, { type: 'lime', oz: null, text: '1 spicchio' }] }, 42);
  assert.equal(d.id, 'my:42');
  assert.equal(d.name, 'Mio');
  assert.equal(d.source, 'manual');
  assert.equal(d.thumb, null);
  assert.deepEqual(d.ingredients[0], { raw: 'Gin', type: 'gin', oz: 1.5, text: '' });
  assert.equal(d.ingredients[1].text, '1 spicchio');
});

test('newRecipe in modifica mantiene id, source e url', () => {
  const d = newRecipe(types(), { id: 'my:7-0', source: 'youtube', url: 'https://youtu.be/a', name: 'X', alcoholic: 'no',
    instructions: '', ingredients: [{ type: 'soda', oz: 4, text: '' }] }, 99);
  assert.equal(d.id, 'my:7-0');
  assert.equal(d.source, 'youtube');
  assert.equal(d.url, 'https://youtu.be/a');
});
