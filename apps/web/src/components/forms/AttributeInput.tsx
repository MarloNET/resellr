import { formatNumber } from '@resellr/domain/format/format-value';
import type { Attribute } from '@resellr/domain/schemas/attribute.schema';
import type {
  AttributeValue,
  BatteryCapacityValue,
  PortEntry,
} from '@resellr/domain/schemas/attribute-values.schema';

import { usePickListsQuery, usePickListValuesQuery } from '../../api/settings.api.ts';
import { Button } from '../ui/Button.tsx';
import { Checkbox } from '../ui/Checkbox.tsx';
import { Input } from '../ui/Input.tsx';
import { Select } from '../ui/Select.tsx';
import { type ChoiceItem, choiceOptions, type ChoiceOption } from './deactivated-choice.ts';
import type { FormFieldControlProps } from './FormField.tsx';

// Texts of the inputs (UI-007, UI-003 "Akkukapazität"; Technical Specification 2.5, 2.8.2).
const TEXTS = {
  choose: 'Bitte wählen',
  yes: 'Ja',
  no: 'Nein',
  notDeterminable: 'nicht ermittelbar',
  count: 'Anzahl',
  type: 'Typ',
  position: 'Position',
  addEntry: 'Eintrag hinzufügen',
  removeEntry: 'Eintrag entfernen',
} as const;

/** One entry of the data type `ports` as entered: the count as typed (2.5). */
export interface PortInput {
  count: string;
  typeId: number | null;
  positionId: number | null;
}

/** The input of the role `battery_capacity`: the percent as typed or "nicht ermittelbar". */
export type BatteryCapacityInput = { percent: string } | { notDeterminable: true };

/**
 * The input of one attribute as the form holds it: text, integer and decimal as typed, yes/no
 * and pick list values as `null` until chosen (2.5).
 */
export type AttributeInputValue =
  string | boolean | number | null | PortInput[] | BatteryCapacityInput;

/** The fields of an attribute definition the input needs. */
export type AttributeInputDefinition = Pick<
  Attribute,
  'id' | 'label' | 'dataType' | 'systemRole' | 'pickListId' | 'unit'
>;

const EMPTY_PORT: PortInput = { count: '', typeId: null, positionId: null };

/** The input of an attribute without a value. */
export function emptyAttributeInput({
  dataType,
  systemRole,
}: Pick<AttributeInputDefinition, 'dataType' | 'systemRole'>): AttributeInputValue {
  if (systemRole === 'battery_capacity') return { percent: '' };
  if (dataType === 'boolean' || dataType === 'pick') return null;
  if (dataType === 'ports') return [EMPTY_PORT];
  return '';
}

/**
 * The input as the request sends it (2.5): an untouched entry of `ports` is left out, so no
 * entry is `[]`; an empty battery capacity is `null`. The schema of CU-067 checks the rest.
 */
export function attributeRequestValue(
  { dataType, systemRole }: Pick<AttributeInputDefinition, 'dataType' | 'systemRole'>,
  input: AttributeInputValue,
): unknown {
  if (systemRole === 'battery_capacity') {
    return input !== null &&
      typeof input === 'object' &&
      'percent' in input &&
      input.percent.trim() === ''
      ? null
      : input;
  }
  if (dataType === 'ports' && Array.isArray(input)) {
    return input.filter(
      ({ count, typeId, positionId }) =>
        count.trim() !== '' || typeId !== null || positionId !== null,
    );
  }
  return input;
}

/**
 * The input of a stored value (3.4), e.g. of a prefill (REQ-013): numbers as text with decimal
 * comma, the battery capacity as its percent or "nicht ermittelbar".
 */
export function attributeInputOf(
  { dataType, systemRole }: Pick<AttributeInputDefinition, 'dataType' | 'systemRole'>,
  value: AttributeValue,
): AttributeInputValue {
  if (systemRole === 'battery_capacity') {
    const capacity = value as BatteryCapacityValue;
    return 'percent' in capacity ? { percent: String(capacity.percent) } : capacity;
  }
  switch (dataType) {
    case 'integer':
    case 'decimal':
      return formatNumber(value as number | string);
    case 'ports':
      return (value as PortEntry[]).map(({ count, typeId, positionId }) => ({
        count: String(count),
        typeId,
        positionId,
      }));
    default:
      return value as string | boolean | number;
  }
}

