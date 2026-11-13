import { findRejectedPlaceholder } from '@resellr/domain/placeholders/parse-placeholders';
import {
  hasLegalStatus,
  legalCheckIssues,
  TEXT_BLOCK_KIND_LABELS,
  TEXT_BLOCK_LEGAL_STATUS_LABELS,
  type TextBlock,
  type TextBlockCreate,
  type TextBlockKind,
  type TextBlockLegalStatus,
  type TextBlockList,
  type TextBlockSaveResult,
  type TextBlockUpdate,
  type TextBlockUpdateResult,
} from '@resellr/domain/schemas/text-block.schema';
import { toKey } from '@resellr/domain/text/normalize-key';
import type { Kysely } from 'kysely';

import { createAuditWriter } from '../audit/index.ts';
import type { DB } from '../db/schema.ts';
import type { UnitOfWork, UnitOfWorkRunner } from '../db/unit-of-work.ts';
import type { Clock } from '../shared/clock.ts';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  RuleViolation,
  ValidationError,
} from '../shared/domain-error.ts';
import { createDeviceTypeRepository } from './device-type-repository.ts';
import {
  createTextBlockRepository,
  type TextBlockLegalColumns,
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
    legalStatus: row.legal_status as TextBlockLegalStatus | null,
    legalCheckedOn: row.legal_checked_on,
    legalCheckedBy: row.legal_checked_by,
    version: row.version,
  };
}

const NO_LEGAL_STATUS: TextBlockLegalColumns = {
  legalStatus: null,
  legalCheckedOn: null,
  legalCheckedBy: null,
};
const UNCHECKED: TextBlockLegalColumns = { ...NO_LEGAL_STATUS, legalStatus: 'unchecked' };

const legalColumnsOf = (row: TextBlockRow): TextBlockLegalColumns => ({
  legalStatus: row.legal_status,
  legalCheckedOn: row.legal_checked_on,
  legalCheckedBy: row.legal_checked_by,
});

const sameLegal = (a: TextBlockLegalColumns, b: TextBlockLegalColumns) =>
  a.legalStatus === b.legalStatus &&
  a.legalCheckedOn === b.legalCheckedOn &&
  a.legalCheckedBy === b.legalCheckedBy;

/** Fields of the audit entry `legal_status_changed` (3.6) that differ between both states. */
function legalAuditValues(from: TextBlockLegalColumns, to: TextBlockLegalColumns) {
  const statusLabel = ({ legalStatus }: TextBlockLegalColumns) =>
    legalStatus === null
      ? null
      : TEXT_BLOCK_LEGAL_STATUS_LABELS[legalStatus as TextBlockLegalStatus];
  const values = (state: TextBlockLegalColumns) => ({
    ...(from.legalStatus !== to.legalStatus && { Prüfstatus: statusLabel(state) }),
    ...(from.legalCheckedOn !== to.legalCheckedOn && { Prüfdatum: state.legalCheckedOn }),
    ...(from.legalCheckedBy !== to.legalCheckedBy && { 'Prüfende Stelle': state.legalCheckedBy }),
  });
  return { oldValue: values(from), newValue: values(to) };
}

/**
 * Legal check status after a change (2.2, REQ-054): none for the kinds without one (DER-40-05),
 * "rechtlich ungeprüft" for a text block that becomes one of the two kinds, otherwise the stored
 * state with the check fields of the request. "rechtlich geprüft" needs check date and checking
 * body, the date not after `today` (AC-REQ-054-03, DER-40-01, DER-40-02); "rechtlich ungeprüft"
 * stores neither. A request with check fields for a kind without status is a structural error:
 * UI-030 does not offer them (2.0.5 rule (4)).
 */
