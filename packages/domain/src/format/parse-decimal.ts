// Digits with at most one separator; comma and point are both decimal separators (REQ-005).
const DECIMAL_INPUT = /^(-?)([0-9]+)(?:[.,]([0-9]+))?$/;

/**
 * Turns a decimal input into the canonical string with a point and without needless zeros
 * (`"14,01"` → `"14.01"`, `"13,30"` → `"13.3"`), or returns `null` for a format error.
 * An input with more than one separator such as `"1.234,56"` is a format error; there are
 * no thousands separators and no date recognition (Technical Specification 2.0.1, 2.0.5).
 * Range and decimal places are checked afterwards by the rule of the field.
 */
export function parseDecimal(input: string): string | null {
  const match = DECIMAL_INPUT.exec(input.trim());
  if (!match) {
    return null;
  }
  const [, sign, integerDigits = '', fractionDigits = ''] = match;
  const integerPart = integerDigits.replace(/^0+(?=[0-9])/, '');
  // A loop instead of `/0+$/`: that pattern is not anchored at the start and takes quadratic
  // time on long runs of zeros (FIND-247).
  let fractionEnd = fractionDigits.length;
  while (fractionEnd > 0 && fractionDigits[fractionEnd - 1] === '0') {
    fractionEnd -= 1;
  }
  const fractionPart = fractionDigits.slice(0, fractionEnd);
  const absolute = fractionPart ? `${integerPart}.${fractionPart}` : integerPart;
  return sign && absolute !== '0' ? `-${absolute}` : absolute;
}
