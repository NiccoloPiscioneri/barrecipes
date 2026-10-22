import test from 'node:test';
import assert from 'node:assert/strict';
import { esc } from '../js/dom.js';

test('esc', () => assert.equal(esc('<a href="x">&\''), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;'));
test('esc null e numeri', () => { assert.equal(esc(null), ''); assert.equal(esc(3), '3'); });
