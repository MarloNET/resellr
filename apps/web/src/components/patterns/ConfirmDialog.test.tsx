import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConfirmDialog, type ConfirmDialogProps } from './ConfirmDialog.tsx';

function renderDialog(props: Partial<ConfirmDialogProps> = {}) {
  const onOpenChange = vi.fn();
  const onConfirm = vi.fn();
  const title = props.title ?? 'Gerät stornieren';
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={title}
      confirmLabel="Stornieren"
      width={480}
      {...props}
    >
      Das Gerät 626198 wird storniert und zählt nicht mehr zum Bestand.
    </ConfirmDialog>,
  );
  return { dialog: screen.getByRole('dialog', { name: title }), onOpenChange, onConfirm };
}

/** A screen opening the dialog from a focused button; after success the focus may move elsewhere. */
function ConfirmScreen({ focusCellOnSuccess = false }: { focusCellOnSuccess?: boolean }) {
  const [open, setOpen] = useState(false);
  const cellRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Kopie entfernen
      </button>
      <button type="button" ref={cellRef}>
        Zelle
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={() => {
          if (focusCellOnSuccess) returnFocusRef.current = cellRef.current;
          setOpen(false);
        }}
        returnFocusRef={returnFocusRef}
        title="Kopie entfernen"
        confirmLabel="Entfernen"
        width={480}
      >
        Die Kopie wird entfernt.
      </ConfirmDialog>
    </>
  );
}

function openFromFocusedButton(): HTMLElement {
  const opener = screen.getByRole('button', { name: 'Kopie entfernen' });
  opener.focus();
  fireEvent.click(opener);
  return screen.getByRole('dialog', { name: 'Kopie entfernen' });
}

describe('ConfirmDialog (CU-056, P-04)', () => {
  afterEach(cleanup);

  it('E7 has the action as title, the effect as content and an action bar', () => {
    const { dialog } = renderDialog();

    expect(within(dialog).getByRole('heading', { name: 'Gerät stornieren' })).toBeTruthy();
    expect(dialog.textContent).toContain(
      'Das Gerät 626198 wird storniert und zählt nicht mehr zum Bestand.',
    );
    const buttons = within(dialog).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Abbrechen', 'Stornieren']);
  });

  it('E4 links the content naming the effect as description of the dialog', () => {
    const { dialog } = renderDialog();

    const describedBy = dialog.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const description = document.getElementById(describedBy ?? '');
    expect(description?.textContent).toBe(
      'Das Gerät 626198 wird storniert und zählt nicht mehr zum Bestand.',
    );
  });

  it('E1 returns the focus to the opening button after Esc, "Abbrechen" and the action', async () => {
    render(<ConfirmScreen />);
    const opener = screen.getByRole('button', { name: 'Kopie entfernen' });

    fireEvent.keyDown(openFromFocusedButton(), { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(opener));

    openFromFocusedButton();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(document.activeElement).toBe(opener));

    openFromFocusedButton();
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('E1 moves the focus to the target the screen sets after success', async () => {
    render(<ConfirmScreen focusCellOnSuccess />);

    openFromFocusedButton();
    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Zelle' })),
    );
  });

  it('E7 keeps title and actions visible in a low window while the content scrolls', () => {
    const { dialog } = renderDialog();

    expect(dialog.style.maxHeight).toBe('calc(100dvh - 16px)');
    expect(dialog.style.width).toMatch(/^min\(480px, (100vw - 16px|-16px \+ 100vw)\)$/);
    expect(dialog.className).toContain('flex-col');
    const title = within(dialog).getByRole('heading', { name: 'Gerät stornieren' });
    expect(title.parentElement?.className).toContain('shrink-0');
    const body = within(dialog).getByText(/Das Gerät 626198/);
    expect(body.className).toContain('overflow-y-auto');
    expect(body.className).toContain('min-h-0');
    const actionBar = within(dialog).getByRole('button', { name: 'Abbrechen' }).parentElement;
    expect(actionBar?.className).toContain('shrink-0');
    expect(actionBar?.className).toContain('justify-end');
  });

  it('P-04 shows the action as destructive for delete and cancel, otherwise as primary', () => {
    renderDialog({ destructive: true });
    expect(screen.getByRole('button', { name: 'Stornieren' }).className).toContain('text-error');
    cleanup();

    renderDialog({ title: 'resellr beenden', confirmLabel: 'resellr beenden' });
    expect(screen.getByRole('button', { name: 'resellr beenden' }).className).toContain(
      'bg-primary',
    );
  });

  it('P-04 "Abbrechen" and Esc close without the action', () => {
    const { dialog, onOpenChange, onConfirm } = renderDialog();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onOpenChange.mock.calls).toEqual([[false], [false]]);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('P-04 the action calls onConfirm once', () => {
    const { onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Stornieren' }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('P-04 a disabled action cannot be triggered, e.g. while writes are locked (P-08)', () => {
    const { onConfirm } = renderDialog({ confirmDisabled: true });

    const action = screen.getByRole<HTMLButtonElement>('button', { name: 'Stornieren' });
    fireEvent.click(action);

    expect(action.disabled).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
