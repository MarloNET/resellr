/**
 * Canonical form (CU-152; Technical Specification 2.8.1, 2.8.2, Nachtrag MAR-1053): JSON with the
 * keys of every object sorted, lists in their order, without whitespace, so equal data give equal
 * text whatever the order of their keys.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * SHA-256 of a text in lower case hex (CU-152, Nachtrag MAR-1053), the only implementation. Uses
 * the global Web Crypto API, which Node.js and the browser both provide, so `packages/domain`
 * imports no module with input or output (4.1). The hash of the output part of `ContentState`
 * follows in S5.
 */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
