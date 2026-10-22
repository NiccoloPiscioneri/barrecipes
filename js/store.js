// localStorage wrapper; falls back to memory when storage is missing, blocked or full.
const memory = new Map();

export const store = {
  ok: true,
  get(key, fallback) {
    if (memory.has(key)) return memory.get(key);
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    memory.set(key, value);
    try {
      if (!globalThis.localStorage) throw new Error('no localStorage');
      globalThis.localStorage.setItem(key, JSON.stringify(value));
      memory.delete(key);
      return true;
    } catch {
      store.ok = false;
      return false;
    }
  },
};
