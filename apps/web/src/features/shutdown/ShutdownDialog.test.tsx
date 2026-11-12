import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { writeOutcomeStore } from '../../api/write-outcome-store.ts';
import { createQueryClient } from '../../app/query-client.ts';
import { shutdownOutcomeStore } from './shutdown-outcome-store.ts';
import { ShutdownDialog } from './ShutdownDialog.tsx';

const REFERENCE_NUMBER = 'R-7K2M-9QX4';

const errorAnswer = (status: number, code: string, referenceNumber: string | null) => () =>
  Promise.resolve(
    Response.json(
      { error: { code, message: '', fields: [], details: {}, referenceNumber } },
      { status },
    ),
  );

const fetchMock = vi.fn<typeof fetch>();

function never(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(new DOMException('aborted', 'AbortError')),
    );
  });
}

/** Opens UI-045 from a button, like the backup notice does. */
function Screen() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        öffnen
      </button>
      <ShutdownDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function openDialog(): HTMLElement {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <Screen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'öffnen' }));
  return screen.getByRole('dialog', { name: 'resellr beenden' });
}

describe('ShutdownDialog (UI-045, CU-255)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    shutdownOutcomeStore.clear();
    vi.unstubAllGlobals();
  });

  it('UI-045.default: DER-96-01 opens without a server call, with title and text of REQ-105 and the focus on "Abbrechen"', async () => {
    const dialog = openDialog();

    expect(within(dialog).getByRole('heading', { name: 'resellr beenden' })).toBeTruthy();
    expect(within(dialog).getByText(FIXED_TEXTS.shutdownQuestion)).toBeTruthy();
    expect(FIXED_TEXTS.shutdownQuestion).toBe(
      'resellr jetzt beenden? Nicht gespeicherte Eingaben gehen verloren. ' +
        'Danach können Sie den Datenordner kopieren.',
    );
    const buttons = within(dialog).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Abbrechen', 'resellr beenden']);
    // Primary, not destructive red (UI-045, P-04).
    expect(buttons[1]!.className).toContain('bg-primary');
    expect(dialog.style.width).toMatch(/^min\(480px, (100vw - 16px|-16px \+ 100vw)\)$/);
    await waitFor(() => expect(document.activeElement).toBe(buttons[0]));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('UI-045.default: DER-96-01 Esc and "Abbrechen" close the dialog without a server call', () => {
    fireEvent.keyDown(openDialog(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'öffnen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('UI-045.loading: DER-96-02 shows "resellr wird beendet …" with both buttons disabled while Esc does nothing', async () => {
    fetchMock.mockImplementation(never);
    const dialog = openDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'resellr beenden' }));

    expect(await within(dialog).findByRole('status')).toHaveProperty(
      'textContent',
      'resellr wird beendet …',
    );
    const buttons = within(dialog).getAllByRole<HTMLButtonElement>('button');
    expect(buttons.map((button) => button.disabled)).toEqual([true, true]);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.pointerDown(document.body);
    expect(screen.getByRole('dialog', { name: 'resellr beenden' })).toBe(dialog);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect([url, init?.method, init?.body]).toEqual(['/api/ops/shutdown', 'POST', '{}']);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('UI-045.loading stays after the answer 200, until the end state UI-046 replaces the frame', async () => {
    fetchMock.mockResolvedValue(Response.json({ dataDirPath: 'C:\\Daten' }));
    const dialog = openDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'resellr beenden' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(within(dialog).getByRole('status').textContent).toBe('resellr wird beendet …');
    expect(
      within(dialog)
        .getAllByRole<HTMLButtonElement>('button')
        .every((button) => button.disabled),
    ).toBe(true);
  });

  it('UI-045.error: DER-96-03 on 500 the dialog closes and the outcome carries the reference number', async () => {
    fetchMock.mockImplementation(errorAnswer(500, 'internal_error', REFERENCE_NUMBER));
    const dialog = openDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'resellr beenden' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const outcome = shutdownOutcomeStore.get();
    expect(outcome?.kind).toBe('error');
    expect(outcome?.kind === 'error' && outcome.error.error?.referenceNumber).toBe(
      REFERENCE_NUMBER,
    );
  });

  it('UI-045.wird-beendet: DER-96-05 on 503 shutting_down the dialog closes with the outcome P-07', async () => {
    fetchMock.mockImplementation(errorAnswer(503, 'shutting_down', null));
    const dialog = openDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'resellr beenden' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(shutdownOutcomeStore.get()).toEqual({ kind: 'shutting-down' });
  });

  it('UI-045.default after a failed attempt shows the question again and clears the outcome when sending', async () => {
    fetchMock.mockImplementation(errorAnswer(500, 'internal_error', REFERENCE_NUMBER));
    fireEvent.click(within(openDialog()).getByRole('button', { name: 'resellr beenden' }));
    await waitFor(() => expect(shutdownOutcomeStore.get()).not.toBeNull());

    fetchMock.mockImplementation(never);
    fireEvent.click(screen.getByRole('button', { name: 'öffnen' }));
    const dialog = screen.getByRole('dialog', { name: 'resellr beenden' });
    expect(within(dialog).queryByRole('status')).toBeNull();
    expect(shutdownOutcomeStore.get()).not.toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'resellr beenden' }));

    expect(shutdownOutcomeStore.get()).toBeNull();
    expect(await within(dialog).findByRole('status')).toBeTruthy();
  });

  it('UI-045.loading stays without an answer, until the end state UI-046 replaces the frame', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const dialog = openDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'resellr beenden' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByRole('dialog', { name: 'resellr beenden' })).toBe(dialog);
    expect(within(dialog).getByRole('status')).toBeTruthy();
    expect(shutdownOutcomeStore.get()).toBeNull();
  });

  // Last test of the file: the write lock lasts until the page is reloaded (CU-049).
  it('UI-045.default with writes locked until reload (P-08) the action is disabled and sends nothing', () => {
    writeOutcomeStore.lock();
    const dialog = openDialog();

    const action = within(dialog).getByRole<HTMLButtonElement>('button', {
      name: 'resellr beenden',
    });
    fireEvent.click(action);

    expect(action.disabled).toBe(true);
    expect(within(dialog).queryByRole('status')).toBeNull();
    expect(
      within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Abbrechen' }).disabled,
    ).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
