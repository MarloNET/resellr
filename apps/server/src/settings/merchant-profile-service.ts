import type {
  MerchantProfile,
  MerchantProfileUpdate,
} from '@resellr/domain/schemas/merchant-profile.schema';
import type { Kysely } from 'kysely';

import { createAuditWriter } from '../audit/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWork, UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import { ConflictError } from '../shared/domain-error.ts';
import {
  createProfileRepository,
  type MerchantProfileRow,
  type ProfileRepository,
} from './profile-repository.ts';

export interface MerchantProfileServiceDeps {
  /** Outer database, only for reads outside of an action (2.0.4). */
  db: Kysely<DB>;
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

const OBJECT_ID = 1;
const OBJECT_LABEL = 'Händlermarke';

type ProfileState = Pick<
  MerchantProfileRow,
  'brand_name' | 'contact_text' | 'logo_hash' | 'version'
>;

/** The empty row the seed migration writes (#150, 3.8), as long as there is none yet. */
const EMPTY_PROFILE: ProfileState = {
  brand_name: '',
  contact_text: '',
  logo_hash: null,
  version: 1,
};

function toMerchantProfile(row: ProfileState): MerchantProfile {
  return {
    brandName: row.brand_name,
    contactText: row.contact_text,
    logo:
      row.logo_hash === null ? null : { hash: row.logo_hash, url: `/media/logo/${row.logo_hash}` },
    version: row.version,
  };
}

async function readProfile(repository: ProfileRepository): Promise<ProfileState> {
  return (await repository.findMerchantProfile()) ?? EMPTY_PROFILE;
}

/**
 * Merchant profile service (CU-084, REQ-028; Technical Specification 2.2): name of the brand and
 * contact details. It is the only place that writes `merchant_profile` (FIND-203); the logo
 * follows with #167. Each save runs in one transaction with its audit entry (2.0.4, 2.0.9) and
 * reports `SettingsChanged` for all channel contents (2.2 "Wirkung auf Kanal-Inhalte"); its
 * `impact` does not go to the user interface, so the answer has no counts.
 */
export function createMerchantProfileService({ db, uow, clock }: MerchantProfileServiceDeps) {
  const inAction = (tx: UnitOfWork<DB>) => ({
    repository: createProfileRepository(tx.db),
    audit: createAuditWriter({ db: tx.db, clock }),
    at: clock.now().toISOString(),
  });

  return {
    /** `GET /api/merchant-profile`. */
    async get(): Promise<MerchantProfile> {
      return toMerchantProfile(await readProfile(createProfileRepository(db)));
    },

    /**
     * `PUT /api/merchant-profile`: `409 version_conflict` if the version read differs (2.0.3).
     * Without a change nothing is stored, logged or reported.
     */
    async update({
      version,
      brandName,
      contactText,
    }: MerchantProfileUpdate): Promise<MerchantProfile> {
      const { result } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const current = await readProfile(repository);
        if (current.version !== version) throw new ConflictError('version_conflict');

        const renamed = brandName !== current.brand_name;
        const contactChanged = contactText !== current.contact_text;
        if (!renamed && !contactChanged) return toMerchantProfile(current);

        await repository.saveMerchantProfile({
          brandName,
          contactText,
          version: current.version + 1,
          at,
        });
        await audit.write({
          objectType: 'merchant_profile',
          objectId: OBJECT_ID,
          objectLabel: OBJECT_LABEL,
          action: 'updated',
          oldValue: {
            ...(renamed && { Name: current.brand_name }),
            ...(contactChanged && { Kontaktangaben: current.contact_text }),
          },
          newValue: {
            ...(renamed && { Name: brandName }),
            ...(contactChanged && { Kontaktangaben: contactText }),
          },
        });
        tx.emit({ type: 'SettingsChanged', scope: { kind: 'all' } });
        return toMerchantProfile(await readProfile(repository));
      });
      return result;
    },
  };
}

export type MerchantProfileService = ReturnType<typeof createMerchantProfileService>;
