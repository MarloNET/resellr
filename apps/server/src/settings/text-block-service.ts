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
  type TextBlockScope,
  type TextBlockUpdate,
  type TextBlockUpdateResult,
} from '@resellr/domain/schemas/text-block.schema';
import { toKey } from '@resellr/domain/text/normalize-key';
import type { Kysely } from 'kysely';

import { createAuditWriter } from '../audit/index.ts';
import { createChannelReader } from '../channels/index.ts';
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
  type TextBlockScopeIds,
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

function toTextBlock(
  row: TextBlockRow,
  { deviceTypeIds, channelIds }: TextBlockScopeIds,
): TextBlock {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as TextBlockKind,
    body: row.body,
    active: row.active === 1,
    legalStatus: row.legal_status as TextBlockLegalStatus | null,
    legalCheckedOn: row.legal_checked_on,
    legalCheckedBy: row.legal_checked_by,
    allDeviceTypes: row.all_device_types === 1,
    deviceTypeIds,
    allChannels: row.all_channels === 1,
    channelIds,
    version: row.version,
  };
}

const NO_LEGAL_STATUS: TextBlockLegalColumns = {
  legalStatus: null,
  legalCheckedOn: null,
  legalCheckedBy: null,
};
const UNCHECKED: TextBlockLegalColumns = { ...NO_LEGAL_STATUS, legalStatus: 'unchecked' };

