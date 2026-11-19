import { formatNumber, formatWithUnit, formatYesNo } from '@resellr/domain/format/format-value';
import { ERROR_MESSAGES } from '@resellr/domain/messages/messages.de';
import type { Attribute } from '@resellr/domain/schemas/attribute.schema';
import type { AttributeValue, PortEntry } from '@resellr/domain/schemas/attribute-values.schema';
import type { BatteryValueFlag } from '@resellr/domain/schemas/pick-list.schema';
import {
  type DeviceCreateInput,
  deviceCreateSchema,
  type DevicePrefillAnswer,
} from '@resellr/domain/schemas/device.schema';
import {
  type ModelTemplate,
  type ModelTemplateListItem,
  modelTemplateSearchTermSchema,
} from '@resellr/domain/schemas/model-template.schema';
import type { PickList, PickListValueList } from '@resellr/domain/schemas/pick-list.schema';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import type { ApiError } from '../../api/api-client.ts';
import { queryKeys } from '../../api/query-keys.ts';
import { useModelTemplateQuery, useModelTemplatesQuery } from '../../api/catalog.api.ts';
import { useCreateDeviceMutation, useDevicePrefillQuery } from '../../api/inventory.api.ts';
import {
  useAttributesQuery,
  useDeviceTypesQuery,
  useManufacturersQuery,
  usePickListsQuery,
  usePickListValuesQueries,
  usePickListValuesQuery,
  useSuppliersQuery,
} from '../../api/settings.api.ts';
import { useWritesLocked } from '../../api/write-outcome-store.ts';
import {
  AttributeFieldsForm,
  type AttributeInputs,
  attributeListChoices,
  attributeRequestValues,
  attributesOfLevel,
  type PortListIds,
  withoutPickListValues,
} from '../../components/forms/AttributeFieldsForm.tsx';
import {
  attributeInputOf,
  type AttributeInputValue,
  emptyAttributeInput,
} from '../../components/forms/AttributeInput.tsx';
import {
  type ChoiceItem,
  findMissingChoices,
  findMissingListChoices,
  type ListChoice,
  type MissingChoice,
  type ReloadedList,
} from '../../components/forms/deactivated-choice.ts';
import {
  FormField,
  useDeferredBlurCheck,
  useFocusFirstError,
} from '../../components/forms/FormField.tsx';
import { OutcomeUnknownBanner } from '../../components/patterns/OutcomeUnknownBanner.tsx';
import { PageBanner } from '../../components/patterns/PageBanner.tsx';
import {
  noticeOf,
  SaveNoticeBanners,
  type SaveNotice,
} from '../../components/patterns/SaveNoticeBanners.tsx';
import { UnreachableBanner } from '../../components/patterns/UnreachableBanner.tsx';
import { Badge } from '../../components/ui/Badge.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Checkbox } from '../../components/ui/Checkbox.tsx';
import { cn } from '../../components/ui/cn.ts';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';
import type { SavedNoticeState } from '../models/ModelTemplatePage.tsx';
import { AssignDialog, type AssignDialogDevice } from './AssignDialog.tsx';
import {
  clearDeviceIntakeDraft,
  FROM_DEVICE_INTAKE,
  readDeviceIntakeDraft,
  storeDeviceIntakeDraft,
} from './device-intake-draft.ts';

// Texts of UI-003 `screen.md` and its mockup (UI/UX design v0.6.1; v0.6.8 for the choice after a
// rejection for deactivation, v0.6.9 for `wi_nr_taken`). UI-010 shows the same form (DER-56-01).
export const TEXTS = {
  title: 'Gerät einbuchen',
  requiredHint: 'Felder mit * sind Pflicht.',
  device: 'Gerät',
  wiNr: 'WI-Nr',
  supplier: 'Lieferant',
  modelTemplate: 'Modellvorlage',
  modelTemplateSearch: 'Modellvorlage suchen',
  otherModelTemplate: 'Andere Modellvorlage wählen',
  newModelTemplate: 'Neue Modellvorlage anlegen',
  nextDevice: 'Weiteres Gerät derselben Modellvorlage',
  deviceValues: 'Gerätewerte',
  modelData: 'Modelldaten (nur lesen)',
  loadingValues: 'Lade Gerätewerte …',
  condition: 'Zustand',
  visualGrade: 'Optik-Note',
  conditionDescription: 'Zustandsbeschreibung',
  choose: 'Bitte wählen',
  mpn: 'Herstellernummer',
  mpnUnknown: 'unbekannt',
  save: 'Gerät speichern',
  saveAndAssign: 'Speichern und zuordnen',
  saving: 'Speichern …',
  saved: (wiNr: string) => `Gerät ${wiNr} gespeichert`,
  error: (referenceNumber: string | null) =>
    `Das Gerät konnte nicht gespeichert werden. Bitte erneut versuchen. Referenz: ${referenceNumber ?? '–'}`,
  notDeterminable: 'nicht ermittelbar',
  toReview: 'zu prüfen',
  confirm: 'Bestätigen',
  confirmField: (field: string) => `${field} bestätigen`,
  reviewOpen: (count: number) =>
    `Noch ${count} Werte zu prüfen. Das Gerät kann gespeichert, aber noch nicht zugeordnet werden.`,
  allReviewed: 'Alle Werte geprüft.',
  reviewFirst: 'Erst Werte prüfen',
} as const;

/** UI-007 for a new model template (2.0.1 "Routen der Oberfläche"). */
const MODEL_TEMPLATE_NEW_PATH = '/modelle/neu';

/** Wait after the last keystroke before the model templates are searched (as in UI-006). */
const SEARCH_DELAY_MS = 300;

/** The fixed fields of the form (DER-54-01). */
const FIELDS = [
  'wiNr',
  'supplierId',
  'modelTemplateId',
  'conditionValueId',
  'visualGrade',
  'conditionDescription',
] as const;
type Field = (typeof FIELDS)[number];
/** The fixed fields before the attributes; the condition description ends the card (mockup). */
const FIELDS_BEFORE_VALUES = FIELDS.slice(0, -1);
/** A field error by path: the fixed fields and `values.<id>` (2.0.5). */
type FieldErrors = Partial<Record<string, ReactNode>>;

interface Draft {
  wiNr: string;
  supplierId: number | null;
  modelTemplate: ModelTemplateListItem | null;
  conditionValueId: number | null;
  visualGrade: string;
  conditionDescription: string;
  /** Inputs of the attributes of the level device by attribute id (CU-111). */
  values: AttributeInputs;
  /** The review flags of the prefill (REQ-013): attribute ids, `condition`, `visualGrade`. */
  reviewKeys: readonly string[];
  /** The flags the user lifted by "Bestätigen" or by changing the value (UI-003 "Aktionen"). */
  confirmedKeys: readonly string[];
}

const EMPTY_DRAFT: Draft = {
  wiNr: '',
  supplierId: null,
  modelTemplate: null,
  conditionValueId: null,
  visualGrade: '',
  conditionDescription: '',
  values: {},
  reviewKeys: [],
  confirmedKeys: [],
};

/** The review flags still open: the prefilled ones not confirmed or changed (2.5, CU-118). */
const openReviewKeys = ({ reviewKeys, confirmedKeys }: Draft) =>
  reviewKeys.filter((key) => !confirmedKeys.includes(key));

/** The draft with a review flag lifted; a key without a flag is not recorded. */
function withConfirmed(draft: Draft, keys: readonly string[]): Pick<Draft, 'confirmedKeys'> {
  const lifted = keys.filter((key) => draft.reviewKeys.includes(key));
  return { confirmedKeys: [...new Set([...draft.confirmedKeys, ...lifted])] };
}

