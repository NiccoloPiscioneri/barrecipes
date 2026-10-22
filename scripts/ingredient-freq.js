// Prints "count\tname" for every ingredient in the live catalog, most used first.
import { fetchCatalog } from '../js/catalog.js';

const counts = new Map();
for (const d of await fetchCatalog()) for (const i of d.ingredients) counts.set(i.raw, (counts.get(i.raw) ?? 0) + 1);
for (const [name, n] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`${n}\t${name}`);