const legalColumnsOf = (textBlock: TextBlock): TextBlockLegalColumns => ({
  legalStatus: textBlock.legalStatus,
  legalCheckedOn: textBlock.legalCheckedOn,
  legalCheckedBy: textBlock.legalCheckedBy,
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
  current: TextBlock,
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
  const stored = current.legalStatus === null ? UNCHECKED : legalColumnsOf(current);
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

async function readTextBlock(repository: TextBlockRepository, id: number): Promise<TextBlock> {
  const row = await readOrThrow(repository, id);
  const scope = (await repository.scopesOf([id])).get(id);
  return toTextBlock(row, scope ?? { deviceTypeIds: [], channelIds: [] });
}

type Named = { id: number; name: string };

/**
 * Device types (CU-073) and channels (CU-161) a scope can name: all that exist, active or not,
 * in their order (2.2 "Geltungsbereich des Textbausteins").
 */
async function scopeTargets(tx: UnitOfWork<DB>) {
  const { rows } = await createDeviceTypeRepository(tx.db).list({
    limit: Number.MAX_SAFE_INTEGER,
    offset: 0,
  });
  const channels = await createChannelReader(tx.db).listChannels();
  return { deviceTypes: rows.map(({ id, name }) => ({ id, name })), channels };
}

type ScopeTargets = Awaited<ReturnType<typeof scopeTargets>>;

/**
 * A chosen device type or channel must exist; an unknown id only comes from a program error,
 * so `400 bad_request` (2.2, addendum MAR-773). Ids ascending, as `scopesOf` reads them.
 */
function knownIds(field: string, ids: number[], targets: Named[]): number[] {
  const known = new Set(targets.map(({ id }) => id));
  if (ids.some((id) => !known.has(id))) throw new BadRequestError(`${field} unknown_id`);
  return [...ids].sort((a, b) => a - b);
}

/** The scope after the change; a pair not sent stays as stored (2.2). */
function nextScope(
  current: TextBlockScope,
  change: Partial<TextBlockScope>,
  targets: ScopeTargets,
) {
  return {
    allDeviceTypes: change.allDeviceTypes ?? current.allDeviceTypes,
    deviceTypeIds: knownIds(
      'deviceTypeIds',
      change.deviceTypeIds ?? current.deviceTypeIds,
      targets.deviceTypes,
    ),
    allChannels: change.allChannels ?? current.allChannels,
    channelIds: knownIds('channelIds', change.channelIds ?? current.channelIds, targets.channels),
  };
}

const sameIds = (a: number[], b: number[]) =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/** One part of the scope text: "alle" or the names in their order. */
function namesOf(all: boolean, ids: number[], targets: Named[]): string {
  if (all) return 'alle';
  return targets
    .filter(({ id }) => ids.includes(id))
    .map(({ name }) => name)
    .join(', ');
}

/**
 * Audit field "Geltungsbereich" (2.2, 3.6): "Gerätearten: <alle | Namen>; Kanäle: <alle |
 * Namen>", e.g. "Gerätearten: alle; Kanäle: Kleinanzeigen, eBay".
 */
const scopeText = (scope: TextBlockScope, targets: ScopeTargets) =>
  `Gerätearten: ${namesOf(scope.allDeviceTypes, scope.deviceTypeIds, targets.deviceTypes)}; ` +
  `Kanäle: ${namesOf(scope.allChannels, scope.channelIds, targets.channels)}`;

/** Ids a scope part covers, "alle" resolved to every device type or channel. */
const coveredIds = (all: boolean, ids: number[], targets: Named[]) =>
  all ? targets.map(({ id }) => id) : ids;

/**
 * `SettingsChanged` of a text block (2.2 "Wirkung auf Kanal-Inhalte", 2.8.3): device types ×
 * channels before and after the change, as one scope so a channel content counts once.
 */
function textBlockChanged(scopes: TextBlockScope[], targets: ScopeTargets) {
  const union = (pick: (scope: TextBlockScope) => number[]) =>
    [...new Set(scopes.flatMap(pick))].sort((a, b) => a - b);
  return {
    type: 'SettingsChanged' as const,
    scope: {
      kind: 'text_block' as const,
      deviceTypeIds: union((scope) =>
        coveredIds(scope.allDeviceTypes, scope.deviceTypeIds, targets.deviceTypes),
      ),
      channelIds: union((scope) =>
        coveredIds(scope.allChannels, scope.channelIds, targets.channels),
      ),
    },
  };
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
 * deactivate text blocks with the check of name, kind, text, placeholders and scope, and keep the
 * legal check status of the kinds "Rechtliches" and "Akku-Hinweis". There is no deletion (2.2,
 * DER-39-13). Each action runs in one transaction with its audit entries (2.0.4, 2.0.9). Each
 * save of name, kind, text, status or scope reports `SettingsChanged` over the old and the new
 * scope; `impact` is the report of the unit of work, `{0, 0, 0}` until S5 (2.2, 4.4.0).
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
      const repository = createTextBlockRepository(db);
      const { rows, total } = await repository.list(query);
      const scopes = await repository.scopesOf(rows.map(({ id }) => id));
      const items = rows.map((row) => toTextBlock(row, scopes.get(row.id)!));
      return { items, total };
    },

    /**
     * `POST /api/text-blocks` (AC-REQ-026-02, DER-39-05, DER-39-09): a new text block is active
     * and applies to "alle" or to the chosen device types and channels; one of the kinds
     * "Rechtliches" and "Akku-Hinweis" is "rechtlich ungeprüft" (AC-REQ-054-04).
     */
    async create({ name, kind, body, ...change }: TextBlockCreate): Promise<TextBlockSaveResult> {
      const { result, report } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const nameKey = toKey(name);
        await assertNameFree(repository, nameKey);
        await assertPlaceholdersAllowed(tx, body);
        const { legalStatus } = hasLegalStatus(kind) ? UNCHECKED : NO_LEGAL_STATUS;
        const targets = await scopeTargets(tx);
        const scope = nextScope(change, {}, targets);
        const id = await repository.insert({
          name,
          nameKey,
          kind,
          body,
          legalStatus,
          ...scope,
          at,
        });
        await repository.replaceScope(id, scope);
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
            Geltungsbereich: scopeText(scope, targets),
            Status: statusLabel(true),
            ...(legalStatus !== null && { Prüfstatus: TEXT_BLOCK_LEGAL_STATUS_LABELS.unchecked }),
          },
        });
        tx.emit(textBlockChanged([scope], targets));
        return readTextBlock(repository, id);
      });
      return { textBlock: result, impact: report.impact };
    },

    /**
     * `PATCH /api/text-blocks/{id}`: change name, kind, text, scope and legal check status
     * and/or deactivate; `409 version_conflict` if the version read differs (2.0.3). Each change
     * of the text of a "rechtlich geprüft" text block sets it to "rechtlich ungeprüft", also if
     * the request sends check fields, and answers `legalStatusReset: true` (AC-REQ-054-02,
     * DER-40-03). One audit entry for the changed fields, one for the legal check status and one
     * for the status (3.6).
     */
    async update(id: number, change: TextBlockUpdate): Promise<TextBlockUpdateResult> {
      const { version, name, kind, body, active } = change;
      const { result, report } = await uow.run(async (tx) => {
        const { repository, audit, at } = inAction(tx);
        const current = await readTextBlock(repository, id);
        if (current.version !== version) throw new ConflictError('version_conflict');

        const renamed = name !== undefined && name !== current.name;
        const kindChanged = kind !== undefined && kind !== current.kind;
        const bodyChanged = body !== undefined && body !== current.body;
        const wasActive = current.active;
        const switched = active !== undefined && active !== wasActive;
        const currentLegal = legalColumnsOf(current);
        const nextKind = kind ?? current.kind;
        const requestedLegal = nextLegal(current, nextKind, change, clock.today());
        const legalStatusReset =
          bodyChanged && currentLegal.legalStatus === 'checked' && hasLegalStatus(nextKind);
        const legal = legalStatusReset ? UNCHECKED : requestedLegal;
        const legalChanged = !sameLegal(legal, currentLegal);
        const targets = await scopeTargets(tx);
        const scope = nextScope(current, change, targets);
        // The same ids as a set are no change (2.2); both lists are ascending.
        const scopeChanged =
          scope.allDeviceTypes !== current.allDeviceTypes ||
          scope.allChannels !== current.allChannels ||
          !sameIds(scope.deviceTypeIds, current.deviceTypeIds) ||
          !sameIds(scope.channelIds, current.channelIds);
        const fieldsChanged = renamed || kindChanged || bodyChanged || scopeChanged;
        if (!fieldsChanged && !switched && !legalChanged) {
          return { textBlock: current, legalStatusReset };
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
          ...(scopeChanged && {
            allDeviceTypes: scope.allDeviceTypes,
            allChannels: scope.allChannels,
          }),
          version: current.version + 1,
          at,
        });
        if (scopeChanged) await repository.replaceScope(id, scope);

        const label = objectLabel(renamed ? name : current.name);
        if (fieldsChanged) {
          const currentKind = current.kind;
          await audit.write({
            objectType: 'text_block',
            objectId: id,
            objectLabel: label,
            action: 'updated',
            oldValue: {
              ...(renamed && { Name: current.name }),
              ...(kindChanged && { Art: TEXT_BLOCK_KIND_LABELS[currentKind] }),
              ...(bodyChanged && { Text: current.body }),
              ...(scopeChanged && { Geltungsbereich: scopeText(current, targets) }),
            },
            newValue: {
              ...(renamed && { Name: name }),
              ...(kindChanged && { Art: TEXT_BLOCK_KIND_LABELS[kind] }),
              ...(bodyChanged && { Text: body }),
              ...(scopeChanged && { Geltungsbereich: scopeText(scope, targets) }),
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
        // The legal check status alone changes no channel content (2.2 "Ereignis").
        if (fieldsChanged || switched) tx.emit(textBlockChanged([current, scope], targets));
        return { textBlock: await readTextBlock(repository, id), legalStatusReset };
      });
      return { ...result, impact: report.impact };
    },
  };
}

export type TextBlockService = ReturnType<typeof createTextBlockService>;
