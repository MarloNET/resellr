import { z } from 'zod';

import { FIELD_MESSAGES, MESSAGES } from '../messages/messages.de.ts';
import { idSchema, impactSchema, listResponseSchema, versionSchema } from './common.schema.ts';

// Manufacturer with its GPSR details (REQ-027, REQ-100, REQ-101; Technical Specification 2.2,
// 3.1).

/** Fields of the GPSR details in the order of UI-031; `euRp…` is the responsible person in the EU. */
export const GPSR_FIELDS = [
  'legalName',
  'street',
  'postalCode',
  'city',
  'country',
  'contact',
  'euRpName',
  'euRpAddress',
  'euRpContact',
] as const;
export type GpsrField = (typeof GPSR_FIELDS)[number];

/**
 * Parts that make the details complete (2.2 `gpsrComplete`): legal name, street and house
 * number, postal code, city, country and contact. The responsible person in the EU is optional.
 */
export const GPSR_REQUIRED_FIELDS = [
  'legalName',
  'street',
  'postalCode',
  'city',
  'country',
  'contact',
] as const satisfies readonly GpsrField[];
export type GpsrRequiredField = (typeof GPSR_REQUIRED_FIELDS)[number];

/** Labels of the fields in UI-031, also the parts of "<Teil> fehlt" and of the audit entry. */
export const GPSR_LABELS: Record<GpsrField, string> = {
  legalName: 'Herstellername',
  street: 'Straße und Hausnummer',
  postalCode: 'Postleitzahl',
  city: 'Ort',
  country: 'Land',
  contact: 'Elektronische Kontaktadresse',
  euRpName: 'Name der verantwortlichen Person',
  euRpAddress: 'Postanschrift der verantwortlichen Person',
  euRpContact: 'Kontaktadresse der verantwortlichen Person',
};

/** Technical upper bounds of the architect (3.1) with their texts M-05 to M-13 (8.2). */
const GPSR_LIMITS: Record<GpsrField, { max: number; message: string }> = {
  legalName: { max: 200, message: MESSAGES['M-05'] },
  street: { max: 200, message: MESSAGES['M-06'] },
  postalCode: { max: 20, message: MESSAGES['M-07'] },
  city: { max: 100, message: MESSAGES['M-08'] },
  country: { max: 100, message: MESSAGES['M-09'] },
  contact: { max: 254, message: MESSAGES['M-10'] },
  euRpName: { max: 200, message: MESSAGES['M-11'] },
  euRpAddress: { max: 500, message: MESSAGES['M-12'] },
  euRpContact: { max: 254, message: MESSAGES['M-13'] },
};

const gpsrTextSchema = (field: GpsrField) =>
  z.string().trim().max(GPSR_LIMITS[field].max, GPSR_LIMITS[field].message);

const emailSchema = z.email();
const webAddressSchema = z.httpUrl();

/** An e-mail address or an address with `http://` or `https://` (2.2). */
const isContact = (value: string) =>
  emailSchema.safeParse(value).success || webAddressSchema.safeParse(value).success;

/**
 * GPSR details as entered: each field 0 to its bound after removing the spaces at the edges,
 * `''` = not given. A given contact must be an e-mail or web address (DER-41-02); a too long
 * contact only gets M-10 (meldungskatalog M-10).
 */
export const gpsrSchema = z.strictObject({
  legalName: gpsrTextSchema('legalName'),
  street: gpsrTextSchema('street'),
  postalCode: gpsrTextSchema('postalCode'),
  city: gpsrTextSchema('city'),
  country: gpsrTextSchema('country'),
  contact: gpsrTextSchema('contact').refine(
    (value) => value === '' || value.length > GPSR_LIMITS.contact.max || isContact(value),
    FIELD_MESSAGES.gpsrContact,
  ),
  euRpName: gpsrTextSchema('euRpName'),
  euRpAddress: gpsrTextSchema('euRpAddress'),
  euRpContact: gpsrTextSchema('euRpContact'),
});
export type Gpsr = z.infer<typeof gpsrSchema>;

