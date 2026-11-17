import { ERROR_MESSAGES } from '@resellr/domain/messages/messages.de';
import type { Attribute } from '@resellr/domain/schemas/attribute.schema';
import {
  type ModelTemplateCreateInput,
  modelTemplateCreateSchema,
  type ModelTemplateMatch,
  modelTemplateValuesSchema,
} from '@resellr/domain/schemas/model-template.schema';
import type { ManufacturerCreateResult } from '@resellr/domain/schemas/manufacturer.schema';
import type { PickListList, PickListValueList } from '@resellr/domain/schemas/pick-list.schema';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import type { ApiError } from '../../api/api-client.ts';
import { possibleDuplicatesOf, useCreateModelTemplateMutation } from '../../api/catalog.api.ts';
import { queryKeys } from '../../api/query-keys.ts';
import {
  useAttributesQuery,
  useDeviceTypesQuery,
  useManufacturersQuery,
} from '../../api/settings.api.ts';
import { useWritesLocked } from '../../api/write-outcome-store.ts';
import {
  AttributeFieldsForm,
  type AttributeInputs,
  attributeRequestValues,
  attributesOfLevel,
} from '../../components/forms/AttributeFieldsForm.tsx';
import type { AttributeInputValue, PortInput } from '../../components/forms/AttributeInput.tsx';
import {
  type ChoiceItem,
  findMissingChoices,
  type MissingChoice,
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
import { Button } from '../../components/ui/Button.tsx';
import { Checkbox } from '../../components/ui/Checkbox.tsx';
import { Input } from '../../components/ui/Input.tsx';
import { Select } from '../../components/ui/Select.tsx';
import { DuplicateDialog } from './DuplicateDialog.tsx';
import { ManufacturerCreateDialog } from './ManufacturerCreateDialog.tsx';

// Texts of UI-007 `screen.md` and its mockup (UI/UX design v0.6.2, v0.6.3 for the empty MPN,
// v0.6.7 for the placeholder and the hint of the attribute areas).
const TEXTS = {
  back: 'Zurück zur Modell-Bibliothek',
  title: 'Modellvorlage anlegen',
  loading: 'Lade Modellvorlage …',
  modelData: 'Modelldaten',
  choose: 'Bitte wählen',
  deviceType: 'Geräteart',
  manufacturer: 'Hersteller',
  modelName: 'Modellbezeichnung',
  typeDesignation: 'Typbezeichnung',
  mpn: 'Herstellernummer',
  mpnUnknown: 'unbekannt',
  originalEan: 'Original-EAN',
  modelAttributes: 'Merkmale Ebene Modell',
  deviceDefaults: 'Vorbelegungswerte für Geräte',
  chooseDeviceType: 'Geräteart wählen, dann erscheinen die Merkmale',
  newManufacturer: 'Neuen Hersteller anlegen',
  /** UI-008 after creating; "GPSR-Herstellerangaben" is the link to UI-031 (DER-50-06). */
  createdHint: {
    before: 'Hersteller angelegt. ',
    link: 'GPSR-Herstellerangaben',
    after: ' fehlen noch; ohne sie ist keine Freigabe möglich.',
  },
  cancel: 'Abbrechen',
  save: 'Modellvorlage speichern',
  saving: 'Speichern …',
  saved: 'Modellvorlage gespeichert',
  error: (referenceNumber: string | null) =>
    `Modellvorlage konnte nicht gespeichert werden. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** The calling page; UI-007 is opened from UI-006 (the call from UI-003 follows with S4). */
const CALLER_PATH = '/modelle';
/** UI-007 for changing a model template, as UI-006 opens it. */
const templatePath = (id: number) => `${CALLER_PATH}/${id}`;

/** UI-031 "Hersteller und GPSR", where the GPSR details are completed. */
const MANUFACTURERS_PATH = '/einstellungen/hersteller';

/** State a calling page takes over after the save: the success banner of UI-007 (DER-50-02). */
export interface SavedNoticeState {
  savedNotice: string;
}

interface Draft {
  deviceTypeId: number | null;
  manufacturerId: number | null;
  modelName: string;
  typeDesignation: string;
  /** The input of the field; sent as `null` with "unbekannt" (2.4). */
  mpn: string;
  mpnUnknown: boolean;
  originalEan: string;
  /** Inputs of the attributes of the level model and of the device defaults (#178). */
  modelValues: AttributeInputs;
  defaultDeviceValues: AttributeInputs;
}

const FIELDS = [
  'deviceTypeId',
  'manufacturerId',
  'modelName',
  'typeDesignation',
  'mpn',
  'originalEan',
] as const;

/** The objects of the attribute values with their level (2.4); fields `<object>.<id>`. */
const VALUE_OBJECTS = [
  { key: 'modelValues', level: 'model' },
  { key: 'defaultDeviceValues', level: 'device' },
] as const;
type ValueObject = (typeof VALUE_OBJECTS)[number]['key'];

/** Field errors by path: a field of the model data or `modelValues.<id>` (2.0.5). */
type FieldErrors = Partial<Record<string, string>>;

const ATTRIBUTE_PATH = /^(modelValues|defaultDeviceValues)\.(\d+)$/;
const isField = (path: string) =>
  (FIELDS as readonly string[]).includes(path) || ATTRIBUTE_PATH.test(path);

/** The choices whose entry the server can reject as deactivated (2.0.11), in form order. */
const CHOICE_FIELDS = ['deviceTypeId', 'manufacturerId'] as const;
type ChoiceField = (typeof CHOICE_FIELDS)[number];
const isChoiceField = (path: string): path is ChoiceField =>
  (CHOICE_FIELDS as readonly string[]).includes(path);

/** Texts of a deactivated entry at its choice in UI-007 (CU-012, `.model_template`). */
const DEACTIVATED_TEXTS: Readonly<Record<ChoiceField, (name: string) => string>> = {
  deviceTypeId: ERROR_MESSAGES['device_type_deactivated.model_template'],
  manufacturerId: ERROR_MESSAGES['manufacturer_deactivated.model_template'],
};

/** Whether a rejection of a deactivated entry belongs to the field of its `details.path`. */
function isDeactivatedAt(code: string | undefined, path: string): boolean {
  if (code === 'device_type_deactivated') return path === 'deviceTypeId';
  if (code === 'manufacturer_deactivated') return path === 'manufacturerId';
  return code === 'pick_list_value_deactivated' && ATTRIBUTE_PATH.test(path);
}

/** Text of a deactivated pick list value at the field of its attribute (CU-012, `.attribute`). */
const deactivatedValueText = (label: string) => (value: string) =>
  ERROR_MESSAGES['pick_list_value_deactivated.attribute'](label, value);

/**
 * Request body of `POST /api/model-templates`: every field, "unbekannt" with `mpn: null`, and
 * every attribute the form asks for (2.0.5 rule (2)).
 */
const bodyOf = (
  { mpn, mpnUnknown, modelValues, defaultDeviceValues, ...draft }: Draft,
  attributes: readonly Attribute[],
): ModelTemplateCreateInput => ({
  ...draft,
  mpn: mpnUnknown ? null : mpn,
  mpnUnknown,
  modelValues: attributeRequestValues(attributes, 'model', modelValues),
  defaultDeviceValues: attributeRequestValues(attributes, 'device', defaultDeviceValues),
});

/**
 * Field errors of the Zod check in the browser, the same schemas as on the server (2.0.7): the
 * model data, then the attribute values against the definitions of the device type (2.4); the
 * first message per field (2.0.5).
 */
function checkAll(draft: Draft, attributes: readonly Attribute[]): FieldErrors {
  const errors: FieldErrors = {};
  const body = bodyOf(draft, attributes);
  const issues = [
    ...(modelTemplateCreateSchema.safeParse(body).error?.issues ?? []),
    ...(modelTemplateValuesSchema(attributes).safeParse({
      modelValues: body.modelValues,
      defaultDeviceValues: body.defaultDeviceValues,
    }).error?.issues ?? []),
  ];
  for (const issue of issues) {
    const path = issue.path.join('.');
    if (isField(path)) errors[path] ??= issue.message;
  }
  return errors;
}

/** The input without the pick list value `id`: a choice emptied, a port entry without it. */
function withoutChoice(attribute: Attribute, input: AttributeInputValue, id: number) {
  if (attribute.dataType === 'pick') return input === id ? null : input;
  if (!Array.isArray(input)) return input;
  return input.map((entry): PortInput => ({
    ...entry,
    typeId: entry.typeId === id ? null : entry.typeId,
    positionId: entry.positionId === id ? null : entry.positionId,
  }));
}

/** Ids of the lists `port_type` and `port_position`, as read for the inputs of CU-112. */
function portListIds(queryClient: QueryClient) {
  const lists = queryClient.getQueryData<PickListList>(queryKeys.settings.pickLists())?.items;
  const idOfList = (key: string) => lists?.find((list) => list.key === key)?.id ?? null;
  return { type: idOfList('port_type'), position: idOfList('port_position') };
}

/** A pick list value chosen in an attribute field, with the key of the list it comes from. */
interface AttributeChoice {
  path: string;
  id: number;
  list: string;
  message: (name: string) => string;
}

/** A list of pick list values before and after reading it again; `after` is `null` if it failed. */
interface ReloadedList {
  before: readonly ChoiceItem[];
  after: readonly ChoiceItem[] | null;
}

/**
 * The pick list values chosen in the attribute fields, in form order, with the list they come
 * from and the text of their usage (2.0.11).
 */
function attributeChoices(
  attributes: readonly Attribute[],
  draft: Draft,
  ports: { type: number | null; position: number | null },
): AttributeChoice[] {
  const choices: AttributeChoice[] = [];
  for (const { key, level } of VALUE_OBJECTS) {
    for (const attribute of attributesOfLevel(attributes, level)) {
      const path = `${key}.${attribute.id}`;
      const message = deactivatedValueText(attribute.label);
      const input = draft[key][String(attribute.id)];
      if (attribute.dataType === 'pick' && typeof input === 'number') {
        choices.push({ path, id: input, list: String(attribute.pickListId), message });
      }
      if (attribute.dataType === 'ports' && Array.isArray(input)) {
        for (const { typeId, positionId } of input) {
          if (typeId !== null)
            choices.push({ path, id: typeId, list: String(ports.type), message });
          if (positionId !== null) {
            choices.push({ path, id: positionId, list: String(ports.position), message });
          }
        }
      }
    }
  }
  return choices;
}

/**
 * Key of the list the rejected pick list value of the field `path` comes from: the list of the
 * attribute, for ports the list of types or of positions that held the value before the reload;
 * `undefined` if the form has no such field.
 */
function attributeChoiceList(
  attributes: readonly Attribute[],
  path: string,
  id: number,
  ports: { type: number | null; position: number | null },
  lists: Readonly<Record<string, ReloadedList>>,
): string | undefined {
  const attributeId = ATTRIBUTE_PATH.exec(path)?.[2];
  const attribute = attributes.find((candidate) => String(candidate.id) === attributeId);
  if (attribute?.dataType === 'pick') return String(attribute.pickListId);
  if (attribute?.dataType !== 'ports') return undefined;
  return [String(ports.type), String(ports.position)].find((list) =>
    lists[list]?.before.some((entry) => entry.id === id),
  );
}

const asItems = (list: PickListValueList | undefined): ChoiceItem[] =>
  (list?.items ?? []).map(({ id, label, active }) => ({ id, label, active }));

/**
 * The attribute choices whose value is missing in their reloaded list, in form order, through
 * CU-319. A field of data type ports holds values of two lists, so each choice is checked with
 * the list it comes from; a new model template has no stored value.
 */
function missingAttributeChoices(
  choices: readonly AttributeChoice[],
  lists: Readonly<Record<string, ReloadedList>>,
): MissingChoice[] {
  return choices.flatMap(({ path, id, list, message }) =>
    findMissingChoices([{ path, id, storedId: null, before: lists[list]?.before ?? [], message }], {
      [path]: lists[list]?.after ?? undefined,
    }),
  );
}

const hasErrors = (errors: FieldErrors) => Object.values(errors).some(Boolean);

/** The errors without those of the attribute fields, whose inputs went with the device type. */
const withoutAttributePaths = (errors: FieldErrors): FieldErrors =>
  Object.fromEntries(Object.entries(errors).filter(([path]) => !ATTRIBUTE_PATH.test(path)));

const optionValue = (id: number | null) => (id === null ? '' : String(id));
const idOf = (value: string) => (value === '' ? null : Number(value));

/**
 * Model template UI-007 for a new model template (CU-114, REQ-008; Technical Specification
 * 2.4): device type, manufacturer, model name, type designation, MPN or "unbekannt" and original
 * EAN, "Modellvorlage speichern" (also Ctrl+S) and "Abbrechen". Device type and manufacturer open
 * with the placeholder "Bitte wählen" (Design v0.6.7). With a device type its attribute fields
 * appear (CU-111): those of the level model below the model data, the device defaults in their
 * own area; without one both areas show a hint (2.4, #178). States: default, loading,
 * validation (focus on the first error), speichert and ausgang-unbekannt (P-08), success (banner
 * on the calling page), error, unreachable (P-06) for the reads, wird-beendet (P-07) for the
 * save and the dialog dublette for a possible duplicate (REQ-011). "Neuen Hersteller anlegen"
 * opens the dialog UI-008 (#179). Changing (#181) follows.
 */
export function ModelTemplatePage() {
  const navigate = useNavigate();
  const deviceTypes = useDeviceTypesQuery();
  const manufacturers = useManufacturersQuery();
  const createMutation = useCreateModelTemplateMutation();
  const writesLocked = useWritesLocked();
  const queryClient = useQueryClient();

  // A rejected entry whose list could not be read again counts as missing (2.4, Nachtrag
  // MAR-925): it is no longer offered.
  const [dropped, setDropped] = useState<Partial<Record<ChoiceField, number>>>({});
  const activeDeviceTypes = deviceTypes.data?.items.filter(
    ({ id, active }) => active && id !== dropped.deviceTypeId,
  );
  const activeManufacturers = manufacturers.data?.items.filter(
    ({ id, active }) => active && id !== dropped.manufacturerId,
  );

  // Pick list values rejected as deactivated whose list could not be read again (2.0.11).
  const [droppedValues, setDroppedValues] = useState<ReadonlySet<number>>(new Set());

  const [draft, setDraft] = useState<Draft | null>(null);
  // The current inputs for the check after reloading the choices.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // The fields of the attributes of the chosen device type; none are loaded without one (2.4).
  const attributesQuery = useAttributesQuery(draft?.deviceTypeId ?? null);
  const attributes = draft?.deviceTypeId == null ? [] : attributesQuery.data?.items;
  const attributesRef = useRef(attributes);
  attributesRef.current = attributes;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  // Choices that show the text of a rejection; it stays until the next choice (Design v0.6.7).
  const [rejectionShown, setRejectionShown] = useState<Partial<Record<string, boolean>>>({});
  const [reloading, setReloading] = useState(false);
  // Hits of a possible duplicate; the dialog UI-007.dublette is open while they are set.
  const [duplicates, setDuplicates] = useState<ModelTemplateMatch[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // The manufacturer created through UI-008; its hint stands while it is chosen (DER-50-06).
  const [createdId, setCreatedId] = useState<number | null>(null);

  const formId = useId();
  const modelDataId = useId();
  const modelAttributesId = useId();
  const deviceDefaultsId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const blurCheck = useDeferredBlurCheck();

  // The form opens once the choices have arrived, with nothing chosen (Design v0.6.7).
  const choicesLoaded = activeDeviceTypes !== undefined && activeManufacturers !== undefined;
  useEffect(() => {
    if (draft !== null || !choicesLoaded) return;
    setDraft({
      deviceTypeId: null,
      manufacturerId: null,
      modelName: '',
      typeDesignation: '',
      mpn: '',
      mpnUnknown: false,
      originalEan: '',
      modelValues: {},
      defaultDeviceValues: {},
    });
  }, [draft, choicesLoaded]);

  const saving = createMutation.isPending;
  // Until the choices are read again after a rejection, a save could send the rejected id; until
  // the attributes have arrived, it would send none of their values. While the dialog of a
  // possible duplicate is open, only its choices save (Ctrl+S does not).
  const canSave =
    draft !== null &&
    attributes !== undefined &&
    !saving &&
    !writesLocked &&
    !reloading &&
    duplicates === null;

  function change(next: Partial<Draft>) {
    if (draft !== null) setDraft({ ...draft, ...next });
  }

  /**
   * A choice from the list: any entry offered is valid, so the text of the field goes. Another
   * device type has other attributes: the inputs of both attribute areas are dropped (2.4
   * "Abhängige Eingaben", Design v0.6.7).
   */
  function choose(field: ChoiceField, value: string) {
    const id = idOf(value);
    const attributesDropped = field === 'deviceTypeId' && id !== draft?.deviceTypeId;
    change({
      [field]: id,
      ...(attributesDropped && { modelValues: {}, defaultDeviceValues: {} }),
    });
    setErrors((previous) =>
      attributesDropped
        ? withoutAttributePaths({ ...previous, [field]: undefined })
        : { ...previous, [field]: undefined },
    );
    setRejectionShown((previous) => ({ ...previous, [field]: false }));
  }

  /**
   * Answer of UI-008: the new or the existing manufacturer is chosen (2.4 "Hersteller neu",
   * DER-50-06, DER-50-07). With `existing: true` the dialog stays open with its hint.
   */
  function onManufacturerCreated({ id, existing }: ManufacturerCreateResult) {
    // The answer arrives after renders of the open dialog, so the current draft is used.
    setDraft((previous) => (previous === null ? previous : { ...previous, manufacturerId: id }));
    setErrors((previous) => ({ ...previous, manufacturerId: undefined }));
    setRejectionShown((previous) => ({ ...previous, manufacturerId: false }));
    // The entry is active again, so it is offered even if its list failed after a rejection.
    setDropped((previous) =>
      previous.manufacturerId === id ? { ...previous, manufacturerId: undefined } : previous,
    );
    if (existing) return;
    setDialogOpen(false);
    setCreatedId(id);
  }

  /** The input of an attribute; a new choice in a field ends the text of a rejection there. */
  function changeAttribute(key: ValueObject, attributeId: number, input: AttributeInputValue) {
    if (draft === null) return;
    setDraft({ ...draft, [key]: { ...draft[key], [attributeId]: input } });
    const path = `${key}.${attributeId}`;
    if (rejectionShown[path]) {
      setErrors((previous) => ({ ...previous, [path]: undefined }));
      setRejectionShown((previous) => ({ ...previous, [path]: false }));
    }
  }

  function checkOnBlur(field: string) {
    if (draft === null || attributes === undefined) return;
    if (rejectionShown[field]) return;
    const current = draft;
    const definitions = attributes;
    blurCheck.checkOnBlur(() =>
      setErrors((previous) => ({ ...previous, [field]: checkAll(current, definitions)[field] })),
    );
  }

  function showFieldErrors(next: FieldErrors) {
    setErrors(next);
    focusFirstError();
  }

  function onFailed(error: ApiError) {
    if (error.kind === 'validation') {
      const next: FieldErrors = {};
      for (const { path, message } of error.error?.fields ?? []) {
        if (isField(path)) next[path] ??= message;
      }
      if (hasErrors(next)) {
        showFieldErrors(next);
        return;
      }
    }
    // A device type, manufacturer or pick list value deactivated in another window: the text
    // stands at the field of `details.path`, and the choices are read again (2.4, 2.0.11).
    const { path, id } = error.error?.details ?? {};
    if (
      error.kind === 'rejected' &&
      typeof path === 'string' &&
      isDeactivatedAt(error.error?.code, path)
    ) {
      showFieldErrors({ [path]: error.error?.message });
      setRejectionShown({ [path]: true });
      if (typeof id === 'number') void reloadAfterRejection(path, id);
      return;
    }
    // The question comes only if the save would succeed otherwise (2.4 "Prüfreihenfolge").
    const matches = possibleDuplicatesOf(error);
    if (matches !== null) {
      setDuplicates(matches);
      return;
    }
    setNotice(noticeOf(error));
  }

  /**
   * Reads both choices again. If the rejected entry is missing then, or the read fails, the choice
   * is emptied, so the rejected id is never sent again (2.4 "Auswahl nach der Ablehnung",
   * Nachtrag MAR-925). The server names only the first deactivated entry, so the other choice is
   * checked against its new list as well and emptied with its own text when its entry is missing
   * there; if its read fails, it keeps its entry (2.4 "Beide Felder prüfen", Nachtrag MAR-952).
   * Checked is the input at the end of the reload, so a choice made while the lists load is
   * checked like any other (2.4 "Wahl während des Neuladens", Nachtrag MAR-963).
   */
  async function reloadAfterRejection(rejected: string, id: number) {
    setReloading(true);
    const before = { deviceTypeId: deviceTypes.data, manufacturerId: manufacturers.data };
    const valueKey = queryKeys.settings.pickListValues(0).slice(0, -1);
    const valuesBefore = new Map(
      queryClient
        .getQueriesData<PickListValueList>({ queryKey: valueKey })
        .map(([key, list]) => [String(key.at(-1)), list]),
    );
    const [types, makers] = await Promise.all([
      deviceTypes.refetch(),
      manufacturers.refetch(),
      queryClient.refetchQueries({ queryKey: valueKey }),
    ]);
    const reloaded = { deviceTypeId: types, manufacturerId: makers };
    // Without a new list the rejected entry is no longer offered, whatever is chosen now.
    if (isChoiceField(rejected) && reloaded[rejected].isError) {
      setDropped((previous) => ({ ...previous, [rejected]: id }));
    }

    const emptied: Partial<Record<ChoiceField, null>> = {};
    const texts: FieldErrors = {};
    for (const field of CHOICE_FIELDS) {
      const value = draftRef.current?.[field] ?? null;
      if (value === null) continue;
      const result = reloaded[field];
      const missing = result.isError
        ? field === rejected && value === id
        : !result.data?.items.some((entry) => entry.id === value && entry.active);
      if (!missing) continue;
      // Emptied with the text of its use, also when the rejected entry was chosen again.
      emptied[field] = null;
      const name = before[field]?.items.find((entry) => entry.id === value)?.name ?? '';
      texts[field] = DEACTIVATED_TEXTS[field](name);
    }

    // Without the device type its attribute inputs go (2.4 "Abhängige Eingaben").
    const typeEmptied = 'deviceTypeId' in emptied;
    setDraft((previous) =>
      previous === null
        ? previous
        : {
            ...previous,
            ...emptied,
            ...(typeEmptied && { modelValues: {}, defaultDeviceValues: {} }),
          },
    );
    if (typeEmptied) setErrors((previous) => withoutAttributePaths(previous));
    else {
      Object.assign(texts, checkAttributeChoices(rejected, id, valuesBefore));
    }
    if (hasErrors(texts)) {
      setErrors((previous) => ({ ...previous, ...texts }));
      setRejectionShown((previous) => ({
        ...previous,
        ...Object.fromEntries(Object.keys(texts).map((field) => [field, true])),
      }));
      // Device type comes before manufacturer in the form, so it gets the focus first.
      focusFirstError();
    }
    setReloading(false);
  }

  /**
   * The attribute choices after the lists were read again (2.0.11, DG-20 standard solution,
   * Nachtrag MAR-963): every pick list value the form holds at the end of the reload, also one
   * chosen meanwhile and the one at `details.path`, that is missing or deactivated in its
   * reloaded list is emptied and named with "<Merkmal>: <Wert> ist deaktiviert". If the list of
   * the rejected value could not be read, it is no longer offered, and only the rejected value
   * counts as missing. Returns the new texts.
   */
  function checkAttributeChoices(
    rejected: string,
    id: number,
    valuesBefore: ReadonlyMap<string, PickListValueList | undefined>,
  ): FieldErrors {
    const definitions = attributesRef.current ?? [];
    const current = draftRef.current;
    if (current === null) return {};
    const lists: Record<string, ReloadedList> = {};
    for (const [list, before] of valuesBefore) {
      const state = queryClient.getQueryState<PickListValueList>(
        queryKeys.settings.pickListValues(Number(list)),
      );
      lists[list] = {
        before: asItems(before),
        after: state?.status === 'error' ? null : asItems(state?.data),
      };
    }
    const choices = attributeChoices(definitions, current, portListIds(queryClient));
    const missing = missingAttributeChoices(choices, lists);
    const rejectedList = ATTRIBUTE_PATH.test(rejected)
      ? attributeChoiceList(definitions, rejected, id, portListIds(queryClient), lists)
      : undefined;
    if (rejectedList !== undefined && lists[rejectedList]?.after == null) {
      setDroppedValues((previous) => new Set([...previous, id]));
      const held = choices.find((choice) => choice.path === rejected && choice.id === id);
      if (held !== undefined) {
        const name = lists[rejectedList]?.before.find((entry) => entry.id === id)?.label ?? '';
        missing.push({ path: rejected, id, message: held.message(name) });
      }
    }
    if (missing.length === 0) return {};

    setDraft((previous) => {
      if (previous === null) return previous;
      const next = { ...previous };
      for (const choice of missing) {
        const [, key, attributeId] = ATTRIBUTE_PATH.exec(choice.path) ?? [];
        const attribute = definitions.find((candidate) => String(candidate.id) === attributeId);
        if (attribute === undefined) continue;
        const object = key as ValueObject;
        const input = next[object][String(attribute.id)];
        if (input === undefined) continue;
        next[object] = {
          ...next[object],
          [attribute.id]: withoutChoice(attribute, input, choice.id),
        };
      }
      return next;
    });
    const texts: FieldErrors = {};
    for (const { path, message } of missing) texts[path] ??= message;
    return texts;
  }

  function save() {
    // The save checks the fields itself; a later check on leaving must not hide its result.
    blurCheck.cancel();
    if (draft === null || attributes === undefined || !canSave) return;
    const found = checkAll(draft, attributes);
    setRejectionShown({});
    if (hasErrors(found)) {
      showFieldErrors(found);
      return;
    }
    setErrors({});
    setNotice(null);
    send(bodyOf(draft, attributes));
  }

  function send(body: ModelTemplateCreateInput) {
    createMutation.mutate(body, {
      onSuccess: () => {
        const state: SavedNoticeState = { savedNotice: TEXTS.saved };
        void navigate(CALLER_PATH, { state });
      },
      onError: onFailed,
    });
  }

  /** "Trotzdem anlegen": the same model template again, with the confirmation (DER-53-03). */
  function createAnyway() {
    setDuplicates(null);
    if (draft === null || attributes === undefined || writesLocked) return;
    send({ ...bodyOf(draft, attributes), confirmDuplicate: true });
  }

  /**
   * "Vorhandene verwenden": the inputs are discarded and the chosen model template opens in
   * UI-007 for changing (DER-53-02). The return to UI-003 follows with #186 (DER-54-14).
   */
  function chooseExisting(id: number) {
    setDuplicates(null);
    void navigate(templatePath(id));
  }

  // Ctrl+S saves like the primary button (UI-007 "Aktionen").
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      saveRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /**
   * The fields of one attribute area, or the hint while no device type is chosen (Design
   * v0.6.7): the level model with "*" at required attributes, the device defaults all optional
   * (2.4, DER-50-10, DER-50-11).
   */
  function attributeArea(key: ValueObject, headingId: string) {
    if (draft === null) return null;
    if (draft.deviceTypeId === null) {
      return <p className="m-0 text-body text-text-secondary">{TEXTS.chooseDeviceType}</p>;
    }
    if (attributes === undefined) return null;
    const prefix = `${key}.`;
    const fieldErrors = Object.fromEntries(
      Object.entries(errors)
        .filter(([path]) => path.startsWith(prefix))
        .map(([path, text]) => [path.slice(prefix.length), text]),
    );
    return (
      <div role="group" aria-labelledby={headingId} className="flex flex-col gap-4">
        <AttributeFieldsForm
          attributes={attributes}
          level={key === 'modelValues' ? 'model' : 'device'}
          inputs={draft[key]}
          errors={fieldErrors}
          withRequired={key === 'modelValues'}
          dropped={droppedValues}
          disabled={saving}
          onChange={(attributeId, input) => changeAttribute(key, attributeId, input)}
          onBlur={(attributeId) => checkOnBlur(`${key}.${attributeId}`)}
        />
      </div>
    );
  }

  // A failed read shows P-06 or the error banner; the inputs stay (2.0.7).
  const loadFailed = deviceTypes.error ?? manufacturers.error ?? attributesQuery.error;
  const loading = draft === null && loadFailed === null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
        <Link to={CALLER_PATH} className="self-start text-body text-primary no-underline">
          <span aria-hidden="true">← </span>
          {TEXTS.back}
        </Link>
        <h1 className="m-0 text-page-title font-semibold">{TEXTS.title}</h1>

        <OutcomeUnknownBanner />
        {loadFailed?.kind === 'unreachable' && <UnreachableBanner />}
        {loadFailed && loadFailed.kind !== 'unreachable' && (
          <PageBanner variant="error" error={loadFailed}>
            {TEXTS.error}
          </PageBanner>
        )}
        <SaveNoticeBanners
          notice={notice}
          onClose={() => setNotice(null)}
          onReloaded={() => setNotice(null)}
          errorText={TEXTS.error}
        />

        {loading && (
          <p role="status" className="m-0 text-body text-text-secondary">
            {TEXTS.loading}
          </p>
        )}

        {draft !== null && (
          <form
            id={formId}
            ref={formRef}
            aria-label={TEXTS.title}
            noValidate
            className="grid grid-cols-1 gap-6 full:grid-cols-2"
            onPointerDown={blurCheck.pressPointer}
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <section
              aria-labelledby={modelDataId}
              className="flex min-w-0 flex-col gap-4 rounded-control border border-border bg-surface p-6"
            >
              <h2
                id={modelDataId}
                className="m-0 border-b border-border pb-4 text-section font-semibold"
              >
                {TEXTS.modelData}
              </h2>

              <FormField label={TEXTS.deviceType} required error={errors.deviceTypeId}>
                {(control) => (
                  <Select
                    {...control}
                    value={optionValue(draft.deviceTypeId)}
                    disabled={saving}
                    onChange={(event) => choose('deviceTypeId', event.target.value)}
                    onBlur={() => checkOnBlur('deviceTypeId')}
                  >
                    <option value="" disabled>
                      {TEXTS.choose}
                    </option>
                    {(activeDeviceTypes ?? []).map(({ id, name }) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>

              <div className="relative flex flex-col gap-2">
                <FormField label={TEXTS.manufacturer} required error={errors.manufacturerId}>
                  {(control) => (
                    <Select
                      {...control}
                      value={optionValue(draft.manufacturerId)}
                      disabled={saving}
                      onChange={(event) => choose('manufacturerId', event.target.value)}
                      onBlur={() => checkOnBlur('manufacturerId')}
                    >
                      <option value="" disabled>
                        {TEXTS.choose}
                      </option>
                      {(activeManufacturers ?? []).map(({ id, name }) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
                {/* Opens a dialog, so it is a button that looks like the link of the design; it
                    stands right in the row of the label, as in the mockup of UI-007. */}
                <button
                  type="button"
                  className="absolute top-0 right-0 border-0 bg-transparent p-0 text-label text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                  onClick={() => setDialogOpen(true)}
                >
                  {TEXTS.newManufacturer}
                </button>
                {createdId !== null && createdId === draft.manufacturerId && (
                  <p role="note" className="m-0 text-body text-text-secondary">
                    {TEXTS.createdHint.before}
                    <Link to={MANUFACTURERS_PATH} className="text-primary">
                      {TEXTS.createdHint.link}
                    </Link>
                    {TEXTS.createdHint.after}
                  </p>
                )}
              </div>

              <FormField label={TEXTS.modelName} required error={errors.modelName}>
                {(control) => (
                  <Input
                    {...control}
                    value={draft.modelName}
                    disabled={saving}
                    onChange={(event) => change({ modelName: event.target.value })}
                    onBlur={() => checkOnBlur('modelName')}
                  />
                )}
              </FormField>

              <FormField label={TEXTS.typeDesignation} error={errors.typeDesignation}>
                {(control) => (
                  <Input
                    {...control}
                    value={draft.typeDesignation}
                    disabled={saving}
                    onChange={(event) => change({ typeDesignation: event.target.value })}
                    onBlur={() => checkOnBlur('typeDesignation')}
                  />
                )}
              </FormField>

              <div className="flex flex-col gap-2">
                <FormField label={TEXTS.mpn} required error={errors.mpn}>
                  {(control) => (
                    <Input
                      {...control}
                      value={draft.mpnUnknown ? '' : draft.mpn}
                      // With "unbekannt" the field is emptied and locked (2.4).
                      disabled={saving || draft.mpnUnknown}
                      onChange={(event) => change({ mpn: event.target.value })}
                      onBlur={() => checkOnBlur('mpn')}
                    />
                  )}
                </FormField>
                <Checkbox
                  label={TEXTS.mpnUnknown}
                  checked={draft.mpnUnknown}
                  disabled={saving}
                  onChange={(mpnUnknown) => {
                    change({ mpnUnknown, ...(mpnUnknown && { mpn: '' }) });
                    setErrors((previous) => ({ ...previous, mpn: undefined }));
                  }}
                />
              </div>

              <FormField label={TEXTS.originalEan} error={errors.originalEan}>
                {(control) => (
                  <Input
                    {...control}
                    inputMode="numeric"
                    value={draft.originalEan}
                    disabled={saving}
                    onChange={(event) => change({ originalEan: event.target.value })}
                    onBlur={() => checkOnBlur('originalEan')}
                  />
                )}
              </FormField>

              <h3
                id={modelAttributesId}
                className="m-0 border-t border-border pt-4 text-body font-semibold"
              >
                {TEXTS.modelAttributes}
              </h3>
              {attributeArea('modelValues', modelAttributesId)}
            </section>

            <section
              aria-labelledby={deviceDefaultsId}
              className="flex min-w-0 flex-col gap-4 self-start rounded-control border border-border bg-surface p-6"
            >
              <h2
                id={deviceDefaultsId}
                className="m-0 border-b border-border pb-4 text-section font-semibold"
              >
                {TEXTS.deviceDefaults}
              </h2>
              {attributeArea('defaultDeviceValues', deviceDefaultsId)}
            </section>
          </form>
        )}
      </div>

      {/* The action bar stays visible below the scrolling form (DESIGN.md "Fenstergröße"). */}
      <div className="flex shrink-0 flex-wrap justify-end gap-4 border-t border-border bg-surface px-6 py-4">
        <Button disabled={saving || writesLocked} onClick={() => void navigate(CALLER_PATH)}>
          {TEXTS.cancel}
        </Button>
        <Button type="submit" form={formId} variant="primary" disabled={!canSave}>
          {saving ? TEXTS.saving : TEXTS.save}
        </Button>
      </div>

      <DuplicateDialog
        matches={duplicates}
        onUseExisting={chooseExisting}
        onCreateAnyway={createAnyway}
        onClose={() => setDuplicates(null)}
        createDisabled={writesLocked}
      />

      <ManufacturerCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={onManufacturerCreated}
      />
    </div>
  );
}
