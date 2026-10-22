import { satisfiers } from './types.js';
import { pickSource } from './pantry.js';
import { minDose, feasible, computeDose, usage } from './dose.js';

export function evaluate(idx, drink, avail, off) {
  const missing = [];
  const seen = new Set();
  for (const ing of drink.ingredients) {
    if (seen.has(ing.type)) continue;
    seen.add(ing.type);
    const src = pickSource(idx, avail, ing.type);
    if (!src) {
      const isOff = satisfiers(idx, ing.type).some((id) => off.includes(id));
      missing.push({ type: ing.type, reason: isOff ? 'off' : 'absent' });
      continue;
    }
    const have = avail.get(src);
    const need = minDose(idx, ing);
    if (have !== null && need !== null && need > have + 1e-9) missing.push({ type: ing.type, reason: 'low' });
  }
  if (!missing.length && !feasible(idx, drink, avail).length) missing.push({ type: blockingType(idx, drink, avail), reason: 'low' });
  const status = missing.length === 0 ? 'ok' : missing.length === 1 ? 'miss1' : 'missN';
  return { status, missing };
}

const RANK = { ok: 0, miss1: 1, missN: 2 };

export const sortForGrid = (results) =>
  [...results].sort((a, b) => RANK[a.status] - RANK[b.status] || a.drink.name.localeCompare(b.drink.name));

// Every ingredient fits alone but no single combo fits: blame the first bottle that
// overflows at half portion, trying the lightest strength first.
function blockingType(idx, drink, avail) {
  for (const strength of ['leggero', 'normale', 'forte']) {
    const { lines } = computeDose(idx, drink, { portion: 0.5, strength });
    const over = usage(idx, lines, avail).find(({ typeId, oz }) => avail.get(typeId) !== null && oz > avail.get(typeId) + 1e-9);
    if (over) return drink.ingredients.find((i) => pickSource(idx, avail, i.type) === over.typeId)?.type ?? over.typeId;
  }
  return drink.ingredients[0].type;
}