/**
 * The inputs of the prefill (REQ-013, 2.5): the prefilled values of the attributes the form asks
 * for and the suggestions of the condition code; an input the prefill has no value for stays.
 */
function prefilledDraft(
  draft: Draft,
  prefill: DevicePrefillAnswer,
  attributes: readonly Attribute[],
): Draft {
  const values = Object.fromEntries(
    attributesOfLevel(attributes, 'device').flatMap((attribute) => {
      const value = prefill.values[String(attribute.id)];
      return value === undefined
        ? []
        : [[String(attribute.id), attributeInputOf(attribute, value as AttributeValue)]];
    }),
  );
  return {
    ...draft,
    conditionValueId: prefill.conditionValueId ?? draft.conditionValueId,
    visualGrade: prefill.visualGrade === null ? draft.visualGrade : String(prefill.visualGrade),
    conditionDescription: prefill.conditionDescription || draft.conditionDescription,
    values: { ...draft.values, ...values },
    reviewKeys: prefill.reviewKeys,
    confirmedKeys: [],
  };
}

/** The path of the value of an attribute in the request and its field errors (2.0.5). */
export const valuePath = (attributeId: number) => `values.${attributeId}`;

/** The attributes of the device type with their values of the list battery, as the form uses them. */
export interface DeviceAttributes {
  attributes: readonly Attribute[];
  batteryValues: readonly BatteryValueFlag[];
}

/**
 * Whether the field "Akkukapazität" shows: only while the chosen value of the active attribute
 * with the role `battery` carries "Akku vorhanden" (UI-003 "Eingaben", 2.5, FIND-353).
 */
export function batteryCapacityShown(
  { attributes, batteryValues }: DeviceAttributes,
  values: AttributeInputs,
): boolean {
  const battery = attributesOfLevel(attributes, 'device').find(
    ({ systemRole }) => systemRole === 'battery',
  );
  const chosen = battery === undefined ? undefined : values[String(battery.id)];
  return batteryValues.some(({ id, batteryPresent }) => id === chosen && batteryPresent === true);
}

/**
 * The attributes of the level device the form asks for, in their order: the active ones, the
 * battery capacity only while the battery value carries "Akku vorhanden" and then required with
 * "*" (DER-54-01, UI-003 "Eingaben"; the schema of CU-067 checks it from the battery value).
 */
export function shownAttributes(device: DeviceAttributes, values: AttributeInputs): Attribute[] {
  const withCapacity = batteryCapacityShown(device, values);
  return attributesOfLevel(device.attributes, 'device').flatMap((attribute) => {
    if (attribute.systemRole !== 'battery_capacity') return [attribute];
    return withCapacity ? [{ ...attribute, required: true }] : [];
  });
}

/** The attribute with the role `battery_capacity` the form asks for, if the device type has it. */
export const capacityAttribute = (device: DeviceAttributes) =>
  attributesOfLevel(device.attributes, 'device').find(
    ({ systemRole }) => systemRole === 'battery_capacity',
  );

/**
 * The inputs with the battery capacity emptied while its field is not shown: it goes with its
 * value when the battery value changes or is emptied (UI-003 "Eingaben", 2.0.11 "Abhängige
 * Eingaben"), so it shows empty when it appears again.
 */
export function withCapacityOfBattery(
  device: DeviceAttributes,
  values: AttributeInputs,
): AttributeInputs {
  const capacity = capacityAttribute(device);
  if (capacity === undefined || batteryCapacityShown(device, values)) return values;
  return { ...values, [capacity.id]: emptyAttributeInput(capacity) };
}

/** The inputs of the card "Gerätewerte" with a pick list value (2.0.11). */
export interface ChosenDeviceValues {
  conditionValueId: number | null;
  values: AttributeInputs;
}

/**
 * The pick list values chosen in the card "Gerätewerte" in form order: the condition, then the
 * attributes of the level device (2.0.11 "Betroffene Felder"); with `stored` (UI-010) a value of
 * the stored device is marked stored, so it is never missing.
 */
export function deviceValueChoices(
  device: DeviceAttributes,
  chosen: ChosenDeviceValues,
  {
    conditionListId,
    ports,
    stored,
  }: {
    conditionListId: number | null;
    ports: PortListIds;
    stored?: { conditionValueId: number; values: Readonly<Record<string, unknown>> };
  },
): ListChoice[] {
  const { conditionValueId } = chosen;
  return [
    ...(conditionValueId === null
      ? []
      : [
          {
            path: 'conditionValueId',
            id: conditionValueId,
            stored: conditionValueId === stored?.conditionValueId,
            list: String(conditionListId),
            message: ERROR_MESSAGES['pick_list_value_deactivated.condition'],
          },
        ]),
    ...attributeListChoices(device.attributes, 'device', chosen.values, {
      prefix: 'values',
      ports,
      stored: stored?.values,
    }),
  ];
}

/**
 * The inputs without the missing choices (2.0.11 "Anzeige"): each emptied (value `null`, the
 * count of a port entry kept); without the battery value the battery capacity goes too.
 */
export function withoutMissingChoices<T extends ChosenDeviceValues>(
  device: DeviceAttributes,
  chosen: T,
  missing: readonly MissingChoice[],
): T {
  const idsAt = (path: string) =>
    new Set(missing.filter((choice) => choice.path === path).map(({ id }) => id));
  const values = Object.fromEntries(
    Object.entries(chosen.values).map(([key, input]) => {
      const attribute = device.attributes.find(({ id }) => String(id) === key);
      const ids = idsAt(`values.${key}`);
      return [key, attribute === undefined ? input : withoutPickListValues(attribute, input, ids)];
    }),
  );
  return {
    ...chosen,
    conditionValueId: idsAt('conditionValueId').size > 0 ? null : chosen.conditionValueId,
    values: withCapacityOfBattery(device, values),
  };
}

/** Ids of the lists `port_type` and `port_position` from `GET /api/pick-lists`. */
export function portListIds(lists: readonly PickList[] | undefined): PortListIds {
  return { type: listIdOf(lists, 'port_type'), position: listIdOf(lists, 'port_position') };
}

const asItems = (list: PickListValueList | undefined): ChoiceItem[] =>
  (list?.items ?? []).map(({ id, label, active }) => ({ id, label, active }));

/**
 * Reads every pick list of the page again (2.0.11 "die Auswahllisten werden neu geladen") and
 * returns each list before and after by its id; `after` is `null` if the read failed.
 */
export async function reloadPickListValues(
  queryClient: QueryClient,
): Promise<Record<string, ReloadedList>> {
  const prefix = queryKeys.settings.pickListValues(0).slice(0, -1);
  const before = queryClient
    .getQueriesData<PickListValueList>({ queryKey: prefix })
    .map(([key, list]) => [Number(key.at(-1)), list] as const);
  await queryClient.refetchQueries({ queryKey: prefix });
  return Object.fromEntries(
    before.map(([listId, list]) => {
      const state = queryClient.getQueryState<PickListValueList>(
        queryKeys.settings.pickListValues(listId),
      );
      return [
        String(listId),
        { before: asItems(list), after: state?.status === 'error' ? null : asItems(state?.data) },
      ];
    }),
  );
}

