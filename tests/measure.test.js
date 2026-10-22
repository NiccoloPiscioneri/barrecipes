import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMeasure, formatAmount } from '../js/measure.js';

test('oz con frazioni', () => assert.equal(parseMeasure('1 1/2 oz ').oz, 1.5));
test('oz decimale e frazione semplice', () => {
  assert.equal(parseMeasure('0.5 oz').oz, 0.5);
  assert.equal(parseMeasure('3/4 oz').oz, 0.75);
});
test('cl e ml', () => {
  assert.equal(parseMeasure('3 cl').oz, 1);
  assert.equal(parseMeasure('60 ml').oz, 2);
});
test('shot, tsp, tblsp, dash, splash, cup', () => {
  assert.equal(parseMeasure('1 shot').oz, 1.5);
  assert.equal(parseMeasure('1 tsp').oz, 1 / 6);
  assert.equal(parseMeasure('1 tblsp').oz, 0.5);
  assert.equal(parseMeasure('2 dashes').oz, 2 / 32);
  assert.equal(parseMeasure('1 splash').oz, 0.25);
  assert.equal(parseMeasure('1 cup').oz, 8);
});
test('range prende il primo valore', () => assert.equal(parseMeasure('1-2 oz').oz, 1));
test('non interpretabili → null, text conservato', () => {
  for (const s of ['Top', 'Fill with', 'Juice of 1', '2 parts', '', null]) assert.equal(parseMeasure(s).oz, null);
  assert.equal(parseMeasure('Juice of 1').text, 'Juice of 1');
  assert.equal(parseMeasure(' 1 1/2 oz ').text, '1 1/2 oz');
});
test('format oz con frazioni unicode', () => {
  assert.equal(formatAmount(1.5, 'oz'), '1 ½ oz');
  assert.equal(formatAmount(0.75, 'oz'), '¾ oz');
  assert.equal(formatAmount(0.3, 'oz'), '¼ oz');
  assert.equal(formatAmount(2, 'oz'), '2 oz');
  assert.equal(formatAmount(0.05, 'oz'), '¼ oz');
});
test('format ml e cl arrotondati', () => {
  assert.equal(formatAmount(1.5, 'ml'), '45 ml');
  assert.equal(formatAmount(0.6, 'ml'), '20 ml');
  assert.equal(formatAmount(1.5, 'cl'), '4,5 cl');
  assert.equal(formatAmount(1, 'cl'), '3 cl');
});
