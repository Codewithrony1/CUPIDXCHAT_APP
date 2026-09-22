/**
 * Server-side message sanitization utilities (MSG-001).
 *
 * Zero-dependency HTML entity escaping suitable for server-side Next.js routes.
 * DOMPurify is a browser-only library and must NOT be used here.
 *
 * Responsibilities:
 *  1. Escape HTML special characters to prevent stored XSS when messages are
 *     rendered in a browser without additional escaping.
 *  2. Enforce a 2000-character hard cap (matching socket/server.js enforcement).
 *  3. Strip null bytes and other dangerous control characters.
 */

/** Maximum allowed message length in characters (must match socket/server.js). */
export const MAX_MESSAGE_LENGTH = 2000;

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escapes HTML special characters in a string to prevent stored XSS.
 * Does NOT strip the characters — they are preserved as HTML entities so the
 * original text is still readable when decoded.
 */
export function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"'`=/]/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

/**
 * Strips dangerous control characters from a string:
 * - Null bytes (U+0000)
 * - ASCII control characters (U+0001–U+001F) except tab (U+0009), LF (U+000A), CR (U+000D)
 * - U+007F (DEL)
 */
function stripControlChars(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

export interface SanitizeResult {
  /** The sanitized, safe-to-store string. */
  safe: string;
  /** True if the input exceeded MAX_MESSAGE_LENGTH and was NOT truncated (caller must reject). */
  tooLong: boolean;
  /** True if HTML characters were escaped. */
  escaped: boolean;
}

/**
 * Sanitizes a chat message for server-side storage.
 *
 * Usage in API route:
 * ```ts
 * const { safe, tooLong } = sanitizeMessage(body.content);
 * if (tooLong) return NextResponse.json({ error: 'Message too long (max 2000 characters).' }, { status: 400 });
 * // Use `safe` for DB writes
 * ```
 */
export function sanitizeMessage(raw: unknown): SanitizeResult {
  if (typeof raw !== 'string') {
    return { safe: '', tooLong: false, escaped: false };
  }

  // Trim leading/trailing whitespace first
  const trimmed = raw.trim();

  // Length check BEFORE escaping (escape can increase byte count)
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { safe: '', tooLong: true, escaped: false };
  }

  // Strip dangerous control characters
  const stripped = stripControlChars(trimmed);

  // HTML-escape special characters
  const escaped = escapeHtml(stripped);
  const wasEscaped = escaped !== stripped;

  return { safe: escaped, tooLong: false, escaped: wasEscaped };
}
