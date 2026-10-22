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

test('parseQty: unità, virgola, vuoto, invalido', async () => {
  const { parseQty } = await import('../js/measure.js');
  assert.equal(parseQty('1,5', 'oz'), 1.5);
  assert.equal(parseQty('750', 'ml'), 25);
  assert.equal(parseQty('70', 'cl'), 70 / 3);
  assert.equal(parseQty('  ', 'oz'), null);
  assert.equal(parseQty('0', 'oz'), 0);
  assert.equal(parseQty('-1', 'oz'), undefined);
  assert.equal(parseQty('tanto', 'oz'), undefined);
});

test('scaleText scala il primo numero del testo', async () => {
  const { scaleText } = await import('../js/measure.js');
  assert.equal(scaleText('2 dashes', 4), '8 dashes');
  assert.equal(scaleText('1 cube', 4), '4 cube');
  assert.equal(scaleText('Juice of 1', 2), 'Juice of 2');
  assert.equal(scaleText('1 1/2 oz', 0.5), '¾ oz');
  assert.equal(scaleText('1-2 oz', 2), '2 oz');
  assert.equal(scaleText('top', 3), 'top');
  assert.equal(scaleText(' 2 dashes ', 1), '2 dashes');
  assert.equal(scaleText('2 dashes', 0.1), '¼ dashes');
});

test('displayAmount: dosi piccole mostrano il testo scalato, zero non diventa ¼', async () => {
  const { displayAmount } = await import('../js/measure.js');
  assert.equal(displayAmount({ oz: 1 / 16, text: '2 dashes' }, 'ml'), '2 dashes');
  assert.equal(displayAmount({ oz: 1.5, text: '1 1/2 oz' }, 'ml'), '45 ml');
  assert.equal(displayAmount({ oz: null, text: '1 cube' }, 'oz'), '1 cube');
  assert.equal(displayAmount({ oz: null, text: '' }, 'oz'), '—');
  assert.equal(displayAmount({ oz: 0, text: '' }, 'oz'), '0 oz');
  assert.equal(displayAmount({ oz: 0.1, text: '' }, 'oz'), '¼ oz');
});
