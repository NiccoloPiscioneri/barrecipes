import { satisfiers } from './types.js';

export const BASICS = ['ghiaccio', 'acqua', 'zucchero', 'sale'];

// Map<typeId, oz|null> of what can be used right now.
export function availableSet(idx, pantry, off, basics) {
  const avail = new Map();
  if (basics) for (const b of BASICS) avail.set(b, null);
  for (const [id, { oz }] of Object.entries(pantry.items)) if (!off.includes(id)) avail.set(id, oz);
  return avail;
}

// Untracked items (oz null) never run out, so they win; otherwise the fullest bottle.
export function pickSource(idx, avail, typeId) {
  let best = null;
  for (const id of satisfiers(idx, typeId)) {
    if (!avail.has(id)) continue;
    const oz = avail.get(id);
    if (oz === null) return id;
    if (best === null || oz > avail.get(best)) best = id;
  }
  return best;
}

export function consume(pantry, usage) {
  const items = structuredClone(pantry.items);
  for (const { typeId, oz } of usage) {
    const item = items[typeId];
    if (!item || item.oz === null || oz == null) continue;
    item.oz -= oz;
    if (item.oz <= 1e-9) delete items[typeId];
  }
  return { ...pantry, items };
}
