import { typeName } from './types.js';

// fields: { id?, source?, url?, name, alcoholic, instructions, ingredients: [{ type, oz, text }] }
export function newRecipe(idx, fields, now = Date.now()) {
  return {
    id: fields.id ?? `my:${now}`,
    name: fields.name.trim(),
    thumb: null,
    alcoholic: fields.alcoholic,
    instructions: fields.instructions.trim(),
    ingredients: fields.ingredients.map(({ type, oz, text }) => ({ raw: typeName(idx, type), type, oz, text: text.trim() })),
    source: fields.source ?? 'manual',
    ...(fields.url && { url: fields.url }),
  };
}
