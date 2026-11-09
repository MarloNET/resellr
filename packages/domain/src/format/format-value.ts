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
 * Number with decimal comma and without thousands separators ("13,3", "1234"). Takes a number
 * or the canonical decimal string of an attribute value.
 */
export function formatNumber(value: number | string): string {
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
  const [, year, month, day] = match ?? [];
  if (!match || Number(month) < 1 || Number(month) > 12) {
    throw new RangeError(`Not a calendar date: ${date}`);
  }
  return `${day}.${month}.${year}`;
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
