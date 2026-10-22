// TypeIndex: { byId: {id: Type}, map: {lowercased raw name: id}, children: {id: id[]} }
export function loadTypes(json) {
  const byId = {}, children = {}, map = {};
  for (const t of json.types) {
    byId[t.id] = { ...t };
    if (t.parent) (children[t.parent] ??= []).push(t.id);
  }
  for (const [raw, id] of Object.entries(json.map)) map[raw.toLowerCase().trim()] = id;
  for (const t of json.types) map[t.name.toLowerCase()] ??= t.id; // Italian names typed by users or Gemini
  return { byId, map, children };
}

// Unknown names become their own 'x:' type so they can still go in the pantry.
export function resolveType(idx, raw) {
  const key = String(raw).toLowerCase().trim();
  if (idx.map[key]) return idx.map[key];
  const id = `x:${key}`;
  idx.byId[id] ??= { id, name: String(raw).trim(), cat: 'other' };
  return id;
}

export const typeName = (idx, id) => idx.byId[id]?.name ?? (id.startsWith('x:') ? id.slice(2) : id);

// A generic type is satisfied by itself or any descendant; a child only by itself.
export function satisfiers(idx, id) {
  const out = [id];
  for (const c of idx.children[id] ?? []) out.push(...satisfiers(idx, c));
  return out;
}

export function siblings(idx, id) {
  const parent = idx.byId[id]?.parent;
  return parent ? idx.children[parent].filter((c) => c !== id) : [];
}

export function attachTypes(idx, drinks) {
  return drinks.map((d) => ({
    ...d,
    ingredients: d.ingredients.map((i) => ({ ...i, type: i.type ?? resolveType(idx, i.raw) })),
  }));
}
