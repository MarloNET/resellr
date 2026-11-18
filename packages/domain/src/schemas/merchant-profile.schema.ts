import { z } from 'zod';

import { FIELD_MESSAGES } from '../messages/messages.de.ts';
import { versionSchema } from './common.schema.ts';

// Merchant profile (REQ-028; Technical Specification 2.2, 3.1). Text block and datasheet layout
// add their own files of CU-066 (#161, #253).

/** Longest brand name after trimming (2.2). */
export const BRAND_NAME_MAX = 100;

/** Longest contact text, available as `{Händler-Kontakt}` (2.2, 3.1). */
export const CONTACT_TEXT_MAX = 500;

/**
 * Brand name: 1–100 characters after removing the spaces at the edges; one text for empty and
 * too long (UI-026 "Name: 1 bis 100 Zeichen").
 */
export const brandNameSchema = z
  .string()
  .trim()
  .min(1, FIELD_MESSAGES.brandName)
  .max(BRAND_NAME_MAX, FIELD_MESSAGES.brandName);

/**
 * Contact text: 0–500 characters, several lines; stored as entered (UI-026 "Kontaktangaben:
 * höchstens 500 Zeichen").
 */
export const contactTextSchema = z.string().max(CONTACT_TEXT_MAX, FIELD_MESSAGES.contactText);

/** `PUT /api/merchant-profile`: the version last read and both texts (2.0.3, 2.2). */
export const merchantProfileUpdateSchema = z.strictObject({
  version: versionSchema,
  brandName: brandNameSchema,
  contactText: contactTextSchema,
});
export type MerchantProfileUpdate = z.infer<typeof merchantProfileUpdateSchema>;

/** Logo of the profile, an image under `/media/logo/{hash}` (2.0.1). */
export const merchantLogoSchema = z.object({
  hash: z.string(),
  url: z.string(),
});
export type MerchantLogo = z.infer<typeof merchantLogoSchema>;

/** Answer of `GET` and `PUT /api/merchant-profile` (2.2). */
export const merchantProfileSchema = z.object({
  brandName: z.string(),
  contactText: z.string(),
  logo: merchantLogoSchema.nullable(),
  version: versionSchema,
});
export type MerchantProfile = z.infer<typeof merchantProfileSchema>;