/** The ids of a list that could not be read again and held the rejected entry (2.0.11). */
export function droppedAfterReload(
  lists: Readonly<Record<string, ReloadedList>>,
  rejectedId: number,
): number[] {
  return Object.values(lists).some(
    ({ before, after }) => after === null && before.some(({ id }) => id === rejectedId),
  )
    ? [rejectedId]
    : [];
}

/** Whether a rejection for a deactivated pick list value belongs to a field of the card. */
export const isDeactivatedValueAt = (code: string | undefined, path: unknown): path is string =>
  code === 'pick_list_value_deactivated' &&
  typeof path === 'string' &&
  (path === 'conditionValueId' || /^values\.\d+$/.test(path));

/**
 * Request body of `POST /api/devices`: every field, nothing chosen as `null`, and every attribute
 * the form asks for (2.0.5 rule (2)); without the field "Akkukapazität" no value of it (2.5).
 */
const bodyOf = (draft: Draft, device: DeviceAttributes | null): DeviceCreateInput => ({
  wiNr: draft.wiNr,
  supplierId: draft.supplierId,
  modelTemplateId: draft.modelTemplate?.id ?? null,
  conditionValueId: draft.conditionValueId,
  visualGrade: draft.visualGrade,
  conditionDescription: draft.conditionDescription,
  values:
    device === null
      ? {}
      : attributeRequestValues(shownAttributes(device, draft.values), 'device', draft.values),
  confirmedKeys: [...draft.confirmedKeys],
});

/** Fields of the card "Gerätewerte", shown only once a model template is chosen (DER-54-01). */
const isDeviceValue = (path: string) =>
  path === 'conditionValueId' ||
  path === 'visualGrade' ||
  path === 'conditionDescription' ||
  path.startsWith('values.');

/**
 * Field errors of the check in the browser, the same schema as on the server (2.0.7): with the
 * attributes of the device type and the values of the list battery once they are read; without a
 * model template only those of the fields shown.
 */
function checkAll(draft: Draft, device: DeviceAttributes | null): FieldErrors {
  const errors: FieldErrors = {};
  const schema = deviceCreateSchema(device?.attributes ?? null, {
    batteryValues: device?.batteryValues,
  });
  for (const issue of schema.safeParse(bodyOf(draft, device)).error?.issues ?? []) {
    const path = issue.path.join('.');
    if (draft.modelTemplate === null && isDeviceValue(path)) continue;
    errors[path] ??= issue.message;
  }
  return errors;
}

/**
 * Errors in form order: the fixed fields, the values in the order of the attributes, then the
 * condition description, as the card "Gerätewerte" shows them (2.0.5 "Fehlerzusammenfassung").
 */
function inFormOrder(
  errors: FieldErrors,
  attributes: readonly Attribute[] = [],
): [string, ReactNode][] {
  const paths = [
    ...FIELDS_BEFORE_VALUES,
    ...attributes.map(({ id }) => valuePath(id)),
    'conditionDescription',
  ];
  const order = (path: string) => {
    const index = paths.indexOf(path);
    return index === -1 ? paths.length : index;
  };
  return Object.entries(errors)
    .filter(([, error]) => Boolean(error))
    .sort(([a], [b]) => order(a) - order(b));
}

/** The input of a field or `values.<id>`, to see whether it changed since the server answered. */
function fieldValue(draft: Draft, path: string): unknown {
  if (path === 'modelTemplateId') return draft.modelTemplate?.id;
  if (path.startsWith('values.')) return draft.values[path.slice('values.'.length)];
  return draft[path as Exclude<Field, 'modelTemplateId'>];
}

/** The field errors of the attribute fields by attribute id, as CU-111 shows them. */
export function attributeErrors(errors: FieldErrors): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([path, error]) => path.startsWith('values.') && typeof error === 'string')
      .map(([path, error]) => [path.slice('values.'.length), error as string]),
  );
}

/**
 * Chip "zu prüfen" and link "Bestätigen" of a prefilled field (DER-55-02, DESIGN.md
 * "Prüfmarkierung"). After confirming, the focus goes to the control of the field.
 */
