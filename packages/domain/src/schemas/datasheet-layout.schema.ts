import { z } from 'zod';

import { FIELD_MESSAGES } from '../messages/messages.de.ts';
import { datasheetBlockSchema } from './attribute.schema.ts';
import { idSchema, versionSchema } from './common.schema.ts';

// Datasheet layout (REQ-051; Technical Specification 2.2, 3.1, 3.4).

/** Longest header label (UI-039, assumption of the design; 2.2). */
export const HEADER_LABEL_MAX = 50;

/**
 * Number of header labels: exactly the three of the initial layout (UI-039 neither adds nor
 * removes one; 2.2, addendum MAR-815). The service checks it (`400 bad_request`), not the schema,
 * so no Zod default text reaches the user (2.0.5).
 */
export const HEADER_LABEL_COUNT = 3;

/** Header label: 0–50 characters, stored as entered (UI-039 "Kopfzeilentext: höchstens 50 Zeichen"). */
export const headerLabelSchema = z.string().max(HEADER_LABEL_MAX, FIELD_MESSAGES.headerLabel);

/** Key of `attributeOrder`: the id of a device type as JSON object key (3.4). */
const deviceTypeKeySchema = z.string().regex(/^[1-9]\d*$/);

/**
 * Attribute order per device type: device type id → its attribute ids (3.4). A device type
 * without an entry keeps the order of UI-027 (2.2).
 */
export const attributeOrderMapSchema = z.record(deviceTypeKeySchema, z.array(idSchema));
export type AttributeOrderMap = z.infer<typeof attributeOrderMapSchema>;

/**
 * `PUT /api/datasheet-layout`: the version last read and the whole layout (2.0.3, 2.2). Whether
 * the block order is a permutation of the six blocks and an attribute order one of the
 * attributes of its device type, the service checks.
 */
export const datasheetLayoutUpdateSchema = z.strictObject({
  version: versionSchema,
  headerLabels: z.array(headerLabelSchema),
  blockOrder: z.array(datasheetBlockSchema),
  attributeOrder: attributeOrderMapSchema,
});
export type DatasheetLayoutUpdate = z.infer<typeof datasheetLayoutUpdateSchema>;

/** Answer of `GET` and `PUT /api/datasheet-layout` (2.2). */
export const datasheetLayoutSchema = z.object({
  headerLabels: z.array(z.string()),
  blockOrder: z.array(datasheetBlockSchema),
  attributeOrder: attributeOrderMapSchema,
  version: versionSchema,
});
export type DatasheetLayout = z.infer<typeof datasheetLayoutSchema>;
