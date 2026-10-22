const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Escape any external text before it goes into innerHTML.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// Only https links may reach an href (blocks javascript: from imported files or Gemini).
export const safeUrl = (u) => (/^https:\/\//i.test(String(u ?? '').trim()) ? String(u).trim() : null);
