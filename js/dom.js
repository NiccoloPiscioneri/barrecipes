const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Escape any external text before it goes into innerHTML.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