const optionValue = (id: number | null) => (id === null ? '' : String(id));
const idOf = (value: string) => (value === '' ? null : Number(value));

/**
 * The values a choice offers (2.0.11, CU-319): the active ones without those the screen no
 * longer offers, the stored ones of the field, a deactivated one with "(deaktiviert)", and the
 * chosen one, deactivated after a reload without a mark (design v0.6.11, Nachtrag MAR-1058).
 */
function offeredValues(
  items: readonly ChoiceItem[],
  dropped: ReadonlySet<number>,
  storedIds: readonly number[],
  chosenId: number | null,
) {
  return choiceOptions(items, {
    storedId: null,
    storedIds,
    chosenId,
    markDeactivated: true,
  }).filter(({ id }) => !dropped.has(id) || storedIds.includes(id));
}

/** The values of a list, active and deactivated, empty until they are read. */
function usePickListItems(pickListId: number | null): readonly ChoiceItem[] {
  return usePickListValuesQuery(pickListId).data?.items ?? [];
}

function ValueOptions({ values }: { values: readonly ChoiceOption[] }) {
  return values.map(({ id, label }) => (
    <option key={id} value={id}>
      {label}
    </option>
  ));
}

export interface AttributeInputProps {
  attribute: AttributeInputDefinition;
  value: AttributeInputValue;
  /** Required: a choice shows the placeholder "Bitte wählen" instead of the empty choice. */
  required: boolean;
  /** Pick list values that are no longer offered (2.0.11, read again without success). */
  dropped: ReadonlySet<number>;
  /**
   * Pick list values of the stored value of the field (UI-010): offered while deactivated, with
   * "(deaktiviert)" (2.0.11 "Anzeige vorher", design v0.6.8).
   */
  storedIds?: readonly number[];
  disabled?: boolean;
  /** Attributes of the form field (CU-057); the first control of the input takes them. */
  control: FormFieldControlProps;
  onChange: (value: AttributeInputValue) => void;
  onBlur: () => void;
}

/**
 * Input of one attribute by its data type (CU-112, REQ-005, REQ-014; Technical Specification
 * 2.5): text, integer and decimal as a text field (the decimal with comma or point), yes/no and
 * *Auswahl aus Liste* as a choice, *Mehrfachangabe Anzahl × Typ* as entries of count, type and
 * position, the battery capacity as a number or "nicht ermittelbar". A choice offers the active
 * values of its list, a stored, deactivated one with "(deaktiviert)" and its chosen one, also
 * when it is deactivated after a reload, without a mark (2.0.11, Nachtrag MAR-1058).
 */
export function AttributeInput(props: AttributeInputProps) {
  const { attribute } = props;
  if (attribute.systemRole === 'battery_capacity') return <BatteryCapacityField {...props} />;
  switch (attribute.dataType) {
    case 'boolean':
      return <BooleanField {...props} />;
    case 'pick':
      return <PickField {...props} />;
    case 'ports':
      return <PortsField {...props} />;
    default:
      return (
        <Input
          {...props.control}
          inputMode={attribute.dataType === 'text' ? undefined : 'decimal'}
          value={typeof props.value === 'string' ? props.value : ''}
          disabled={props.disabled}
          onChange={(event) => props.onChange(event.target.value)}
          onBlur={props.onBlur}
        />
      );
  }
}

/** The first option: the placeholder of a required choice, else the empty choice. */
function EmptyOption({ required }: { required: boolean }) {
  return required ? (
    <option value="" disabled>
      {TEXTS.choose}
    </option>
  ) : (
    <option value="" />
  );
}

function BooleanField({
  value,
  required,
  disabled,
  control,
  onChange,
  onBlur,
}: AttributeInputProps) {
  return (
    <Select
      {...control}
      value={value === true ? 'true' : value === false ? 'false' : ''}
      disabled={disabled}
      onChange={(event) =>
        onChange(event.target.value === '' ? null : event.target.value === 'true')
      }
      onBlur={onBlur}
    >
      <EmptyOption required={required} />
      <option value="true">{TEXTS.yes}</option>
      <option value="false">{TEXTS.no}</option>
    </Select>
  );
}

