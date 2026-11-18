import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  chooseModelTemplateInDraft,
  clearDeviceIntakeDraft,
  DEVICE_INTAKE_DRAFT_KEY,
  FROM_DEVICE_INTAKE,
  isCalledFromDeviceIntake,
  readDeviceIntakeDraft,
  storeDeviceIntakeDraft,
} from './device-intake-draft.ts';

// Unit tests of the draft of UI-003 in the `sessionStorage` (CU-133, Technical Specification 2.5).

const FORM = { wiNr: '626198', supplierId: 4, visualGrade: '3' };

describe('device intake draft (CU-133)', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('DER-54-07 stores the inputs under resellr.deviceIntake.draft and restores them', () => {
    storeDeviceIntakeDraft(FORM);

    expect(DEVICE_INTAKE_DRAFT_KEY).toBe('resellr.deviceIntake.draft');
    expect(JSON.parse(sessionStorage.getItem('resellr.deviceIntake.draft') ?? '')).toEqual({
      form: FORM,
      modelTemplateId: null,
    });
    expect(readDeviceIntakeDraft()).toEqual({ form: FORM, modelTemplateId: null });
  });

  it('DER-54-07 adds the model template to choose and keeps the inputs', () => {
    storeDeviceIntakeDraft(FORM);

    chooseModelTemplateInDraft(42);

    expect(readDeviceIntakeDraft()).toEqual({ form: FORM, modelTemplateId: 42 });
  });

  it('adds the model template also without stored inputs', () => {
    chooseModelTemplateInDraft(42);

    expect(readDeviceIntakeDraft()).toEqual({ form: null, modelTemplateId: 42 });
  });

  it('removes the draft once taken over', () => {
    storeDeviceIntakeDraft(FORM);

    clearDeviceIntakeDraft();

    expect(sessionStorage.getItem(DEVICE_INTAKE_DRAFT_KEY)).toBeNull();
    expect(readDeviceIntakeDraft()).toBeNull();
  });

  it('reads no draft from an unreadable entry or storage', () => {
    sessionStorage.setItem(DEVICE_INTAKE_DRAFT_KEY, '{kein JSON');
    expect(readDeviceIntakeDraft()).toBeNull();

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readDeviceIntakeDraft()).toBeNull();
  });

  it('does not fail when the storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(() => storeDeviceIntakeDraft(FORM)).not.toThrow();
  });

  it('tells a call from UI-003 by its history state', () => {
    expect(isCalledFromDeviceIntake(FROM_DEVICE_INTAKE)).toBe(true);
    expect(isCalledFromDeviceIntake(null)).toBe(false);
    expect(isCalledFromDeviceIntake({ savedNotice: 'x' })).toBe(false);
  });
});
