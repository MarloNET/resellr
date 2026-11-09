const GTIN_8_OR_13 = /^(?:[0-9]{8}|[0-9]{13})$/;

/** Checks a GTIN-8 or GTIN-13 including its GS1 check digit (REQ-008, REQ-088). */
export function isValidEan(value: string): boolean {
  if (!GTIN_8_OR_13.test(value)) {
    return false;
  }
  const digits = Array.from(value, Number);
  const checkDigit = digits.pop();
  // GS1: from the right, the digits next to the check digit weigh 3, the others 1.
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === checkDigit;
}
