// Ounces per unit; units missing here (parts, top, fill...) are not volumes.
const UNITS = [
  [/^(oz|ounces?)\b/, 1],
  [/^cl\b/, 1 / 3],
  [/^ml\b/, 1 / 30],
  [/^(shots?|jiggers?)\b/, 1.5],
  [/^(tsp|teaspoons?)\b/, 1 / 6],
  [/^(tblsp|tbsp|tablespoons?)\b/, 0.5],
  [/^dash(es)?\b/, 1 / 32],
  [/^splash(es)?\b/, 0.25],
  [/^cups?\b/, 8],
];

const NUM = /^(\d+)\/(\d+)|^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?/;

export function parseMeasure(str) {
  const text = String(str ?? '').trim();
  const s = text.toLowerCase();
  const m = s.match(NUM);
  if (!m) return { oz: null, text };
  const n = m[1] ? m[1] / m[2] : Number(m[3]) + (m[4] ? m[4] / m[5] : 0);
  // "1-2 oz": keep the first value, skip the range tail
  const rest = s.slice(m[0].length).replace(/^\s*-\s*[\d./ ]+/, '').trim();
  const unit = UNITS.find(([re]) => re.test(rest));
  return { oz: unit ? n * unit[1] : null, text };
}

const FRAC = { 0: '', 0.25: '¼', 0.5: '½', 0.75: '¾' };

export function formatAmount(oz, unit) {
  if (unit === 'ml') return `${Math.round((oz * 30) / 5) * 5} ml`;
  if (unit === 'cl') return `${String(Math.round(oz * 3 * 2) / 2).replace('.', ',')} cl`;
  const q = Math.max(0.25, Math.round(oz * 4) / 4);
  const whole = Math.floor(q);
  const frac = FRAC[q - whole];
  return `${[whole || '', frac].filter(Boolean).join(' ')} oz`;
}