export function ReviewMark({
  field,
  disabled,
  onConfirm,
}: {
  field: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  return (
    <span className="flex items-center gap-2">
      <Badge variant="warn">{TEXTS.toReview}</Badge>
      <button
        type="button"
        aria-label={TEXTS.confirmField(field)}
        disabled={disabled}
        className="cursor-pointer text-label text-primary"
        onClick={(event) => {
          // The mark sits in the label line of its form field (CU-057), the control below it.
          const formField = event.currentTarget.parentElement?.parentElement?.parentElement;
          onConfirm();
          formField?.querySelector<HTMLElement>('input, select, textarea')?.focus();
        }}
      >
        {TEXTS.confirm}
      </button>
    </span>
  );
}

export const optionValue = (id: number | null) => (id === null ? '' : String(id));
export const idOf = (value: string) => (value === '' ? null : Number(value));

/** The search term the hit list is asked for: from 2 characters after trimming (2.4). */
function searchTermOf(input: string): string | undefined {
  const result = modelTemplateSearchTermSchema.safeParse(input);
  return result.success ? result.data : undefined;
}

/** "<Hersteller> <Modellbezeichnung> (<Typbezeichnung>) · <Geräteart> · Herstellernummer <Nr>". */
function templateLine(template: ModelTemplateListItem): string {
  const type = template.typeDesignation === null ? '' : ` (${template.typeDesignation})`;
  const mpn = template.mpnUnknown ? TEXTS.mpnUnknown : (template.mpn ?? '');
  return (
    `${template.manufacturer.name} ${template.modelName}${type} · ${template.deviceType.name}` +
    ` · ${TEXTS.mpn} ${mpn}`
  );
}

/**
 * The model template UI-007 handed back, as the hit list names it: the names of device type and
 * manufacturer from their lists, which hold inactive entries too (DER-54-07, DER-54-14).
 */
function listItemOf(
  template: ModelTemplate,
  deviceTypes: readonly { id: number; name: string }[],
  manufacturers: readonly { id: number; name: string }[],
): ModelTemplateListItem | null {
  const deviceType = deviceTypes.find(({ id }) => id === template.deviceTypeId);
  const manufacturer = manufacturers.find(({ id }) => id === template.manufacturerId);
  if (deviceType === undefined || manufacturer === undefined) return null;
  return {
    id: template.id,
    deviceType: { id: deviceType.id, name: deviceType.name },
    manufacturer: { id: manufacturer.id, name: manufacturer.name },
    modelName: template.modelName,
    typeDesignation: template.typeDesignation,
    mpn: template.mpn,
    mpnUnknown: template.mpnUnknown,
  };
}

/** The text of `wi_nr_taken` with "Gerät <WI-Nr>" as link to the device (design v0.6.9). */
function wiNrTakenError(error: ApiError): ReactNode {
  const message = error.error?.message ?? '';
  const deviceId = error.error?.details.deviceId;
  const match = /^(.*?)(Gerät \S+)(.*)$/su.exec(message);
  if (typeof deviceId !== 'number' || match === null) return message;
  const [, before = '', device = '', after = ''] = match;
  return (
    <>
      {before}
      <Link to={`/geraete/${deviceId}`} className="text-primary">
        {device}
      </Link>
      {after}
    </>
  );
}

/** The label of a value of a pick list, read from its list. */
function PickListLabel({ pickListId, valueId }: { pickListId: number | null; valueId: number }) {
  const values = usePickListValuesQuery(pickListId);
  return <>{values.data?.items.find(({ id }) => id === valueId)?.label ?? ''}</>;
}

/** The id of a pick list by its key, e.g. `port_type`. */
function listIdOf(lists: readonly PickList[] | undefined, key: string) {
  return lists?.find((list) => list.key === key)?.id ?? null;
}

/** "2 × USB-C vorn, 1 × HDMI" from the lists port type and port position. */
function PortsLabel({ entries }: { entries: readonly PortEntry[] }) {
  const lists = usePickListsQuery();
  const listId = (key: string) => listIdOf(lists.data?.items, key);
  return (
    <>
      {entries.map(({ count, typeId, positionId }, index) => (
        <span key={index}>
          {index > 0 && ', '}
          {count} × <PickListLabel pickListId={listId('port_type')} valueId={typeId} />
          {positionId !== null && (
            <>
              {' '}
              <PickListLabel pickListId={listId('port_position')} valueId={positionId} />
            </>
          )}
        </span>
      ))}
    </>
  );
}

/** A stored value of the level model as the panel shows it, read only. */
function ModelValue({ attribute, value }: { attribute: Attribute; value: unknown }) {
  const withUnit = (text: string) =>
    formatWithUnit(text, attribute.unit ?? '', attribute.unitSpacing);
  switch (attribute.dataType) {
    case 'pick':
      return <PickListLabel pickListId={attribute.pickListId} valueId={value as number} />;
    case 'ports':
      return <PortsLabel entries={value as PortEntry[]} />;
    case 'boolean':
      return <>{formatYesNo(value as boolean)}</>;
    case 'integer':
    case 'decimal':
      return <>{withUnit(formatNumber(value as number | string))}</>;
    default:
      return <>{withUnit(String(value))}</>;
  }
}

/** The active attributes of the level model with a value in the model template, in their order. */
function modelDataRows(
  attributes: readonly Attribute[] | undefined,
  template: ModelTemplate | undefined,
) {
  return (attributes ?? []).filter(
    ({ id, level, active }) =>
      level === 'model' && active && template?.modelValues[String(id)] !== undefined,
  );
}

/** The pick lists whose values the panel "Modelldaten" shows as labels. */
function modelDataPickListIds(rows: readonly Attribute[], lists: readonly PickList[] | undefined) {
  const ids = rows.flatMap(({ dataType, pickListId }) =>
    dataType === 'ports'
      ? [listIdOf(lists, 'port_type'), listIdOf(lists, 'port_position')]
      : [pickListId],
  );
  return [...new Set(ids.filter((id) => id !== null))];
}

/**
 * Panel "Modelldaten (nur lesen)": the values of the active attributes of the level model of the
 * chosen model template, in the order of the attributes, without review flag (DER-54-02). The
 * page reads the same queries and shows their errors (2.0.7).
 */
export function ModelDataPanel({
  templateId,
  deviceTypeId,
}: {
  templateId: number;
  deviceTypeId: number;
}) {
  const headingId = useId();
  const template = useModelTemplateQuery(templateId);
  const attributes = useAttributesQuery(deviceTypeId);
  const rows = modelDataRows(attributes.data?.items, template.data);
  return (
    <aside
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-2 self-start rounded-control border border-border bg-surface p-6"
    >
      <h2 id={headingId} className="m-0 border-b border-border pb-4 text-section font-semibold">
        {TEXTS.modelData}
      </h2>
      <dl className="m-0 flex flex-col">
        {rows.map((attribute) => (
          <div
            key={attribute.id}
            className="flex justify-between gap-4 border-b border-border py-2 text-body"
          >
            <dt className="text-text-secondary">{attribute.label}</dt>
            <dd className="m-0 text-right [overflow-wrap:anywhere]">
              <ModelValue
                attribute={attribute}
                value={template.data?.modelValues[String(attribute.id)]}
              />
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

export const CARD =
  'flex min-w-0 flex-col gap-4 rounded-control border border-border bg-surface p-6';
export const CARD_HEADING = 'm-0 text-section font-semibold';
export const TEXT_AREA_CLASS = cn(
  'w-full min-w-0 rounded-control bg-surface px-2 py-1 ring-1 ring-border-input ring-inset',
  'text-body text-text aria-invalid:ring-error disabled:bg-bg',
);

/**
 * Device intake UI-003 (CU-132, REQ-012; Technical Specification 2.5): WI-Nr, supplier (only
 * active ones), model template search with hit list and the chosen template, the card
 * "Gerätewerte" after the choice with condition (only active values), visual grade and condition
 * description, the panel "Modelldaten" and the actions "Gerät speichern" (Ctrl+S) and "Speichern
 * und zuordnen" (Ctrl+Enter). States: default (focus in WI-Nr), validation with the error summary
 * at the top and `wi_nr_taken` at the WI-Nr, success, error, ausgang-unbekannt (P-08), conflict
 * (P-05), unreachable (P-06) for the reads and wird-beendet (P-07). After
 * `supplier_deactivated` or `pick_list_value_deactivated` every choice whose entry is missing
 * after the reload is emptied with its text (2.0.11, design v0.6.8, DER-54-16, DER-56-10). The card
 * "Gerätewerte" holds a field per attribute of the level device (CU-111), the battery capacity
 * only while the battery value carries "Akku vorhanden". After the choice of a model template the
 * card loads the prefill (loading, DER-55-01) and marks each prefilled field with "zu prüfen" and
 * "Bestätigen"; the status line counts the open flags and "Speichern und zuordnen" stays
 * deactivated while one is open (disabled, DER-55-02 to DER-55-04). "Neue Modellvorlage anlegen"
 * keeps the inputs in the draft (CU-133) and opens UI-007; on the return the inputs are restored
 * and the model template UI-007 hands back is chosen, while the card "Gerätewerte" shows loading
 * (DER-54-07, DER-54-14), with the banner "Modellvorlage gespeichert" after a save in UI-007.
 * With "Weiteres Gerät derselben Modellvorlage" (on by default) "Gerät speichern" empties the form
 * when no value is left to review and keeps the model template (DER-54-08). The condition code
 * (#193) and the dialog UI-004 (#189) follow.
 */
export function DeviceIntakePage() {
  const suppliers = useSuppliersQuery();
  const pickLists = usePickListsQuery();
  const conditionListId =
    pickLists.data?.items.find((list) => list.key === 'condition')?.id ?? null;
  const conditions = usePickListValuesQuery(conditionListId);
  const createMutation = useCreateDeviceMutation();
  const writesLocked = useWritesLocked();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // The draft left for UI-007, read once on opening and then removed (CU-133, DER-54-07).
  const [restored] = useState(() => readDeviceIntakeDraft<Draft>());
  useEffect(() => clearDeviceIntakeDraft(), []);
  // A field the stored inputs lack starts empty.
  const [draft, setDraft] = useState<Draft>(() => ({ ...EMPTY_DRAFT, ...restored?.form }));
  // The model template UI-007 handed back, chosen once it is read (DER-54-07, DER-54-14).
  const [returnedTemplateId, setReturnedTemplateId] = useState(restored?.modelTemplateId ?? null);
  // The success banner of UI-007 after "Modellvorlage speichern", taken from the history entry
  // once, as UI-006 does (UI-007 "Aktionen": calling page).
  const [templateSavedNotice, setTemplateSavedNotice] = useState(
    () => (location.state as SavedNoticeState | null)?.savedNotice ?? null,
  );
  useEffect(() => {
    if (location.state !== null) void navigate('.', { replace: true, state: null });
  }, [location.state, navigate]);
  // "Weiteres Gerät derselben Modellvorlage", on by default; only state of the page (2.5).
  const [nextDevice, setNextDevice] = useState(true);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const template = draft.modelTemplate;

  // The attributes of the device type of the model template and the values of the list battery,
  // for the fields of the card "Gerätewerte" and the rule of the battery capacity (2.5).
  const attributesQuery = useAttributesQuery(template?.deviceType.id ?? null);
  const batteryListId =
    attributesQuery.data?.items.find(({ systemRole }) => systemRole === 'battery')?.pickListId ??
    null;
  const batteryValuesQuery = usePickListValuesQuery(batteryListId);
  // The prefill of the chosen model template, taken into the form once (REQ-013, 2.5).
  const prefillQuery = useDevicePrefillQuery(template?.id ?? null);
  const [prefilledFor, setPrefilledFor] = useState<number | null>(null);
  useEffect(() => {
    const prefill = prefillQuery.data;
    const attributes = attributesQuery.data?.items;
    if (template === null || prefilledFor === template.id) return;
    if (prefill === undefined || attributes === undefined) return;
    setDraft((previous) => prefilledDraft(previous, prefill, attributes));
    setPrefilledFor(template.id);
  }, [template, prefilledFor, prefillQuery.data, attributesQuery.data]);
  // The reads of the panel "Modelldaten", here for their errors (2.0.7); before, the model
  // template handed back by UI-007 with the lists that name it.
  const templateQuery = useModelTemplateQuery(returnedTemplateId ?? template?.id ?? null);
  const deviceTypes = useDeviceTypesQuery();
  const manufacturers = useManufacturersQuery();
  // Also replaces a model template chosen before UI-007 opened.
  const returning = returnedTemplateId !== null;
  const modelDataLists = usePickListValuesQueries(
    modelDataPickListIds(
      modelDataRows(attributesQuery.data?.items, templateQuery.data),
      pickLists.data?.items,
    ),
  );
  const device: DeviceAttributes | null =
    template === null || attributesQuery.data === undefined
      ? null
      : {
          attributes: attributesQuery.data.items,
          batteryValues: batteryValuesQuery.data?.items ?? [],
        };
  const deviceRef = useRef(device);
  deviceRef.current = device;
  const attributeFields = device === null ? [] : shownAttributes(device, draft.values);
  const [errors, setErrors] = useState<FieldErrors>({});
  // The error summary shows after a save, built from the field errors still shown (2.0.5).
  const [summaryShown, setSummaryShown] = useState(false);
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  const [savedWiNr, setSavedWiNr] = useState<string | null>(null);
  // The device saved with "Speichern und zuordnen" while UI-004 is open for it (DER-55-05).
  const [assigning, setAssigning] = useState<AssignDialogDevice | null>(null);
  // Choices that show the text of a rejection until the next choice in the field (v0.6.8).
  const [rejectionShown, setRejectionShown] = useState<Partial<Record<string, boolean>>>({});
  // A rejected entry whose list could not be read again counts as missing (2.0.11).
  const [droppedSupplier, setDroppedSupplier] = useState<number | null>(null);
  const [droppedValues, setDroppedValues] = useState<ReadonlySet<number>>(new Set());
  const [reloading, setReloading] = useState(false);
  // The inputs of the last request the server rejected with field errors.
  const answeredDraftRef = useRef<Draft | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState<string | undefined>(undefined);
  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchTermOf(searchInput)), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const search = useModelTemplatesQuery({ q: searchTerm }, { enabled: searchTerm !== undefined });
  const hits = draft.modelTemplate === null && searchTerm !== undefined ? search.data?.items : [];

  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const hitsRef = useRef<HTMLUListElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const blurCheck = useDeferredBlurCheck();

  // `Input` and `Select` pass no ref on, so the page finds them in the card "Gerät". Focus in
  // WI-Nr on opening (UI-003 "Fenstergröße und Bedienung", DER-54-01).
  const deviceCardRef = useRef<HTMLElement>(null);
  useEffect(() => deviceCardRef.current?.querySelector('input')?.focus(), []);

  const activeSuppliers = (suppliers.data?.items ?? []).filter(
    ({ id, active }) => active && id !== droppedSupplier,
  );
  const activeConditions = (conditions.data?.items ?? []).filter(
    ({ id, active }) => active && !droppedValues.has(id),
  );

  const saving = createMutation.isPending;
  // Until the suppliers are read again after a rejection, a save could send the rejected id;
  // until the model template of UI-007 is chosen, it would be missing.
  const canSave = !saving && !writesLocked && !reloading && !returning;

  function change(next: Partial<Draft>) {
    setDraft((previous) => ({ ...previous, ...next }));
  }

  function setError(path: string, error: ReactNode) {
    setErrors((previous) => ({ ...previous, [path]: error }));
  }

  /** A new choice in a field ends the text of a rejection there (v0.6.8). */
  function endRejection(path: string) {
    if (!rejectionShown[path]) return;
    setError(path, undefined);
    setRejectionShown((previous) => ({ ...previous, [path]: false }));
  }

  /** Checks the field `path` (a fixed field or `values.<id>`) on leaving it. */
  function checkOnBlur(path: string) {
    if (rejectionShown[path]) return;
    const current = draftRef.current;
    // An error of the server (e.g. `wi_nr_taken`) the browser cannot check stays until the
    // value changes.
    const answered = answeredDraftRef.current;
    if (answered !== null && fieldValue(answered, path) === fieldValue(current, path)) return;
    blurCheck.checkOnBlur(() => setError(path, checkAll(current, deviceRef.current)[path]));
  }

  /**
   * The input of an attribute. When the field "Akkukapazität" goes with the battery value, its
   * value and error go with it, so it shows empty when it appears again (2.0.11, 2.5).
   */
  function changeAttribute(attributeId: number, input: AttributeInputValue) {
    const entered = { ...draftRef.current.values, [attributeId]: input };
    const values = device === null ? entered : withCapacityOfBattery(device, entered);
    // Changing a value lifts its review flag (DER-55-04), also of the capacity that goes.
    const changed = [String(attributeId)];
    const capacity = device === null ? undefined : capacityAttribute(device);
    if (capacity !== undefined && values !== entered) {
      setError(valuePath(capacity.id), undefined);
      changed.push(String(capacity.id));
    }
    change({ values, ...withConfirmed(draftRef.current, changed) });
    endRejection(valuePath(attributeId));
  }

  /** "Bestätigen" lifts the review flag of a field with its value unchanged (AC-REQ-013-02). */
  function confirm(key: string) {
    change(withConfirmed(draftRef.current, [key]));
  }

  /** The values of the attributes and their errors go with the model template (DER-54-01). */
  function withoutValueErrors(previous: FieldErrors): FieldErrors {
    return Object.fromEntries(
      Object.entries(previous).filter(([path]) => !path.startsWith('values.')),
    );
  }

  function chooseSupplier(value: string) {
    change({ supplierId: idOf(value) });
    setError('supplierId', undefined);
    setRejectionShown((previous) => ({ ...previous, supplierId: false }));
  }

  function chooseTemplate(chosen: ModelTemplateListItem) {
    // The values of the attributes stay only with the same device type (DER-54-07).
    const sameType = draftRef.current.modelTemplate?.deviceType.id === chosen.deviceType.id;
    change({
      modelTemplate: chosen,
      ...(!sameType && { values: {} }),
      reviewKeys: [],
      confirmedKeys: [],
    });
    setPrefilledFor(null);
    setErrors((previous) => ({ ...withoutValueErrors(previous), modelTemplateId: undefined }));
    setSearchInput('');
    setSearchTerm(undefined);
    setReturnFailed(null);
  }

  // The model template handed back by UI-007 is chosen like a hit once it and the names of its
  // device type and manufacturer are read; the other inputs stay (DER-54-07, DER-54-14).
  const chooseTemplateRef = useRef(chooseTemplate);
  chooseTemplateRef.current = chooseTemplate;
  useEffect(() => {
    if (returnedTemplateId === null || templateQuery.data?.id !== returnedTemplateId) return;
    if (deviceTypes.data === undefined || manufacturers.data === undefined) return;
    const item = listItemOf(templateQuery.data, deviceTypes.data.items, manufacturers.data.items);
    if (item === null) return;
    chooseTemplateRef.current(item);
    setReturnedTemplateId(null);
  }, [returnedTemplateId, templateQuery.data, deviceTypes.data, manufacturers.data]);
  // If one of these reads fails (`.error`), the return is given up: the search and the choice
  // show again and the error banner stays until a model template is chosen; the inputs stay.
  // When the server is unreachable, "Erneut versuchen" reads them again (2.0.7).
  const [returnFailed, setReturnFailed] = useState<ApiError | null>(null);
  const returnError = returning
    ? [templateQuery.error, deviceTypes.error, manufacturers.error].find(
        (error) => error !== null && error.kind !== 'unreachable',
      )
    : undefined;
  useEffect(() => {
    if (returnError === undefined) return;
    setReturnFailed(returnError);
    setReturnedTemplateId(null);
  }, [returnError]);

  /** "Neue Modellvorlage anlegen": the inputs stay in the draft while UI-007 is open (2.5). */
  function openNewModelTemplate() {
    blurCheck.cancel();
    storeDeviceIntakeDraft(draftRef.current);
  }

  /** Arrow down from the search field moves to the first hit, up and down between the hits. */
  function onHitsKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const buttons = Array.from(hitsRef.current?.querySelectorAll('button') ?? []);
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? buttons[index + 1] : buttons[index - 1];
    if (next === undefined) return;
    event.preventDefault();
    next.focus();
  }

  function showServerErrors(next: FieldErrors) {
    answeredDraftRef.current = draftRef.current;
    showFieldErrors(next);
  }

  function showFieldErrors(next: FieldErrors) {
    setErrors(next);
    setSummaryShown(true);
    focusFirstError();
  }

  function onFailed(error: ApiError) {
    if (error.kind === 'validation') {
      const next: FieldErrors = {};
      for (const { path, message } of error.error?.fields ?? []) next[path] ??= message;
      if (inFormOrder(next).length > 0) {
        showServerErrors(next);
        return;
      }
    }
    const code = error.error?.code;
    if (error.kind === 'rejected' && code === 'wi_nr_taken') {
      showServerErrors({ wiNr: wiNrTakenError(error) });
      return;
    }
    // A supplier, condition or pick list value deactivated in another window: the text stands
    // at the field of `details.path` and in the summary, the choices are read again (2.0.11,
    // design v0.6.8).
    const { path, id } = error.error?.details ?? {};
    const deactivatedAt =
      (code === 'supplier_deactivated' && path === 'supplierId') ||
      isDeactivatedValueAt(code, path);
    if (error.kind === 'rejected' && deactivatedAt && typeof path === 'string') {
      const text = error.error?.message;
      showServerErrors({ [path]: text });
      setRejectionShown({ [path]: true });
      if (typeof id === 'number') void reloadAfterRejection(path, id, text);
      return;
    }
    setNotice(noticeOf(error));
  }

  /**
   * Reads the suppliers and the pick lists again and checks every choice of the form at the end of
   * the reload, also one made meanwhile (2.0.11 "Erkennen nach dem Neuladen", 2.4 "Wahl während
   * des Neuladens", addendum MAR-963, DER-54-16, DER-56-10): supplier, condition and the pick
   * list values of the attributes, each against its own list. A choice the new list no longer
   * offers is emptied (required field: "Bitte wählen", optional field: the empty choice, value
   * `null`; without the battery value the battery capacity goes too) and carries the text of its
   * usage with the name before the reload, so its id is never sent; an empty field is not
   * checked. If the list of the rejected entry cannot be read, only the rejected id counts as
   * missing, and it leaves the choice. The focus goes to the first marked field.
   */
  async function reloadAfterRejection(
    rejectedPath: string,
    rejectedId: number,
    rejectedText: string | undefined,
  ) {
    setReloading(true);
    const toItems = (list: typeof suppliers.data): ChoiceItem[] | undefined =>
      list?.items.map(({ id, name, active }) => ({ id, label: name, active }));
    const before = toItems(suppliers.data) ?? [];
    const [reloaded, lists] = await Promise.all([
      suppliers.refetch(),
      reloadPickListValues(queryClient),
    ]);
    const current = draftRef.current;
    const chosen = current.supplierId;
    const supplierRejected = rejectedPath === 'supplierId';
    if (reloaded.isError && supplierRejected) setDroppedSupplier(rejectedId);
    const supplierMissing = reloaded.isError
      ? supplierRejected && chosen === rejectedId
        ? [{ path: 'supplierId', id: rejectedId, message: rejectedText ?? '' }]
        : []
      : findMissingChoices(
          [
            {
              path: 'supplierId',
              id: chosen,
              storedId: null,
              before,
              message: ERROR_MESSAGES['supplier_deactivated.device'],
            },
          ],
          { supplierId: toItems(reloaded.data) },
        );
    const device = deviceRef.current;
    const valuesMissing =
      device === null
        ? []
        : findMissingListChoices(
            deviceValueChoices(device, current, {
              conditionListId,
              ports: portListIds(pickLists.data?.items),
            }),
            lists,
            { path: rejectedPath, id: rejectedId },
          );
    const dropped = droppedAfterReload(lists, rejectedId);
    if (dropped.length > 0) setDroppedValues((previous) => new Set([...previous, ...dropped]));

    const texts: FieldErrors = {};
    for (const { path, message } of [...supplierMissing, ...valuesMissing]) texts[path] ??= message;
    if (Object.keys(texts).length > 0) {
      const next =
        device === null ? current : withoutMissingChoices(device, current, valuesMissing);
      // The error of a battery capacity that went with its battery value goes with it.
      const capacity = device === null ? undefined : capacityAttribute(device);
      if (capacity !== undefined && device !== null && !batteryCapacityShown(device, next.values)) {
        texts[valuePath(capacity.id)] = undefined;
      }
      change({
        ...(supplierMissing.length > 0 && { supplierId: null }),
        conditionValueId: next.conditionValueId,
        values: next.values,
      });
      setErrors((previous) => ({ ...previous, ...texts }));
      setRejectionShown((previous) => ({
        ...previous,
        ...Object.fromEntries(
          Object.entries(texts).flatMap(([path, text]) => (text ? [[path, true]] : [])),
        ),
      }));
      focusFirstError();
    }
    setReloading(false);
  }

  /** "Gerät speichern", or with `assign` "Speichern und zuordnen", which then opens UI-004. */
  function save({ assign = false } = {}) {
    // The save checks the fields itself; a later check on leaving must not hide its result.
    blurCheck.cancel();
    if (!canSave) return;
    const current = draftRef.current;
    const found = checkAll(current, deviceRef.current);
    answeredDraftRef.current = null;
    setRejectionShown({});
    if (inFormOrder(found).length > 0) {
      showFieldErrors(found);
      return;
    }
    setErrors({});
    setSummaryShown(false);
    setNotice(null);
    createMutation.mutate(bodyOf(current, deviceRef.current), {
      onSuccess: (device) => {
        setSavedWiNr(device.wiNr);
        setNotice({ kind: 'success' });
        // Only "Gerät speichern" empties the form, once no value is left to review; the answer
        // counts, as the server builds the review flags again (DER-54-08, 2.0.11, 2.5).
        if (!assign && nextDeviceRef.current && device.captureStatus === 'checked') {
          emptyForNextDevice();
        }
        // UI-004 for the saved device (DER-55-05, 7.3); it rejects a device the server still
        // flags with "Erst Werte prüfen" (AC-REQ-013-03).
        if (assign && current.modelTemplate !== null) {
          setAssigning({
            id: device.id,
            version: device.version,
            wiNr: device.wiNr,
            modelTemplateId: device.modelTemplateId,
            modelTemplateLabel: current.modelTemplate.modelName,
          });
        }
      },
      onError: onFailed,
    });
  }

  // The choice at the time of the answer counts, so the check box is read through a ref.
  const nextDeviceRef = useRef(nextDevice);
  nextDeviceRef.current = nextDevice;

  /**
   * After "Gerät speichern" with "Weiteres Gerät derselben Modellvorlage": the form is emptied,
   * the model template stays chosen for the next device, and the focus goes to WI-Nr (DER-54-08).
   */
  function emptyForNextDevice() {
    setDraft((previous) => ({ ...EMPTY_DRAFT, modelTemplate: previous.modelTemplate }));
    // The next device gets the prefill of the model template again (REQ-013).
    setPrefilledFor(null);
    setErrors({});
    setSummaryShown(false);
    answeredDraftRef.current = null;
    setFocusWiNr(true);
  }

  // The fields are locked while the save runs, so WI-Nr takes the focus once it is over.
  const [focusWiNr, setFocusWiNr] = useState(false);
  useEffect(() => {
    if (!focusWiNr || saving) return;
    deviceCardRef.current?.querySelector('input')?.focus();
    setFocusWiNr(false);
  }, [focusWiNr, saving]);

  // Ctrl+S saves the device, Ctrl+Enter saves and assigns (UI-003 "Aktionen").
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey;
      if (!ctrl || (event.key.toLowerCase() !== 's' && event.key !== 'Enter')) return;
      event.preventDefault();
      // "Speichern und zuordnen" waits while values are to be reviewed (UI-003.disabled).
      if (event.key === 'Enter' && openReviewKeys(draftRef.current).length > 0) return;
      saveRef.current({ assign: event.key === 'Enter' });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // A failed read shows P-06 or the error banner; the inputs stay (2.0.7).
  const readErrors = [
    suppliers.error,
    pickLists.error,
    conditions.error,
    attributesQuery.error,
    batteryValuesQuery.error,
    templateQuery.error,
    prefillQuery.error,
    ...(returning ? [deviceTypes.error, manufacturers.error] : []),
    returnFailed,
    ...modelDataLists.map(({ error }) => error),
    search.error,
  ];
  const unreachable = readErrors.some((error) => error?.kind === 'unreachable');
  const readFailed = readErrors.find((error) => error !== null && error.kind !== 'unreachable');
  const summary = summaryShown ? inFormOrder(errors, attributeFields) : [];
  // Loading until the prefill is in the form (DER-55-01), unless a read failed (2.0.7).
  const prefillPending =
    template !== null &&
    prefilledFor !== template.id &&
    prefillQuery.error === null &&
    attributesQuery.error === null;
  const valuesLoading =
    (returning && templateQuery.error === null) ||
    (conditions.isPending && conditionListId !== null) ||
    (attributesQuery.isPending && attributesQuery.error === null) ||
    prefillPending;
  const openKeys = openReviewKeys(draft);
  const fieldOf = (key: string) =>
    key === 'condition'
      ? TEXTS.condition
      : key === 'visualGrade'
        ? TEXTS.visualGrade
        : (attributesQuery.data?.items.find(({ id }) => String(id) === key)?.label ?? key);
  const reviewMark = (key: string, field: string) =>
    openKeys.includes(key) ? (
      <ReviewMark field={field} disabled={saving} onConfirm={() => confirm(key)} />
    ) : null;
  const reviewShown = template !== null && !valuesLoading;
  const reviewHintId = useId();

  // Opens UI-007 with UI-003 as calling page; the inputs stay in the draft (UI-003 "Aktionen").
  // Locked like the other triggers while the save runs (P-08, 2.0.7 `.speichert`).
  const newTemplateLink = saving ? (
    <a
      role="link"
      aria-disabled="true"
      className="self-start cursor-not-allowed text-body text-text-secondary"
    >
      {TEXTS.newModelTemplate}
    </a>
  ) : (
    <Link
      to={MODEL_TEMPLATE_NEW_PATH}
      state={FROM_DEVICE_INTAKE}
      className="self-start text-body text-primary no-underline"
      onClick={openNewModelTemplate}
    >
      {TEXTS.newModelTemplate}
    </Link>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-page-title font-semibold">{TEXTS.title}</h1>
          <p className="m-0 text-body text-text-secondary">{TEXTS.requiredHint}</p>
        </div>

        <OutcomeUnknownBanner />
        {templateSavedNotice !== null && (
          <PageBanner variant="success" onClose={() => setTemplateSavedNotice(null)}>
            {templateSavedNotice}
          </PageBanner>
        )}
        {unreachable && <UnreachableBanner />}
        {readFailed && (
          <PageBanner variant="error" error={readFailed}>
            {TEXTS.error}
          </PageBanner>
        )}
        <SaveNoticeBanners
          notice={notice}
          onClose={() => setNotice(null)}
          onReloaded={() => setNotice(null)}
          successText={savedWiNr === null ? undefined : TEXTS.saved(savedWiNr)}
          errorText={TEXTS.error}
        />
        {summary.length > 0 && (
          <div
            role="alert"
            className="rounded-control border border-error bg-error-bg px-4 py-2 text-body text-error"
          >
            <ul className="m-0 flex list-disc flex-col gap-1 pl-4">
              {summary.map(([path, error]) => (
                <li key={path}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 full:grid-cols-[minmax(0,1fr)_22rem]">
          <form
            id={formId}
            ref={formRef}
            aria-label={TEXTS.title}
            noValidate
            className="flex min-w-0 flex-col gap-6"
            onPointerDown={blurCheck.pressPointer}
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <section ref={deviceCardRef} aria-label={TEXTS.device} className={CARD}>
              <h2 className={CARD_HEADING}>{TEXTS.device}</h2>
              <div className="grid grid-cols-1 gap-4 full:grid-cols-3">
                <FormField label={TEXTS.wiNr} required error={errors.wiNr}>
                  {(control) => (
                    <Input
                      {...control}
                      value={draft.wiNr}
                      autoComplete="off"
                      disabled={saving}
                      onChange={(event) => change({ wiNr: event.target.value })}
                      onBlur={() => checkOnBlur('wiNr')}
                      onKeyDown={(event) => {
                        // Enter in WI-Nr moves to the supplier (UI-003).
                        if (event.key !== 'Enter' || event.ctrlKey || event.metaKey) return;
                        event.preventDefault();
                        deviceCardRef.current?.querySelector('select')?.focus();
                      }}
                    />
                  )}
                </FormField>
                <FormField label={TEXTS.supplier} error={errors.supplierId}>
                  {(control) => (
                    <Select
                      {...control}
                      value={optionValue(draft.supplierId)}
                      disabled={saving}
                      onChange={(event) => chooseSupplier(event.target.value)}
                      onBlur={() => checkOnBlur('supplierId')}
                    >
                      {/* Optional: the empty choice is "kein Lieferant", without placeholder. */}
                      <option value="" />
                      {activeSuppliers.map(({ id, name }) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
              </div>
            </section>

            <section aria-label={TEXTS.modelTemplate} className={CARD}>
              <h2 className={CARD_HEADING}>{TEXTS.modelTemplate}</h2>
              {returning ? null : template === null ? (
                <div className="flex flex-col gap-2" onKeyDown={onHitsKeyDown}>
                  <FormField
                    label={TEXTS.modelTemplateSearch}
                    required
                    error={errors.modelTemplateId}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        type="search"
                        autoComplete="off"
                        value={searchInput}
                        disabled={saving}
                        onChange={(event) => setSearchInput(event.target.value)}
                      />
                    )}
                  </FormField>
                  {hits !== undefined && hits.length > 0 && (
                    <ul
                      ref={hitsRef}
                      aria-label={TEXTS.modelTemplate}
                      className="m-0 flex list-none flex-col rounded-control border border-border p-0"
                    >
                      {hits.map((hit) => (
                        <li key={hit.id} className="border-b border-border last:border-b-0">
                          <button
                            type="button"
                            className="w-full cursor-pointer px-4 py-2 text-left text-body hover:bg-bg focus:bg-bg"
                            onClick={() => chooseTemplate(hit)}
                          >
                            {templateLine(hit)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {newTemplateLink}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p
                    data-testid="chosen-model-template"
                    className="m-0 rounded-control border border-primary bg-bg px-4 py-2 text-body"
                  >
                    {templateLine(template)}
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      className="cursor-pointer text-body text-primary"
                      disabled={saving}
                      onClick={() => {
                        change({
                          modelTemplate: null,
                          values: {},
                          reviewKeys: [],
                          confirmedKeys: [],
                        });
                        setPrefilledFor(null);
                        setErrors(withoutValueErrors);
                      }}
                    >
                      {TEXTS.otherModelTemplate}
                    </button>
                    <span aria-hidden="true" className="h-4 border-l border-border" />
                    {newTemplateLink}
                  </div>
                </div>
              )}
            </section>

            {(template !== null || returning) && (
              <section aria-label={TEXTS.deviceValues} className={CARD}>
                <h2 className={CARD_HEADING}>{TEXTS.deviceValues}</h2>
                {valuesLoading ? (
                  <p role="status" className="m-0 text-body text-text-secondary">
                    {TEXTS.loadingValues}
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 full:grid-cols-3">
                      <FormField
                        label={TEXTS.condition}
                        required
                        error={errors.conditionValueId}
                        aside={reviewMark('condition', TEXTS.condition)}
                      >
                        {(control) => (
                          <Select
                            {...control}
                            value={optionValue(draft.conditionValueId)}
                            disabled={saving}
                            onChange={(event) => {
                              change({
                                conditionValueId: idOf(event.target.value),
                                ...withConfirmed(draftRef.current, ['condition']),
                              });
                              setError('conditionValueId', undefined);
                              setRejectionShown((previous) => ({
                                ...previous,
                                conditionValueId: false,
                              }));
                            }}
                            onBlur={() => checkOnBlur('conditionValueId')}
                          >
                            <option value="" disabled>
                              {TEXTS.choose}
                            </option>
                            {activeConditions.map(({ id, label }) => (
                              <option key={id} value={id}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        )}
                      </FormField>
                      <FormField
                        label={TEXTS.visualGrade}
                        required
                        error={errors.visualGrade}
                        aside={reviewMark('visualGrade', TEXTS.visualGrade)}
                      >
                        {(control) => (
                          <Input
                            {...control}
                            inputMode="numeric"
                            autoComplete="off"
                            value={draft.visualGrade}
                            disabled={saving}
                            onChange={(event) =>
                              change({
                                visualGrade: event.target.value,
                                ...withConfirmed(draftRef.current, ['visualGrade']),
                              })
                            }
                            onBlur={() => checkOnBlur('visualGrade')}
                          />
                        )}
                      </FormField>
                      {device !== null && (
                        <AttributeFieldsForm
                          attributes={attributeFields}
                          level="device"
                          inputs={draft.values}
                          errors={attributeErrors(errors)}
                          withRequired
                          dropped={droppedValues}
                          disabled={saving}
                          onChange={changeAttribute}
                          onBlur={(attributeId) => checkOnBlur(valuePath(attributeId))}
                          reviewMark={({ id, label }) => reviewMark(String(id), label)}
                        />
                      )}
                    </div>
                    <FormField
                      label={TEXTS.conditionDescription}
                      error={errors.conditionDescription}
                    >
                      {(control) => (
                        <textarea
                          {...control}
                          rows={3}
                          value={draft.conditionDescription}
                          disabled={saving}
                          onChange={(event) => change({ conditionDescription: event.target.value })}
                          onBlur={() => checkOnBlur('conditionDescription')}
                          className={TEXT_AREA_CLASS}
                        />
                      )}
                    </FormField>
                  </>
                )}
              </section>
            )}
          </form>

          {template !== null && (
            <ModelDataPanel templateId={template.id} deviceTypeId={template.deviceType.id} />
          )}
        </div>
      </div>

      {/* The action bar stays visible below the scrolling form (DESIGN.md "Fenstergröße"). */}
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-4 border-t border-border bg-surface px-6 py-4">
        {reviewShown && (
          <div aria-live="polite" className="mr-auto flex min-w-0 flex-col gap-1 text-body">
            {openKeys.length > 0 ? (
              <>
                <p className="m-0 flex items-start gap-2 text-flag-warn">
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-1 size-4 shrink-0">
                    <path
                      d="M8 1.5 15 14.5H1L8 1.5Zm0 4.5v4m0 2v.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                  {TEXTS.reviewOpen(openKeys.length)}
                </p>
                <p id={reviewHintId} className="m-0 text-label text-text-secondary">
                  {`${TEXTS.reviewFirst}: ${openKeys.map(fieldOf).join(', ')}`}
                </p>
              </>
            ) : (
              <p className="m-0">{TEXTS.allReviewed}</p>
            )}
          </div>
        )}
        <Checkbox
          label={TEXTS.nextDevice}
          checked={nextDevice}
          disabled={saving}
          onChange={setNextDevice}
        />
        <Button type="submit" form={formId} disabled={!canSave}>
          {saving ? TEXTS.saving : TEXTS.save}
        </Button>
        {/* Deactivated while values are to be reviewed, with the tooltip (UI-003.disabled). */}
        <span title={openKeys.length > 0 ? TEXTS.reviewFirst : undefined}>
          <Button
            variant="primary"
            disabled={!canSave || openKeys.length > 0}
            title={openKeys.length > 0 ? TEXTS.reviewFirst : undefined}
            aria-describedby={reviewShown && openKeys.length > 0 ? reviewHintId : undefined}
            onClick={() => save({ assign: true })}
          >
            {TEXTS.saveAndAssign}
          </Button>
        </span>
      </div>
      {assigning !== null && (
        <AssignDialog
          open
          device={assigning}
          fieldLabel={fieldOf}
          onOpenChange={(open) => {
            if (!open) setAssigning(null);
          }}
          // The banner "Gerät <WI-Nr> zugeordnet (Stückzahl n)" and the form for the next device
          // follow with #433 (DER-58-04).
          onAssigned={() => {}}
        />
      )}
    </div>
  );
}
