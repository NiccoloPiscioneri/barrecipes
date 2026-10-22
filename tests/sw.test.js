import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

test('il service worker mette in cache ogni modulo JS', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const files = [
    ...readdirSync(new URL('../js', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`),
    ...readdirSync(new URL('../js/ui', import.meta.url)).map((f) => `js/ui/${f}`),
  ];
  for (const f of files) assert.ok(sw.includes(`'${f}'`), `${f} manca in sw.js`);
});
