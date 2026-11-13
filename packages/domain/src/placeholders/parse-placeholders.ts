import {
  isPlaceholderAllowed,
  lookUpPlaceholder,
  type PlaceholderUsage,
} from './placeholder-catalog.ts';

// Placeholder parser (CU-069; Requirements chapter 9.7, Technical Specification 2.0.6).

/** A placeholder in a text: `{Name}` as written and the name inside the braces. */
export interface FoundPlaceholder {
  text: string;
  name: string;
}

/** `{…}` without a brace inside; a single `{` or `}` is plain text. */
const PLACEHOLDER_PATTERN = /\{([^{}]*)\}/gu;

/** All placeholders of a text in the order they appear. */
export function findPlaceholders(text: string): FoundPlaceholder[] {
  return [...text.matchAll(PLACEHOLDER_PATTERN)].map(([match, name = '']) => ({
    text: match,
    name,
  }));
}

/**
 * The first placeholder a usage rejects, in the order of the text: `unknown` if the catalog
 * does not have it, `not_allowed` if the usage does not take it (Requirements chapter 9.7
 * "ein unzulässiger oder unbekannter Platzhalter wird beim Speichern mit Nennung abgelehnt").
 * `null` if the text has no rejected placeholder.
 */
export function findRejectedPlaceholder(
  text: string,
  usage: PlaceholderUsage,
  attributeLabelKeys: ReadonlySet<string>,
): { reason: 'unknown' | 'not_allowed'; placeholder: string } | null {
  for (const found of findPlaceholders(text)) {
    const entry = lookUpPlaceholder(found.name, attributeLabelKeys);
    if (entry === undefined) return { reason: 'unknown', placeholder: found.text };
    if (!isPlaceholderAllowed(usage, entry)) {
      return { reason: 'not_allowed', placeholder: found.text };
    }
  }
  return null;
}
