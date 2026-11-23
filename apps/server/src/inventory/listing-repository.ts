import type { Insertable, Kysely, Selectable } from 'kysely';

import type { DB, ListingPriceTable, ListingTable } from '../db/schema.ts';

export type ListingRow = Selectable<ListingTable>;
export type ListingInsert = Omit<Insertable<ListingTable>, 'id'>;

/** The derived stock columns of a model listing (3.3), written only by CU-128 (FIND-221). */
export type ListingStockColumns = Pick<ListingRow, 'quantity' | 'stock_json' | 'stock_hash'>;

/** The listing values of a model listing (2.7, 3.3) with its version, written by CU-124. */
export type ListingValueColumns = Pick<
  ListingRow,
  | 'condition_value_id'
  | 'visual_grade'
  | 'condition_description'
  | 'condition_description_key'
  | 'variant_values'
  | 'other_device_values'
  | 'article_number'
  | 'article_number_key'
  | 'ean_mode'
  | 'own_ean'
  | 'version'
  | 'updated_at'
>;

/**
 * Queries on `listing`, `listing_delivery_scope` and `listing_price` (CU-125; Technical
 * Specification 4.1, Nachtrag MAR-879), with #197 those for creating a model listing, with #204
 * those for saving a price and with #206 those for changing its listing values and delivery scope.
 * A new model listing has no delivery scope and no prices (AC-REQ-019-01), so creating writes
 * neither table.
 * Inside an action pass `tx.db`, outside of one the outer `db` (2.0.4).
 */
export function createListingRepository(db: Kysely<DB>) {
  return {
    /**
     * The variant data of the model listings of the given model templates with their quantity, by
     * model template and `id` (2.1, for CU-290 and CU-294). Without ids there is no query, as
     * `in ()` is invalid in SQLite.
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
          'quantity',
        ])
        .where('model_template_id', 'in', modelTemplateIds)
        .orderBy('model_template_id')
        .orderBy('id')
        .execute();
    },

    /** The number of model listings of a model template (2.4 "Löschen"; CU-295). */
    async countByModelTemplate(modelTemplateId: number): Promise<number> {
      const { count } = await db
        .selectFrom('listing')
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .where('model_template_id', '=', modelTemplateId)
        .executeTakeFirstOrThrow();
      return Number(count);
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

    /** Inserts a model listing; returns its id. */
    async insert(row: ListingInsert): Promise<number> {
      const { id } = await db
        .insertInto('listing')
        .values(row)
        .returning('id')
        .executeTakeFirstOrThrow();
      return id;
    },

    async findById(id: number): Promise<ListingRow | undefined> {
      return db.selectFrom('listing').selectAll().where('id', '=', id).executeTakeFirst();
    },

    /** The text block ids of the delivery scope of a model listing in their order (A-32). */
    async listDeliveryScopeIds(listingId: number): Promise<number[]> {
      const rows = await db
        .selectFrom('listing_delivery_scope')
        .select('text_block_id')
        .where('listing_id', '=', listingId)
        .orderBy('position')
        .execute();
      return rows.map((row) => row.text_block_id);
    },

    /** The prices of a model listing by channel id (2.7). */
    async listPrices(listingId: number) {
      return db
        .selectFrom('listing_price')
        .select(['channel_id', 'amount_cents', 'vb', 'source'])
        .where('listing_id', '=', listingId)
        .orderBy('channel_id')
        .execute();
    },

    /** Inserts or replaces the price of a model listing for one channel (2.7, 3.3). */
    async savePrice(row: Insertable<ListingPriceTable>): Promise<void> {
      await db
        .insertInto('listing_price')
        .values(row)
        .onConflict((conflict) =>
          conflict.columns(['listing_id', 'channel_id']).doUpdateSet({
            amount_cents: row.amount_cents,
            vb: row.vb,
            source: row.source,
          }),
        )
        .execute();
    },

    /** Raises the version of a model listing after a change of its prices (2.0.3). */
    async raiseVersion(id: number, updatedAt: string): Promise<void> {
      await db
        .updateTable('listing')
        .set((eb) => ({ version: eb('version', '+', 1), updated_at: updatedAt }))
        .where('id', '=', id)
        .executeTakeFirstOrThrow();
    },

    /**
     * The model listing holding this article number key, `undefined` if there is none: the
     * article number is unique without regard to case (2.7, 3.3).
     */
    async findByArticleNumberKey(articleNumberKey: string) {
      return db
        .selectFrom('listing')
        .select(['id', 'display_title'])
        .where('article_number_key', '=', articleNumberKey)
        .executeTakeFirst();
    },

    /** The ids of all model listings in ascending order (CU-129). */
    async listIds(): Promise<number[]> {
      const rows = await db.selectFrom('listing').select('id').orderBy('id').execute();
      return rows.map((row) => row.id);
    },

    /** Writes the listing values of a model listing with its new version (2.7, CU-124). */
    async updateValues(id: number, columns: ListingValueColumns): Promise<void> {
      await db.updateTable('listing').set(columns).where('id', '=', id).executeTakeFirstOrThrow();
    },

    /**
     * Replaces the delivery scope of a model listing by these text blocks in their order (A-32,
     * 2.7); an empty list removes it.
     */
    async replaceDeliveryScope(listingId: number, textBlockIds: readonly number[]): Promise<void> {
      await db.deleteFrom('listing_delivery_scope').where('listing_id', '=', listingId).execute();
      if (textBlockIds.length === 0) return;
      await db
        .insertInto('listing_delivery_scope')
        .values(
          textBlockIds.map((textBlockId, position) => ({
            listing_id: listingId,
            text_block_id: textBlockId,
            position,
          })),
        )
        .execute();
    },

    /**
     * Writes the derived stock columns (3.3); only CU-128 calls it, in the transaction of the
     * device change (FIND-221).
     */
    async updateStock(id: number, columns: ListingStockColumns): Promise<void> {
      await db.updateTable('listing').set(columns).where('id', '=', id).executeTakeFirstOrThrow();
    },
  };
}

export type ListingRepository = ReturnType<typeof createListingRepository>;
