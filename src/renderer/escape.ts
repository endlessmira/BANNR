const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);

/** Escapes text and turns line breaks into <br>. */
export const escapeText = (s: string): string => escapeHtml(s).replace(/\r?\n/g, '<br>');

/** A JS string literal that's safe to put inside an inline <script>. Adapters will use this for {{LANDING_URL}}. */
export const jsString = (s: string): string =>
  JSON.stringify(s)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
