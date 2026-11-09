import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '../../app/query-client.ts';
import { ConflictBanner } from './ConflictBanner.tsx';

function setup(ui: ReactNode) {
  const client = createQueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const reset = vi.spyOn(client, 'resetQueries');
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { invalidate, reset };
}

describe('ConflictBanner (CU-052, P-05)', () => {
  afterEach(cleanup);

  it('E1 shows the conflict text of design chapter 5 with "Neu laden", without "×"', () => {
    setup(<ConflictBanner />);

    const banner = screen.getByRole('alert');
    expect(banner.textContent).toBe(`${FIXED_TEXTS.conflictBanner}Neu laden`);
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Meldung schließen' })).toBeNull();
    expect(banner.className).toContain('bg-flag-warn-bg');
  });

  it('E1 "Neu laden" only calls invalidateQueries; page and inputs stay', async () => {
    const onReloaded = vi.fn();
    const { invalidate, reset } = setup(
      <form>
        <ConflictBanner onReloaded={onReloaded} />
        <input aria-label="Titel" defaultValue="ThinkPad T14 neu" />
      </form>,
    );
    const location = window.location.href;

    fireEvent.click(screen.getByRole('button', { name: 'Neu laden' }));

    expect(invalidate).toHaveBeenCalledOnce();
    expect(reset).not.toHaveBeenCalled();
    expect(window.location.href).toBe(location);
    expect((screen.getByLabelText('Titel') as HTMLInputElement).value).toBe('ThinkPad T14 neu');
    await waitFor(() => expect(onReloaded).toHaveBeenCalledOnce());
  });

  it('E1 takes the text of a screen instead of the default text', () => {
    setup(<ConflictBanner>Bitte neu laden</ConflictBanner>);

    expect(screen.getByRole('alert').textContent).toContain('Bitte neu laden');
    expect(screen.queryByText(FIXED_TEXTS.conflictBanner)).toBeNull();
  });
});
