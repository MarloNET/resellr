import type { Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';

/**
 * Queries on `listing`, `listing_delivery_scope` and `listing_price` (CU-125; Technical
 * Specification 4.1, Nachtrag MAR-879). Inside an action pass `tx.db`, outside of one the outer
 * `db` (2.0.4).
 */
export function createListingRepository(db: Kysely<DB>) {
  return {
    /**
     * The variant data of the model listings of the given model templates, by model template and
     * `id` (2.1, for CU-290). Without ids there is no query, as `in ()` is invalid in SQLite.
     */
    async listVariantData(modelTemplateIds: readonly number[]) {
      if (modelTemplateIds.length === 0) return [];
      return db
        .selectFrom('listing')
        .select([
          'id',
          'model_template_id',
          'condition_value_id',
          'visual_grade',
          'condition_description',
          'variant_values',
          'other_device_values',
          'display_title',
          'article_number',
        ])
        .where('model_template_id', 'in', modelTemplateIds)
        .orderBy('model_template_id')
        .orderBy('id')
        .execute();
    },

    /**
     * The display titles of the given model listings by `id` (2.5 `wi_nr_taken`, Nachtrag
     * MAR-965); unknown ids are left out. Without ids there is no query.
     */
    async listTitles(listingIds: readonly number[]) {
      if (listingIds.length === 0) return [];
      return db
        .selectFrom('listing')
        .select(['id', 'display_title'])
        .where('id', 'in', listingIds)
        .orderBy('id')
        .execute();
    },
  };
}

export type ListingRepository = ReturnType<typeof createListingRepository>;
