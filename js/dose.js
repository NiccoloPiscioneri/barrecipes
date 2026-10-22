export const PORTIONS = [0.5, 1, 2, 3, 4];
export const STRENGTH = { leggero: 0.7, normale: 1, forte: 1.25 };

export const isAlcohol = (idx, typeId) => ['spirit', 'liqueur'].includes(idx.byId[typeId]?.cat);

// Smallest amount of this ingredient any allowed combo can need (½ portion, lightest strength).
export function minDose(idx, ing) {
  if (ing.oz == null) return null;
  return ing.oz * PORTIONS[0] * (isAlcohol(idx, ing.type) ? STRENGTH.leggero : 1);
}