function PickField({
  attribute,
  value,
  required,
  dropped,
  storedIds = [],
  disabled,
  control,
  onChange,
  onBlur,
}: AttributeInputProps) {
  const chosenId = typeof value === 'number' ? value : null;
  const values = offeredValues(
    usePickListItems(attribute.pickListId),
    dropped,
    storedIds,
    chosenId,
  );
  return (
    <Select
      {...control}
      value={optionValue(typeof value === 'number' ? value : null)}
      disabled={disabled}
      onChange={(event) => onChange(idOf(event.target.value))}
      onBlur={onBlur}
    >
      <EmptyOption required={required} />
      <ValueOptions values={values} />
    </Select>
  );
}

/** Id of the list with this key from `GET /api/pick-lists`, `null` until it is read. */
function usePickListIdOf(key: 'port_type' | 'port_position') {
  const { data } = usePickListsQuery();
  return data?.items.find((list) => list.key === key)?.id ?? null;
}

function PortsField({
  attribute,
  value,
  dropped,
  storedIds = [],
  disabled,
  control,
  onChange,
  onBlur,
}: AttributeInputProps) {
  const types = usePickListItems(usePickListIdOf('port_type'));
  const positions = usePickListItems(usePickListIdOf('port_position'));
  const entries = Array.isArray(value) && value.length > 0 ? value : [EMPTY_PORT];
  const change = (index: number, next: Partial<PortInput>) =>
    onChange(entries.map((entry, at) => (at === index ? { ...entry, ...next } : entry)));

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry, index) => (
        // The entries have no id of their own; their place in the list is their identity.
        <div key={index} className="flex flex-wrap items-center gap-2">
          <Input
            {...(index === 0 ? control : {})}
            aria-label={`${attribute.label} ${TEXTS.count}`}
            inputMode="numeric"
            className="w-20"
            value={entry.count}
            disabled={disabled}
            onChange={(event) => change(index, { count: event.target.value })}
            onBlur={onBlur}
          />
          <span aria-hidden="true">×</span>
          <Select
            aria-label={`${attribute.label} ${TEXTS.type}`}
            className="w-auto min-w-40 flex-1"
            value={optionValue(entry.typeId)}
            disabled={disabled}
            onChange={(event) => change(index, { typeId: idOf(event.target.value) })}
            onBlur={onBlur}
          >
            <EmptyOption required />
            <ValueOptions values={offeredValues(types, dropped, storedIds, entry.typeId)} />
          </Select>
          <Select
            aria-label={`${attribute.label} ${TEXTS.position}`}
            className="w-auto min-w-32 flex-1"
            value={optionValue(entry.positionId)}
            disabled={disabled}
            onChange={(event) => change(index, { positionId: idOf(event.target.value) })}
            onBlur={onBlur}
          >
            <EmptyOption required={false} />
            <ValueOptions values={offeredValues(positions, dropped, storedIds, entry.positionId)} />
          </Select>
          {entries.length > 1 && (
            <Button
              disabled={disabled}
              onClick={() => onChange(entries.filter((_, at) => at !== index))}
            >
              {TEXTS.removeEntry}
            </Button>
          )}
        </div>
      ))}
      <Button
        className="self-start"
        disabled={disabled}
        onClick={() => onChange([...entries, EMPTY_PORT])}
      >
        {TEXTS.addEntry}
      </Button>
    </div>
  );
}

function BatteryCapacityField({ value, disabled, control, onChange, onBlur }: AttributeInputProps) {
  const notDeterminable = value !== null && typeof value === 'object' && 'notDeterminable' in value;
  const percent =
    value !== null && typeof value === 'object' && 'percent' in value ? value.percent : '';
  return (
    <div className="flex flex-col gap-2">
      <Input
        {...control}
        inputMode="numeric"
        value={notDeterminable ? '' : percent}
        // With "nicht ermittelbar" the field is emptied and locked, like the MPN with "unbekannt".
        disabled={disabled || notDeterminable}
        onChange={(event) => onChange({ percent: event.target.value })}
        onBlur={onBlur}
      />
      <Checkbox
        label={TEXTS.notDeterminable}
        checked={notDeterminable}
        disabled={disabled}
        onChange={(checked) => onChange(checked ? { notDeterminable: true } : { percent: '' })}
      />
    </div>
  );
}
