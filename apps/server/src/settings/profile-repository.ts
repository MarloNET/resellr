import type { Kysely, Selectable } from 'kysely';

import type { DB, MerchantProfileTable } from '../db/schema.ts';

export type MerchantProfileRow = Selectable<MerchantProfileTable>;

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
