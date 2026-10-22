import test from 'node:test';
import assert from 'node:assert/strict';
import { esc } from '../js/dom.js';

test('esc', () => assert.equal(esc('<a href="x">&\''), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;'));
test('esc null e numeri', () => { assert.equal(esc(null), ''); assert.equal(esc(3), '3'); });

test('safeUrl accetta solo https', async () => {
  const { safeUrl } = await import('../js/dom.js');
  assert.equal(safeUrl('https://youtu.be/a'), 'https://youtu.be/a');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl(' JavaScript:alert(1)'), null);
  assert.equal(safeUrl('http://x.com'), null);
  assert.equal(safeUrl(undefined), null);
});
