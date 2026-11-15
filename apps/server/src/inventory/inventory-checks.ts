import { variantsMatch, type VariantSpec } from '@resellr/domain/inventory/compare-variants';
import type { AttributeValues } from '@resellr/domain/schemas/attribute-values.schema';

import type { DB } from '../db/schema.ts';
import type { EventHandlers, UnitOfWork } from '../db/unit-of-work.ts';
import { RuleViolation } from '../shared/domain-error.ts';
import type { VariantSetChanging } from '../shared/events.ts';

/** Model listings of one model template that would have the same variant data (2.1). */
interface MergingGroup {
  modelTemplateId: number;
  modelName: string;
  listings: { id: number; displayTitle: string; articleNumber: string }[];
}

const parseValues = (json: string) => JSON.parse(json) as AttributeValues;

/**
 * Removing the flag "variantenbildend" (REQ-005, AC-REQ-005-09; Technical Specification 2.1):
 * per model template of the device type, groups the model listings that the comparison rule
 * (CU-119) finds equal with the variant set after the change. The values of a listing are its
 * device-level values, the variant values together with the other ones, so an attribute that
 * got the flag after the listing was created is compared with its value too.
 */
async function checkVariantSetChanging(
  { deviceTypeId, variantAttributeIds }: VariantSetChanging,
  { db }: UnitOfWork<DB>,
): Promise<void> {
  const rows = await db
    .selectFrom('listing')
    .innerJoin('model_template', 'model_template.id', 'listing.model_template_id')
    .where('model_template.device_type_id', '=', deviceTypeId)
    .select([
      'listing.id',
      'listing.model_template_id',
      'model_template.model_name',
      'listing.condition_value_id',
      'listing.visual_grade',
      'listing.condition_description',
      'listing.variant_values',
      'listing.other_device_values',
      'listing.display_title',
      'listing.article_number',
    ])
    .orderBy('listing.model_template_id')
    .orderBy('listing.id')
    .execute();

  // The comparison rule is an equality, so each listing joins the first group it matches.
  const groups: (MergingGroup & { spec: VariantSpec })[] = [];
  for (const row of rows) {
    const spec: VariantSpec = {
      conditionValueId: row.condition_value_id,
      visualGrade: row.visual_grade,
      conditionDescription: row.condition_description,
      values: { ...parseValues(row.other_device_values), ...parseValues(row.variant_values) },
    };
    const listing = {
      id: row.id,
      displayTitle: row.display_title,
      articleNumber: row.article_number,
    };
    const group = groups.find(
      (candidate) =>
        candidate.modelTemplateId === row.model_template_id &&
        variantsMatch(candidate.spec, spec, variantAttributeIds),
    );
    if (group === undefined) {
      groups.push({
        modelTemplateId: row.model_template_id,
        modelName: row.model_name,
        listings: [listing],
        spec,
      });
    } else {
      group.listings.push(listing);
    }
  }

  const merging = groups.filter((group) => group.listings.length > 1);
  if (merging.length === 0) return;
  throw new RuleViolation('variant_flag_would_merge_listings', {
    usage: 'flag',
    details: {
      groups: merging.map(({ modelTemplateId, listings }) => ({
        modelTemplateId,
        listingIds: listings.map((listing) => listing.id),
      })),
    },
    messageArgs: [merging.map(groupLabel).join('; ')],
  });
}

/** E.g. `MacBook Air M2: „MacBook Air M2 16GB“ (626198), „MacBook Air M2 8GB“ (626199)`. */
const groupLabel = ({ modelName, listings }: MergingGroup) =>
  `${modelName}: ${listings
    .map(({ displayTitle, articleNumber }) => `„${displayTitle}“ (${articleNumber})`)
    .join(', ')}`;

/**
 * Handlers of the check events of `inventory` (CU-290; Technical Specification 2.8.3, 4.5): one
 * entry per event, in alphabetical order. `app.ts` (CU-019) gives them to the unit of work.
 */
export const inventoryChecks: NonNullable<EventHandlers<DB>['check']> = {
  VariantSetChanging: checkVariantSetChanging,
};
