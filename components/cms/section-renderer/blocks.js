/**
 * blocks.js — Helpers shared by every section renderer.
 *
 * The CMS stores all human-readable strings as i18n maps
 *   { en: "...", hi: "...", de: "..." }
 * with `en` always present as the canonical fallback. These helpers
 * pick the right locale string without crashing when a translation
 * is missing.
 */

export function pickI18n(field, locale = 'en') {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') {
    return field[locale] || field.en || Object.values(field).find(Boolean) || '';
  }
  return '';
}

/** Find the first content_block of a given type inside a section. */
export function findBlock(section, type) {
  return (section?.blocks || []).find((b) => b.type === type) || null;
}

/** Get every block of a given type, sorted by orderIdx (already sorted by API). */
export function findBlocks(section, type) {
  return (section?.blocks || []).filter((b) => b.type === type);
}