function nextLegal(
  current: TextBlockRow,
  kind: TextBlockKind,
  { legalStatus, legalCheckedOn, legalCheckedBy }: TextBlockUpdate,
  today: string,
): TextBlockLegalColumns {
  const requested =
    legalStatus !== undefined || legalCheckedOn !== undefined || legalCheckedBy !== undefined;
  if (!hasLegalStatus(kind)) {
    if (requested) throw new BadRequestError('legal check fields for a kind without status');
    return NO_LEGAL_STATUS;
  }
  const stored = current.legal_status === null ? UNCHECKED : legalColumnsOf(current);
  if (!requested) return stored;
  const check = {
    legalStatus: legalStatus ?? (stored.legalStatus as TextBlockLegalStatus),
    legalCheckedOn: legalCheckedOn ?? stored.legalCheckedOn ?? '',
    legalCheckedBy: legalCheckedBy ?? stored.legalCheckedBy ?? '',
  };
  const issues = legalCheckIssues(check, today);
  if (issues.length > 0) throw new ValidationError(issues);
  if (check.legalStatus === 'unchecked') return UNCHECKED;
  return check;
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
 * Text block service (CU-082, REQ-026, REQ-054; Technical Specification 2.2): create, change and
 * deactivate text blocks with the check of name, kind, text and placeholders, and keep the legal
 * check status of the kinds "Rechtliches" and "Akku-Hinweis". There is no deletion (2.2,
 * DER-39-13). Each action runs in one transaction with its audit entries (2.0.4, 2.0.9). The
 * scope and the event `SettingsChanged` follow with #163; until then `impact` is the report of
 * the unit of work, `{0, 0, 0}` (4.4.0).
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

    /**
     * `POST /api/text-blocks` (AC-REQ-026-02, DER-39-05): a new text block is active; one of the
     * kinds "Rechtliches" and "Akku-Hinweis" is "rechtlich ungeprüft" (AC-REQ-054-04).
     */
    async create({ name, kind, body }: TextBlockCreate): Promise<TextBlockSaveResult> {
      const { result, report } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const nameKey = toKey(name);
        await assertNameFree(repository, nameKey);
        await assertPlaceholdersAllowed(tx, body);
        const { legalStatus } = hasLegalStatus(kind) ? UNCHECKED : NO_LEGAL_STATUS;
        const id = await repository.insert({ name, nameKey, kind, body, legalStatus, at });
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
            ...(legalStatus !== null && { Prüfstatus: TEXT_BLOCK_LEGAL_STATUS_LABELS.unchecked }),
          },
        });
        return toTextBlock(await readOrThrow(repository, id));
      });
      return { textBlock: result, impact: report.impact };
    },

    /**
     * `PATCH /api/text-blocks/{id}`: change name, kind, text and legal check status and/or
     * deactivate; `409 version_conflict` if the version read differs (2.0.3). Each change of the
     * text of a "rechtlich geprüft" text block sets it to "rechtlich ungeprüft", also if the
     * request sends check fields, and answers `legalStatusReset: true` (AC-REQ-054-02,
     * DER-40-03). One audit entry for the changed fields, one for the legal check status and one
     * for the status (3.6).
     */
    async update(id: number, change: TextBlockUpdate): Promise<TextBlockUpdateResult> {
      const { version, name, kind, body, active } = change;
      const { result, report } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const current = await readOrThrow(repository, id);
        if (current.version !== version) throw new ConflictError('version_conflict');

        const renamed = name !== undefined && name !== current.name;
        const kindChanged = kind !== undefined && kind !== current.kind;
        const bodyChanged = body !== undefined && body !== current.body;
        const wasActive = current.active === 1;
        const switched = active !== undefined && active !== wasActive;
        const currentLegal = legalColumnsOf(current);
        const nextKind = kind ?? (current.kind as TextBlockKind);
        const requestedLegal = nextLegal(current, nextKind, change, clock.today());
        const legalStatusReset =
          bodyChanged && currentLegal.legalStatus === 'checked' && hasLegalStatus(nextKind);
        const legal = legalStatusReset ? UNCHECKED : requestedLegal;
        const legalChanged = !sameLegal(legal, currentLegal);
        if (!renamed && !kindChanged && !bodyChanged && !switched && !legalChanged) {
          return { textBlock: toTextBlock(current), legalStatusReset };
        }

        const nameKey = renamed ? toKey(name) : undefined;
        if (nameKey !== undefined) await assertNameFree(repository, nameKey, id);
        if (bodyChanged) await assertPlaceholdersAllowed(tx, body);
        await repository.update(id, {
          ...(renamed && { name, nameKey }),
          ...(kindChanged && { kind }),
          ...(bodyChanged && { body }),
          ...(switched && { active }),
          ...(legalChanged && { legal }),
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
        if (legalChanged) {
          await audit.write({
            objectType: 'text_block',
            objectId: id,
            objectLabel: label,
            action: 'legal_status_changed',
            ...legalAuditValues(currentLegal, legal),
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
        return { textBlock: toTextBlock(await readOrThrow(repository, id)), legalStatusReset };
      });
      return { ...result, impact: report.impact };
    },
  };
}

export type TextBlockService = ReturnType<typeof createTextBlockService>;
