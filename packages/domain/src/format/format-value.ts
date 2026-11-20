// German output formats (REQ-078; Technical Specification 2.0.1, 2.8.2).

const CALENDAR_DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

const BERLIN_DATE_TIME = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Cent amount as "1.234,56 €". */
export function formatMoney(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Not a whole cent amount: ${cents}`);
  }
  const absolute = Math.abs(cents);
  const euros = Math.floor(absolute / 100)
    .toString()
    .replace(/\B(?=([0-9]{3})+$)/g, '.');
  const rest = (absolute % 100).toString().padStart(2, '0');
  return `${cents < 0 ? '-' : ''}${euros},${rest} €`;
}

/**
 * Cent amount as the value of a money input ("1234,56"): with decimal comma and two decimal
 * places, without thousands separators and currency, so `parseDecimal` reads it back (2.7, UI-014
 * "Preis je Kanal").
 */
export function formatMoneyInput(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new RangeError(`Not a whole cent amount: ${cents}`);
  }
  const absolute = Math.abs(cents);
  const rest = (absolute % 100).toString().padStart(2, '0');
  return `${cents < 0 ? '-' : ''}${Math.floor(absolute / 100)},${rest}`;
}

/**
 * Number with decimal comma and without thousands separators ("13,3", "1234"). Takes a whole
 * number or the canonical decimal string of an attribute value; a fractional number has no
 * defined rounding and is rejected, as are numbers that would print in exponent notation.
 */
export function formatNumber(value: number | string): string {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new RangeError(`Not a whole number: ${value}`);
  }
  return String(value).replace('.', ',');
}

/** Formatted value with unit, with or without a space after `unitSpacing` ("16GB", "13,3 Zoll"). */
export function formatWithUnit(value: string, unit: string, unitSpacing: boolean): string {
  if (!unit) {
    return value;
  }
  return unitSpacing ? `${value} ${unit}` : `${value}${unit}`;
}

export function formatYesNo(value: boolean): string {
  return value ? 'Ja' : 'Nein';
}

/** Calendar date `YYYY-MM-DD` as `TT.MM.JJJJ`. */
export function formatDate(date: string): string {
  const match = CALENDAR_DATE.exec(date);
  const [, year = '', month = '', day = ''] = match ?? [];
  if (!match || !isExistingDate(Number(year), Number(month), Number(day))) {
    throw new RangeError(`Not a calendar date: ${date}`);
  }
  return `${day}.${month}.${year}`;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isExistingDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) {
    return false;
  }
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = month === 2 && isLeapYear ? 29 : (DAYS_IN_MONTH[month - 1] ?? 0);
  return day >= 1 && day <= daysInMonth;
}

/** UTC timestamp as `TT.MM.JJJJ HH:MM` in Europe/Berlin. */
export function formatDateTime(timestamp: string): string {
  const instant = new Date(timestamp);
  if (Number.isNaN(instant.getTime())) {
    throw new RangeError(`Not a timestamp: ${timestamp}`);
  }
  const parts = Object.fromEntries(
    BERLIN_DATE_TIME.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  return `${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}
