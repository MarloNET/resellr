import { findRejectedPlaceholder } from '@resellr/domain/placeholders/parse-placeholders';
import {
  TEXT_BLOCK_KIND_LABELS,
  type TextBlock,
  type TextBlockCreate,
  type TextBlockKind,
  type TextBlockList,
  type TextBlockSaveResult,
  type TextBlockUpdate,
} from '@resellr/domain/schemas/text-block.schema';
import { toKey } from '@resellr/domain/text/normalize-key';
import type { Kysely } from 'kysely';

import { createAuditWriter } from '../audit/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWork, UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import { ConflictError, NotFoundError, RuleViolation } from '../shared/domain-error.ts';
import { createDeviceTypeRepository } from './device-type-repository.ts';
import {
  createTextBlockRepository,
  type TextBlockRepository,
  type TextBlockRow,
} from './text-block-repository.ts';

export interface TextBlockServiceDeps {
  /** Outer database, only for reads outside of an action (2.0.4). */
  db: Kysely<DB>;
  uow: UnitOfWorkRunner<DB>;
  clock: Clock;
}

const STATUS_LABEL = { true: 'aktiv', false: 'deaktiviert' } as const;
const statusLabel = (active: boolean) => STATUS_LABEL[`${active}`];

const objectLabel = (name: string) => `Textbaustein ${name}`;

function toTextBlock(row: TextBlockRow): TextBlock {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as TextBlockKind,
    body: row.body,
    active: row.active === 1,
    version: row.version,
  };
}

async function readOrThrow(repository: TextBlockRepository, id: number) {
  const row = await repository.findById(id);
  if (row === undefined) throw new NotFoundError();
  return row;
}

/** Name unique over `name_key`, active or not (2.2); `ownId` when renaming. */
async function assertNameFree(repository: TextBlockRepository, nameKey: string, ownId?: number) {
  const existingId = await repository.findIdByNameKey(nameKey);
  if (existingId !== undefined && existingId !== ownId) {
    throw new RuleViolation('name_taken', { usage: 'text_block' });
  }
}

/**
 * Placeholders of the text after Requirements chapter 9.7, row "Textbaustein" (2.2): all but
 * `{Baustein:Name}`; `{Merkmalsbezeichnung}` takes the label of any attribute, because a text
 * block is used for several device types (RQ-06). The first rejected placeholder of the text is
 * named (AC-REQ-026-02, DER-39-05).
 */
async function assertPlaceholdersAllowed(tx: UnitOfWork<DB>, body: string) {
  const labelKeys = await createDeviceTypeRepository(tx.db).listAttributeLabelKeys();
  const rejected = findRejectedPlaceholder(body, 'text_block', new Set(labelKeys));
  if (rejected === null) return;
  const details = { field: 'body', placeholder: rejected.placeholder };
  if (rejected.reason === 'unknown') {
    throw new RuleViolation('placeholder_not_allowed', {
      usage: 'unknown',
      messageArgs: [rejected.placeholder],
      details,
    });
  }
  throw new RuleViolation('placeholder_not_allowed', { usage: 'text_block', details });
}

/**
 * Text block service (CU-082, REQ-026; Technical Specification 2.2): create, change and
 * deactivate text blocks with the check of name, kind, text and placeholders. There is no
 * deletion (2.2, DER-39-13). Each action runs in one transaction with its audit entries
 * (2.0.4, 2.0.9). The scope and the event `SettingsChanged` follow with #163, the legal check
 * status with #164; until then `impact` is the report of the unit of work, `{0, 0, 0}` (4.4.0).
 */
export function createTextBlockService({ db, uow, clock }: TextBlockServiceDeps) {
  const inAction = (tx: UnitOfWork<DB>) => ({
    repository: createTextBlockRepository(tx.db),
    audit: createAuditWriter({ db: tx.db, clock }),
    at: clock.now().toISOString(),
  });

  return {
    /** `GET /api/text-blocks`: all text blocks, active and deactivated (UI-030). */
    async list(query: { limit: number; offset: number }): Promise<TextBlockList> {
      const { rows, total } = await createTextBlockRepository(db).list(query);
      return { items: rows.map(toTextBlock), total };
    },

    /** `POST /api/text-blocks` (AC-REQ-026-02, DER-39-05): a new text block is active. */
    async create({ name, kind, body }: TextBlockCreate): Promise<TextBlockSaveResult> {
      const { result, report } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const nameKey = toKey(name);
        await assertNameFree(repository, nameKey);
        await assertPlaceholdersAllowed(tx, body);
        const id = await repository.insert({ name, nameKey, kind, body, at });
        await audit.write({
          objectType: 'text_block',
          objectId: id,
          objectLabel: objectLabel(name),
          action: 'created',
          oldValue: null,
          newValue: {
            Name: name,
            Art: TEXT_BLOCK_KIND_LABELS[kind],
            Text: body,
            Status: statusLabel(true),
          },
        });
        return toTextBlock(await readOrThrow(repository, id));
      });
      return { textBlock: result, impact: report.impact };
    },

    /**
     * `PATCH /api/text-blocks/{id}`: change name, kind and text and/or deactivate; `409
     * version_conflict` if the version read differs (2.0.3). One audit entry for the changed
     * fields and one for the status (3.6).
     */
    async update(
      id: number,
      { version, name, kind, body, active }: TextBlockUpdate,
    ): Promise<TextBlockSaveResult> {
      const { result, report } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const current = await readOrThrow(repository, id);
        if (current.version !== version) throw new ConflictError('version_conflict');

        const renamed = name !== undefined && name !== current.name;
        const kindChanged = kind !== undefined && kind !== current.kind;
        const bodyChanged = body !== undefined && body !== current.body;
        const wasActive = current.active === 1;
        const switched = active !== undefined && active !== wasActive;
        if (!renamed && !kindChanged && !bodyChanged && !switched) return toTextBlock(current);

        const nameKey = renamed ? toKey(name) : undefined;
        if (nameKey !== undefined) await assertNameFree(repository, nameKey, id);
        if (bodyChanged) await assertPlaceholdersAllowed(tx, body);
        await repository.update(id, {
          ...(renamed && { name, nameKey }),
          ...(kindChanged && { kind }),
          ...(bodyChanged && { body }),
          ...(switched && { active }),
          version: current.version + 1,
          at,
        });

        const label = objectLabel(renamed ? name : current.name);
        if (renamed || kindChanged || bodyChanged) {
          const currentKind = current.kind as TextBlockKind;
          await audit.write({
            objectType: 'text_block',
            objectId: id,
            objectLabel: label,
            action: 'updated',
            oldValue: {
              ...(renamed && { Name: current.name }),
              ...(kindChanged && { Art: TEXT_BLOCK_KIND_LABELS[currentKind] }),
              ...(bodyChanged && { Text: current.body }),
            },
            newValue: {
              ...(renamed && { Name: name }),
              ...(kindChanged && { Art: TEXT_BLOCK_KIND_LABELS[kind] }),
              ...(bodyChanged && { Text: body }),
            },
          });
        }
        if (switched) {
          await audit.write({
            objectType: 'text_block',
            objectId: id,
            objectLabel: label,
            action: active ? 'activated' : 'deactivated',
            oldValue: { Status: statusLabel(wasActive) },
            newValue: { Status: statusLabel(active) },
          });
        }
        return toTextBlock(await readOrThrow(repository, id));
      });
      return { textBlock: result, impact: report.impact };
    },
  };
}

export type TextBlockService = ReturnType<typeof createTextBlockService>;
