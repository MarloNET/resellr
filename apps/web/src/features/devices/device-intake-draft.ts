/**
 * Draft of UI-003 "Gerät einbuchen" (CU-133; Technical Specification 2.5 "Zustände", Baseline
 * 6.4): the inputs of the form stay in the `sessionStorage` of the window while the user creates
 * a model template in UI-007 and returns (DER-54-07). UI-007 adds the model template to choose on
 * the return: the new one after "Modellvorlage speichern" or the existing one after "Vorhandene
 * verwenden" (DER-54-14). The draft is read once when UI-003 opens and then removed.
 */

/** Key of the draft in the `sessionStorage` (2.5). */
export const DEVICE_INTAKE_DRAFT_KEY = 'resellr.deviceIntake.draft';

/** Route of UI-003 (2.0.1 "Routen der Oberfläche"). */
export const DEVICE_INTAKE_PATH = '/geraete/neu';

/** The stored draft: the inputs of UI-003 and the model template to choose on the return. */
export interface DeviceIntakeDraft<Form> {
  /** The inputs as UI-003 left them; `null` if UI-007 was not opened from a stored form. */
  form: Form | null;
  /** The model template UI-007 hands back to UI-003, if any. */
  modelTemplateId: number | null;
}

/** History state of the link "Neue Modellvorlage anlegen", so UI-007 knows its calling page. */
export interface DeviceIntakeCallerState {
  caller: 'device-intake';
}

export const FROM_DEVICE_INTAKE: DeviceIntakeCallerState = { caller: 'device-intake' };

/** Whether UI-007 was opened from UI-003 (its calling page then is UI-003, screen.md UI-007). */
export function isCalledFromDeviceIntake(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as Partial<DeviceIntakeCallerState>).caller === FROM_DEVICE_INTAKE.caller
  );
}

/** The stored draft, or `null` if there is none or it cannot be read. */
export function readDeviceIntakeDraft<Form>(): DeviceIntakeDraft<Form> | null {
  try {
    const stored = sessionStorage.getItem(DEVICE_INTAKE_DRAFT_KEY);
    if (stored === null) return null;
    const parsed = JSON.parse(stored) as Partial<DeviceIntakeDraft<Form>> | null;
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      form: parsed.form ?? null,
      modelTemplateId: typeof parsed.modelTemplateId === 'number' ? parsed.modelTemplateId : null,
    };
  } catch {
    // Without a readable storage UI-003 opens empty, as on its first call.
    return null;
  }
}

function writeDraft<Form>(draft: DeviceIntakeDraft<Form>): void {
  try {
    sessionStorage.setItem(DEVICE_INTAKE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Without a writable storage the inputs are not kept; UI-007 still opens.
  }
}

/** Stores the inputs of UI-003 before UI-007 opens ("Neue Modellvorlage anlegen"). */
export function storeDeviceIntakeDraft<Form>(form: Form): void {
  writeDraft({ form, modelTemplateId: null });
}

/** Adds the model template UI-003 chooses on the return from UI-007; the inputs stay. */
export function chooseModelTemplateInDraft(modelTemplateId: number): void {
  writeDraft({ form: readDeviceIntakeDraft()?.form ?? null, modelTemplateId });
}

/** Removes the draft once UI-003 has taken it over. */
export function clearDeviceIntakeDraft(): void {
  try {
    sessionStorage.removeItem(DEVICE_INTAKE_DRAFT_KEY);
  } catch {
    // Nothing stored that could be removed.
  }
}
