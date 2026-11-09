import { getRandomValues } from 'node:crypto';

/** Crockford Base32: digits and letters without I, L, O, U (Technical Specification 2.0.5, H-11). */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const REFERENCE_NUMBER_PATTERN = /^R-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

export type RandomBytes = (length: number) => Uint8Array;

const secureRandomBytes: RandomBytes = (length) => getRandomValues(new Uint8Array(length));

/** Creates a random reference number such as `R-7K2M-9QX4`. */
export function createReferenceNumber(randomBytes: RandomBytes = secureRandomBytes): string {
  // 256 is a multiple of 32, so taking the low five bits keeps every character equally likely.
  const chars = Array.from(randomBytes(8), (byte) => ALPHABET[byte & 31]).join('');
  return `R-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

export function isReferenceNumber(value: unknown): value is string {
  return typeof value === 'string' && REFERENCE_NUMBER_PATTERN.test(value);
}
