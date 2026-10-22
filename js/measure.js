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

// Rounded to ¼ with unicode fractions, never below ¼.
function quarters(n) {
  const q = Math.max(0.25, Math.round(n * 4) / 4);
  const whole = Math.floor(q);
  return [whole || '', FRAC[q - whole]].filter(Boolean).join(' ');
}

export function formatAmount(oz, unit) {
  if (oz <= 0) return `0 ${unit}`;
  if (unit === 'ml') return `${Math.round((oz * 30) / 5) * 5} ml`;
  if (unit === 'cl') return `${String(Math.round(oz * 3 * 2) / 2).replace('.', ',')} cl`;
  return `${quarters(oz)} oz`;
}

const FIRST_NUM = /(\d+\/\d+|\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)(\s*-\s*[\d./]+)?/;

// "2 dashes" ×4 → "8 dashes", "Juice of 1" ×2 → "Juice of 2"; text without numbers is kept.
export function scaleText(text, factor) {
  const t = String(text ?? '').trim();
  const m = t.match(FIRST_NUM);
  if (!m || factor === 1) return t;
  const [a, b] = m[1].split(/\s+/);
  const value = a.includes('/') ? a.split('/')[0] / a.split('/')[1] : Number(a) + (b ? b.split('/')[0] / b.split('/')[1] : 0);
  return t.replace(m[0], quarters(value * factor));
}

// Doses under ¼ oz (dashes, teaspoons) read better in their original unit.
export function displayAmount(line, unit) {
  if (line.oz == null) return line.text || '—';
  if (line.oz > 0 && line.oz < 0.25 && line.text) return line.text;
  return formatAmount(line.oz, unit);
}

export const PER_OZ = { oz: 1, ml: 30, cl: 3 };

// User-typed quantity → oz. Empty = untracked (null), invalid = undefined.
export function parseQty(text, unit) {
  const s = String(text).trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n / PER_OZ[unit] : undefined;
}
