import { describe, expect, it } from 'vitest';

import { CHANGE_EVENT_TYPES, CHECK_EVENT_TYPES } from './events.ts';

describe('event types (CU-034)', () => {
  it('has the five change events of Technical Specification 2.8.3', () => {
    expect([...CHANGE_EVENT_TYPES].sort()).toEqual([
      'ChannelActivated',
      'ContentInputsChanged',
      'ListingCreated',
      'SettingsChanged',
      'StockChanged',
    ]);
  });

  it('has the four check events of Technical Specification 2.8.3', () => {
    expect([...CHECK_EVENT_TYPES].sort()).toEqual([
      'ListingDeleting',
      'ModelTemplateDeleting',
      'ModelTemplateDeviceTypeChanging',
      'VariantSetChanging',
    ]);
  });
});
