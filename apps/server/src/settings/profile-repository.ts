import type { Kysely, Selectable } from 'kysely';

import type { DB, MerchantProfileTable } from '../db/schema.ts';

export type MerchantProfileRow = Selectable<MerchantProfileTable>;

/** The datasheet layout with its JSON columns read (3.4). */
export interface DatasheetLayoutState {
  headerLabels: string[];
  blockOrder: string[];
  attributeOrder: Record<string, number[]>;
  version: number;
}

export interface DatasheetLayoutChange {
  headerLabels: readonly string[];
  blockOrder: readonly string[];
  attributeOrder: Readonly<Record<string, readonly number[]>>;
  version: number;
  at: string;
}

export interface MerchantProfileChange {
  brandName: string;
  contactText: string;
  version: number;
  at: string;
}

export interface MerchantLogoChange {
  /** Hash of the new logo in `media_file`, `null` to remove it. */
  logoHash: string | null;
  version: number;
  at: string;
}

/** The single row of `merchant_profile` (3.1: `id` is always 1). */
const MERCHANT_PROFILE_ID = 1;

/** The single row of `datasheet_layout` (3.1: `id` is always 1). */
const DATASHEET_LAYOUT_ID = 1;

/**
 * Queries on the single-row tables `merchant_profile` and `datasheet_layout` (CU-288, FIND-202).
 * Inside an action pass `tx.db`, outside of one the outer `db` (2.0.4, MAR-263).
 */
export function createProfileRepository(db: Kysely<DB>) {
  return {
    /** The merchant profile; `undefined` while the empty row of the seed (#150, 3.8) is missing. */
    async findMerchantProfile(): Promise<MerchantProfileRow | undefined> {
      return db
        .selectFrom('merchant_profile')
        .selectAll()
        .where('id', '=', MERCHANT_PROFILE_ID)
        .executeTakeFirst();
    },

    /**
     * Stores name and contact details with the new version. Without the row it is inserted, so
     * saving works the same before and after the seed migration (#150).
     */
    async saveMerchantProfile({ brandName, contactText, version, at }: MerchantProfileChange) {
      await db
        .insertInto('merchant_profile')
        .values({
          id: MERCHANT_PROFILE_ID,
          brand_name: brandName,
          contact_text: contactText,
          logo_hash: null,
          version,
          updated_at: at,
        })
        .onConflict((conflict) =>
          conflict.column('id').doUpdateSet({
            brand_name: brandName,
            contact_text: contactText,
            version,
            updated_at: at,
          }),
        )
        .execute();
    },

    /** The datasheet layout; `undefined` while the row of the seed (#150, 3.8) is missing. */
    async findDatasheetLayout(): Promise<DatasheetLayoutState | undefined> {
      const row = await db
        .selectFrom('datasheet_layout')
        .selectAll()
        .where('id', '=', DATASHEET_LAYOUT_ID)
        .executeTakeFirst();
      if (row === undefined) return undefined;
      return {
        headerLabels: JSON.parse(row.header_labels) as string[],
        blockOrder: JSON.parse(row.block_order) as string[],
        attributeOrder: JSON.parse(row.attribute_order) as Record<string, number[]>,
        version: row.version,
      };
    },

    /**
     * Stores the whole layout with the new version. Without the row it is inserted, so saving
     * works the same before and after the seed migration (#150).
     */
    async saveDatasheetLayout({
      headerLabels,
      blockOrder,
      attributeOrder,
      version,
      at,
    }: DatasheetLayoutChange) {
      const columns = {
        header_labels: JSON.stringify(headerLabels),
        block_order: JSON.stringify(blockOrder),
        attribute_order: JSON.stringify(attributeOrder),
        version,
        updated_at: at,
      };
      await db
        .insertInto('datasheet_layout')
        .values({ id: DATASHEET_LAYOUT_ID, ...columns })
        .onConflict((conflict) => conflict.column('id').doUpdateSet(columns))
        .execute();
    },

    /**
     * Sets or removes the logo with the new version; name and contact details stay. Without the
     * row it is inserted with an empty name and contact, as the seed migration would (#150).
     */
    async saveMerchantLogo({ logoHash, version, at }: MerchantLogoChange) {
      await db
        .insertInto('merchant_profile')
        .values({
          id: MERCHANT_PROFILE_ID,
          brand_name: '',
          contact_text: '',
          logo_hash: logoHash,
          version,
          updated_at: at,
        })
        .onConflict((conflict) =>
          conflict.column('id').doUpdateSet({ logo_hash: logoHash, version, updated_at: at }),
        )
        .execute();
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