/** A manufacturer without GPSR details, as created (UI-008). */
export const EMPTY_GPSR: Gpsr = {
  legalName: '',
  street: '',
  postalCode: '',
  city: '',
  country: '',
  contact: '',
  euRpName: '',
  euRpAddress: '',
  euRpContact: '',
};

/** `gpsrMissing[]`: the required parts without a value, in the order of UI-031 (2.2). */
export function gpsrMissingOf(gpsr: Gpsr): GpsrRequiredField[] {
  return GPSR_REQUIRED_FIELDS.filter((field) => gpsr[field] === '');
}

/** Longest name of a manufacturer after trimming (3.1). */
export const MANUFACTURER_NAME_MAX = 50;

/**
 * Name of a manufacturer: 1–50 characters after removing the spaces at the edges; one text for
 * empty and too long (UI-008 "Name: 1 bis 50 Zeichen", AC-REQ-100-03). Uniqueness over
 * `name_key` is a rule of the service (2.2).
 */
export const manufacturerNameSchema = z
  .string()
  .trim()
  .min(1, FIELD_MESSAGES.manufacturerName)
  .max(MANUFACTURER_NAME_MAX, FIELD_MESSAGES.manufacturerName);

/** `POST /api/manufacturers`: a new manufacturer is always active (AC-REQ-100-01). */
export const manufacturerCreateSchema = z.strictObject({
  name: manufacturerNameSchema,
});
export type ManufacturerCreate = z.infer<typeof manufacturerCreateSchema>;

/** `PATCH /api/manufacturers/{id}`: the version last read and the changed fields (2.0.3). */
export const manufacturerUpdateSchema = z.strictObject({
  version: versionSchema,
  name: manufacturerNameSchema.optional(),
  active: z.boolean().optional(),
  /** All nine fields; saving is allowed while incomplete (AC-REQ-027-02). */
  gpsr: gpsrSchema.optional(),
});
export type ManufacturerUpdate = z.infer<typeof manufacturerUpdateSchema>;

/**
 * Manufacturer in the answers (2.2); `gpsrComplete` gives the chip of UI-031 (DER-37-08),
 * `gpsrMissing[]` the parts named "<Teil> fehlt" (DER-41-03).
 */
export const manufacturerSchema = z.object({
  id: idSchema,
  name: z.string(),
  active: z.boolean(),
  gpsrComplete: z.boolean(),
  gpsrMissing: z.array(z.enum(GPSR_REQUIRED_FIELDS)),
  /** As stored, `''` for a field without a value. */
  gpsr: z.object({
    legalName: z.string(),
    street: z.string(),
    postalCode: z.string(),
    city: z.string(),
    country: z.string(),
    contact: z.string(),
    euRpName: z.string(),
    euRpAddress: z.string(),
    euRpContact: z.string(),
  }),
  version: versionSchema,
});
export type Manufacturer = z.infer<typeof manufacturerSchema>;

/** `GET /api/manufacturers`. */
export const manufacturerListSchema = listResponseSchema(manufacturerSchema);
export type ManufacturerList = z.infer<typeof manufacturerListSchema>;

/**
 * Answer of `POST /api/manufacturers`: `201` with `existing: false` for a new manufacturer,
 * `200` with `existing: true` and the active manufacturer that already has the name
 * (AC-REQ-100-02).
 */
export const manufacturerCreateResultSchema = manufacturerSchema.extend({
  existing: z.boolean(),
});
export type ManufacturerCreateResult = z.infer<typeof manufacturerCreateResultSchema>;

/** Answer of `PATCH /api/manufacturers/{id}`: `{ manufacturer, impact }` (2.2). */
export const manufacturerUpdateResultSchema = z.object({
  manufacturer: manufacturerSchema,
  impact: impactSchema,
});
export type ManufacturerUpdateResult = z.infer<typeof manufacturerUpdateResultSchema>;
