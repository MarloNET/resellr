import type { ModelTemplateMatch } from '@resellr/domain/schemas/model-template.schema';
import { toModelNameKey } from '@resellr/domain/text/normalize-key';
import type { Kysely } from 'kysely';

import type { DB } from '../db/schema.ts';
import { ConfirmationRequired } from '../shared/domain-error.ts';

/**
 * Duplicate check (CU-107, REQ-011; Technical Specification 2.4 "Mögliche Dublette"): a possible
 * duplicate is a model template with the same manufacturer and the same `model_name_key` (lower
 * case, without any spaces, AC-REQ-011-01). Without `confirmDuplicate: true` it rejects with
 * `422 confirmation_required`, `details.kind: possible_duplicate` and every hit in
 * `details.matches[]`, ordered by `id`. Inside an action pass `tx.db` (2.0.4).
 */
export function createDuplicateCheck(db: Kysely<DB>) {
  return {
    async checkPossibleDuplicate({
      manufacturerId,
      modelName,
      confirmDuplicate,
    }: {
      manufacturerId: number;
      modelName: string;
      confirmDuplicate?: boolean;
    }): Promise<void> {
      if (confirmDuplicate === true) return;
      const rows = await db
        .selectFrom('model_template as mt')
        .innerJoin('manufacturer as m', 'm.id', 'mt.manufacturer_id')
        .select(['mt.id', 'm.id as manufacturer_id', 'm.name as manufacturer_name'])
        .select(['mt.model_name', 'mt.mpn'])
        .where('mt.manufacturer_id', '=', manufacturerId)
        .where('mt.model_name_key', '=', toModelNameKey(modelName))
        .orderBy('mt.id')
        .execute();
      if (rows.length === 0) return;
      const matches: ModelTemplateMatch[] = rows.map((row) => ({
        id: row.id,
        manufacturer: { id: row.manufacturer_id, name: row.manufacturer_name },
        modelName: row.model_name,
        mpn: row.mpn,
      }));
      throw new ConfirmationRequired('possible_duplicate', {
        usage: 'possible_duplicate',
        details: { matches },
      });
    },
  };
}
