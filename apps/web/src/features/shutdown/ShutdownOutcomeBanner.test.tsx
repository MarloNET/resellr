import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ApiError } from '../../api/api-client.ts';
import { createShutdownOutcomeStore } from './shutdown-outcome-store.ts';
import { ShutdownOutcomeBanner } from './ShutdownOutcomeBanner.tsx';

const REFERENCE_NUMBER = 'R-7K2M-9QX4';

const internalError = new ApiError('error', 500, {
  code: 'internal_error',
  message: '',
  fields: [],
  details: {},
  referenceNumber: REFERENCE_NUMBER,
});

describe('ShutdownOutcomeBanner (CU-312, Nachtrag MAR-421)', () => {
  afterEach(cleanup);

  it('shows nothing without an outcome', () => {
    render(<ShutdownOutcomeBanner store={createShutdownOutcomeStore()} />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('UI-045.error shows the text with the reference number and "×", which clears the outcome', () => {
    const store = createShutdownOutcomeStore();
    store.set({ kind: 'error', error: internalError });
    render(<ShutdownOutcomeBanner store={store} />);

    const banner = screen.getByRole('alert');
    expect(banner.textContent).toBe(`${FIXED_TEXTS.shutdownError(REFERENCE_NUMBER)}×`);
    expect(banner.className).toContain('bg-error-bg');

    fireEvent.click(screen.getByRole('button', { name: FIXED_TEXTS.closeBanner }));

    expect(store.get()).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('UI-045.wird-beendet shows P-07 without reference number and without "×"', () => {
    const store = createShutdownOutcomeStore();
    render(<ShutdownOutcomeBanner store={store} />);

    act(() => store.set({ kind: 'shutting-down' }));

    const banner = screen.getByRole('alert');
    expect(banner.textContent).toBe(FIXED_TEXTS.shuttingDownBanner);
    expect(banner.className).toContain('bg-flag-warn-bg');
    expect(banner.textContent).not.toMatch(/R-[0-9A-Z]{4}-[0-9A-Z]{4}/);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
