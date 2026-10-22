import { readFileSync } from 'node:fs';
import { loadTypes } from '../js/types.js';

export const types = () => loadTypes(JSON.parse(readFileSync(new URL('../data/types.json', import.meta.url))));
