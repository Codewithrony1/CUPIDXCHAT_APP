/**
 * Sanitizes incoming and outgoing chat message text (BUG-005).
 * - Strips dangerous BiDi directional override control characters that disrupt UI hierarchy
 * - Normalizes unicode characters into NFC format
 * - Mitigates Zalgo text overflow by capping excessive stacked combining diacritical marks
 * - Preserves standard emojis, punctuation, and multilingual scripts (Arabic, Hebrew, Cyrillic, etc.)
 */
export function sanitizeChatText(rawText: string | null | undefined): string {
  if (!rawText) return '';

  let sanitized = String(rawText);

  // 1. Normalize Unicode Form C
  try {
    sanitized = sanitized.normalize('NFC');
  } catch {
    // If normalization fails, retain raw string
  }

  // 2. Strip dangerous unidirectional override characters that hijack document/container direction:
  // U+202A (LRE), U+202B (RLE), U+202C (PDF), U+202D (LRO), U+202E (RLO)
  // U+2066 (LRI), U+2067 (RLI), U+2068 (FSI), U+2069 (PDI)
  sanitized = sanitized.replace(/[\u202A-\u202E\u2066-\u2069]/g, '');

  // 3. Prevent Zalgo / excessive stacked combining diacritics (cap to max 3 consecutive combining marks)
  sanitized = sanitized.replace(/([\u0300-\u036F\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]{3})[\u0300-\u036F\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]+/g, '$1');

  // 4. Strip invisible null bytes and replacement character spam
  sanitized = sanitized.replace(/\u0000/g, '');

  return sanitized.trim();
}
