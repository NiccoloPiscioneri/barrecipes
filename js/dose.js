import { pickSource } from './pantry.js';
import { scaleText } from './measure.js';

export const PORTIONS = [0.5, 1, 2, 3, 4];
export const STRENGTH = { leggero: 0.7, normale: 1, forte: 1.25 };

export const isAlcohol = (idx, typeId) => ['spirit', 'liqueur'].includes(idx.byId[typeId]?.cat);

// Smallest amount of this ingredient any allowed combo can need (½ portion, lightest strength).
export function minDose(idx, ing) {
  if (ing.oz == null) return null;
  return ing.oz * PORTIONS[0] * (isAlcohol(idx, ing.type) ? STRENGTH.leggero : 1);
}

const cat = (idx, typeId) => idx.byId[typeId]?.cat;

function applySub(idx, ingredients, sub) {
  if (!sub) return ingredients.map((i) => ({ ...i }));
  return ingredients.map((i) => i.type === sub.from
    ? { ...i, raw: idx.byId[sub.to]?.name ?? sub.to, type: sub.to, oz: sub.oz ?? i.oz, text: sub.oz != null ? '' : i.text }
    : { ...i });
}

// Long drinks keep their volume by moving the alcohol difference into the lengthener;
// short drinks scale sweet and sour with the alcohol to keep the ratio, then top with soda.
export function computeDose(idx, drink, { portion, strength }, sub) {
  const lines = applySub(idx, drink.ingredients, sub);
  const orig = lines.map((l) => l.oz);
  const a = drink.alcoholic === 'no' ? 1 : STRENGTH[strength];
  const num = (l) => l.oz != null;
  const alcohol = lines.filter((l) => num(l) && isAlcohol(idx, l.type));
  const alcTot = alcohol.reduce((s, l) => s + l.oz, 0);
  const longers = lines.filter((l) => cat(idx, l.type) === 'mixer' || (cat(idx, l.type) === 'juice' && l.oz >= 2));

  if (a !== 1 && longers.length) {
    alcohol.forEach((l) => { l.oz *= a; });
    const numeric = longers.filter(num);
    const lengthener = numeric.length ? numeric.reduce((m, l) => (l.oz > m.oz ? l : m)) : null;
    if (lengthener && !longers.some((l) => !num(l) && cat(idx, l.type) === 'mixer')) {
      lengthener.oz = Math.max(0, lengthener.oz + (1 - a) * alcTot);
    }
  } else if (a !== 1) {
    const scaled = lines.filter((l) => num(l) && ['spirit', 'liqueur', 'sweet', 'sour'].includes(cat(idx, l.type)));
    const before = scaled.reduce((s, l) => s + l.oz, 0);
    scaled.forEach((l) => { l.oz *= a; });
    if (a < 1) lines.push({ raw: 'Soda', type: 'soda', oz: before - before * a, text: 'top di soda', added: true });
  }
  for (const l of lines) if (num(l)) l.oz *= portion;
  lines.forEach((l, n) => {
    if (l.added || !l.text) return;
    if (l.oz == null) l.text = scaleText(l.text, portion);
    else if (orig[n]) l.text = scaleText(l.text, l.oz / orig[n]);
  });
  return { lines };
}

export function usage(idx, lines, avail) {
  const totals = new Map();
  for (const l of lines) {
    if (l.oz == null) continue;
    const src = pickSource(idx, avail, l.type);
    if (src) totals.set(src, (totals.get(src) ?? 0) + l.oz);
  }
  return [...totals].map(([typeId, oz]) => ({ typeId, oz }));
}

export function feasible(idx, drink, avail, sub) {
  const strengths = drink.alcoholic === 'no' ? ['normale'] : Object.keys(STRENGTH);
  const out = [];
  for (const portion of PORTIONS) {
    for (const strength of strengths) {
      const { lines } = computeDose(idx, drink, { portion, strength }, sub);
      if (lines.some((l) => !l.added && !pickSource(idx, avail, l.type))) continue;
      const fits = usage(idx, lines, avail).every(({ typeId, oz }) => {
        const have = avail.get(typeId);
        return have === null || oz <= have + 1e-9;
      });
      if (fits) out.push({ portion, strength });
    }
  }
  return out;
}
