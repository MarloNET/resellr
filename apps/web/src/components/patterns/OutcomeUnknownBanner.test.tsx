import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, createApiClient } from '../../api/api-client.ts';
import { createWriteOutcomeStore, useWritesLocked } from '../../api/write-outcome-store.ts';
import { OutcomeUnknownBanner } from './OutcomeUnknownBanner.tsx';

describe('OutcomeUnknownBanner (CU-055, P-08)', () => {
  afterEach(cleanup);

  it('E4 is hidden while the outcome of every write is known', () => {
    render(<OutcomeUnknownBanner store={createWriteOutcomeStore()} />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('E4 shows "Ausgang unbekannt, bitte neu laden." with the addition, without button and "×"', () => {
    const store = createWriteOutcomeStore();
    store.lock();
    render(<OutcomeUnknownBanner store={store} />);

    const banner = screen.getByRole('alert');
    expect(banner.textContent).toBe(
      `${FIXED_TEXTS.outcomeUnknownBanner} ${FIXED_TEXTS.outcomeUnknownHint}`,
    );
    expect(screen.getByText(FIXED_TEXTS.outcomeUnknownBanner).tagName).toBe('STRONG');
    expect(banner.textContent).not.toMatch(/R-[0-9A-Z]{4}-[0-9A-Z]{4}/);
    expect(screen.queryByRole('button')).toBeNull();
    expect(banner.className).toContain('bg-flag-warn-bg');
  });

  it('E4 appears after a write without answer, stays and locks every further write', async () => {
    const store = createWriteOutcomeStore();
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = createApiClient({ fetch: fetchMock, writeOutcomeStore: store });

    function Page() {
      const locked = useWritesLocked(store);
      return (
        <form>
          <OutcomeUnknownBanner store={store} />
          <input aria-label="WI-Nr" defaultValue="626198" />
          <button type="button" disabled={locked} onClick={() => void save()}>
            Gerät speichern
          </button>
        </form>
      );
    }
    const errors: ApiError[] = [];
    async function save() {
      try {
        await client.post('/api/devices', { wiNr: '626198' });
      } catch (error) {
        errors.push(error as ApiError);
      }
    }
    render(<Page />);

    fireEvent.click(screen.getByRole('button', { name: 'Gerät speichern' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(errors.map((error) => error.kind)).toEqual(['outcome-unknown']);
    expect(
      (screen.getByRole('button', { name: 'Gerät speichern' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByLabelText('WI-Nr') as HTMLInputElement).value).toBe('626198');

    await expect(client.post('/api/devices', {})).rejects.toMatchObject({
      kind: 'outcome-unknown',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('E4 keeps the fixed core and takes the addition of a screen instead of the default', () => {
    const store = createWriteOutcomeStore();
    store.lock();
    render(<OutcomeUnknownBanner store={store}>Bitte neu laden.</OutcomeUnknownBanner>);

    expect(screen.getByRole('alert').textContent).toBe(
      `${FIXED_TEXTS.outcomeUnknownBanner} Bitte neu laden.`,
    );
  });
});
