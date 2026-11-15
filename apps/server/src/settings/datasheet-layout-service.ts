import {
  ATTRIBUTE_VALUE_LABELS,
  DATASHEET_BLOCKS,
  type DatasheetBlock,
} from '@resellr/domain/schemas/attribute.schema';
import {
  HEADER_LABEL_COUNT,
  type AttributeOrderMap,
  type DatasheetLayout,
  type DatasheetLayoutUpdate,
} from '@resellr/domain/schemas/datasheet-layout.schema';
import type { Kysely } from 'kysely';

import { createAuditWriter } from '../audit/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWork, UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import { BadRequestError, ConflictError } from '../shared/domain-error.ts';
import {
  createDeviceTypeRepository,
  type AttributeRow,
  type DeviceTypeRepository,
} from './device-type-repository.ts';
import {
  createProfileRepository,
  type DatasheetLayoutState,
  type ProfileRepository,
} from './profile-repository.ts';

export interface DatasheetLayoutServiceDeps {
  /** Outer database, only for reads outside of an action (2.0.4). */
  db: Kysely<DB>;
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

const OBJECT_ID = 1;
const OBJECT_LABEL = 'Datenblatt-Layout';

/**
 * The layout the seed migration writes (#150, 2.2 "Startbelegung"), as long as there is none
 * yet; without device types there is no attribute order.
 */
const INITIAL_LAYOUT: DatasheetLayoutState = {
  headerLabels: ['Shop:', 'eBay:', 'Kleinanzeigen:'],
  blockOrder: [...DATASHEET_BLOCKS],
  attributeOrder: {},
  version: 1,
};

interface Repositories {
  profiles: ProfileRepository;
  deviceTypes: DeviceTypeRepository;
}

const repositoriesOf = (db: Kysely<DB>): Repositories => ({
  profiles: createProfileRepository(db),
  deviceTypes: createDeviceTypeRepository(db),
});

/**
 * A stored attribute order against the current attributes of its device type: ids of the
 * stored order first, then attributes created after the last save in the order of UI-027. So the
 * order stays a permutation of the attributes of the device type (2.2) when attributes are added
 * in UI-027 after saving the layout.
 */
function currentOrder(stored: readonly number[], attributes: readonly AttributeRow[]): number[] {
  const known = new Set(attributes.map((attribute) => attribute.id));
  const kept = stored.filter((id) => known.has(id));
  const keptIds = new Set(kept);
  return [...kept, ...attributes.map(({ id }) => id).filter((id) => !keptIds.has(id))];
}

/** The stored layout with each attribute order brought to the current attributes. */
async function readLayout({ profiles, deviceTypes }: Repositories): Promise<DatasheetLayout> {
  const stored = (await profiles.findDatasheetLayout()) ?? INITIAL_LAYOUT;
  const attributeOrder: AttributeOrderMap = {};
  for (const [key, ids] of Object.entries(stored.attributeOrder)) {
    attributeOrder[key] = currentOrder(ids, await deviceTypes.listAttributes(Number(key)));
  }
  return {
    headerLabels: stored.headerLabels,
    blockOrder: stored.blockOrder as DatasheetBlock[],
    attributeOrder,
    version: stored.version,
  };
}

const sameList = <T>(a: readonly T[], b: readonly T[]) =>
  a.length === b.length && a.every((entry, index) => entry === b[index]);

/** The six blocks, each exactly once (2.2). */
function isBlockPermutation(blockOrder: readonly DatasheetBlock[]): boolean {
  return (
    blockOrder.length === DATASHEET_BLOCKS.length && new Set(blockOrder).size === blockOrder.length
  );
}

/**
 * Datasheet layout service (CU-085, REQ-051; Technical Specification 2.2): header labels, block
 * order and attribute order per device type. It is the only place that writes
 * `datasheet_layout`. Each save runs in one transaction with its audit entry (2.0.4, 2.0.9); the
 * layout changes no channel contents, so there is no `SettingsChanged` (2.2 "Wirkung auf
 * Kanal-Inhalte").
 */
export function createDatasheetLayoutService({ db, uow, clock }: DatasheetLayoutServiceDeps) {
  const inAction = (tx: UnitOfWork<DB>) => ({
    repositories: repositoriesOf(tx.db),
    audit: createAuditWriter({ db: tx.db, clock }),
    at: clock.now().toISOString(),
  });

  return {
    /** `GET /api/datasheet-layout`. */
    async get(): Promise<DatasheetLayout> {
      return readLayout(repositoriesOf(db));
    },

    /**
     * `PUT /api/datasheet-layout`: `409 version_conflict` if the version read differs (2.0.3) or
     * an attribute order is no longer exactly the attributes of its device type (an attribute
     * created in another window, as for the order in UI-027, 2.1). Another number of header
     * labels than `HEADER_LABEL_COUNT`, a block order that is no permutation of the six blocks or
     * an unknown device type is a program error of the user interface (`400 bad_request`, 2.0.5).
     * Without a change nothing is stored or logged.
     */
    async update({
      version,
      headerLabels,
      blockOrder,
      attributeOrder,
    }: DatasheetLayoutUpdate): Promise<DatasheetLayout> {
      if (headerLabels.length !== HEADER_LABEL_COUNT) {
        throw new BadRequestError('headerLabels wrong_count');
      }
      if (!isBlockPermutation(blockOrder)) throw new BadRequestError('blockOrder not_permutation');

      const { result } = await uow.run(async (tx) => {
        const { repositories, audit, at } = inAction(tx);
        const current = await readLayout(repositories);
        if (current.version !== version) throw new ConflictError('version_conflict');

        const attributeLabels = new Map<number, string>();
        const changedOrders: { name: string; before: number[]; after: number[] }[] = [];
        for (const [key, ids] of Object.entries(attributeOrder)) {
          const deviceType = await repositories.deviceTypes.findById(Number(key));
          if (deviceType === undefined)
            throw new BadRequestError('attributeOrder unknown_device_type');
          const attributes = await repositories.deviceTypes.listAttributes(deviceType.id);
          const known = new Set(attributes.map((attribute) => attribute.id));
          const complete =
            ids.length === known.size &&
            new Set(ids).size === ids.length &&
            ids.every((id) => known.has(id));
          if (!complete) throw new ConflictError('version_conflict');

          const before = current.attributeOrder[key] ?? attributes.map((attribute) => attribute.id);
          if (sameList(before, ids)) continue;
          for (const attribute of attributes) attributeLabels.set(attribute.id, attribute.label);
          changedOrders.push({ name: deviceType.name, before, after: ids });
        }

        const labelsChanged = !sameList(current.headerLabels, headerLabels);
        const blocksChanged = !sameList(current.blockOrder, blockOrder);
        // A device type left out keeps its stored order (2.2).
        const nextAttributeOrder = { ...current.attributeOrder, ...attributeOrder };
        if (!labelsChanged && !blocksChanged && changedOrders.length === 0) {
          return current;
        }

        await repositories.profiles.saveDatasheetLayout({
          headerLabels,
          blockOrder,
          attributeOrder: nextAttributeOrder,
          version: current.version + 1,
          at,
        });

        const blockNames = (blocks: readonly DatasheetBlock[]) =>
          blocks.map((block) => ATTRIBUTE_VALUE_LABELS.datasheetBlock[block]);
        const attributeNames = (ids: readonly number[]) =>
          ids.map((id) => attributeLabels.get(id) ?? String(id));
        await audit.write({
          objectType: 'datasheet_layout',
          objectId: OBJECT_ID,
          objectLabel: OBJECT_LABEL,
          action: 'updated',
          oldValue: {
            ...(labelsChanged && { Kopfzeilentexte: current.headerLabels }),
            ...(blocksChanged && { Blockreihenfolge: blockNames(current.blockOrder) }),
            ...Object.fromEntries(
              changedOrders.map(({ name, before }) => [
                `Merkmalsreihenfolge ${name}`,
                attributeNames(before),
              ]),
            ),
          },
          newValue: {
            ...(labelsChanged && { Kopfzeilentexte: headerLabels }),
            ...(blocksChanged && { Blockreihenfolge: blockNames(blockOrder) }),
            ...Object.fromEntries(
              changedOrders.map(({ name, after }) => [
                `Merkmalsreihenfolge ${name}`,
                attributeNames(after),
              ]),
            ),
          },
        });
        return readLayout(repositories);
      });
      return result;
    },
  };
}

export type DatasheetLayoutService = ReturnType<typeof createDatasheetLayoutService>;
