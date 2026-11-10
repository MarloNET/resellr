import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState, type RefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './Dialog.tsx';
import { Sheet, SheetContent, SheetTrigger } from './Sheet.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './Table.tsx';

/** A screen that opens a dialog from a button without `DialogTrigger`, like the feature screens. */
function DialogScreen({
  useOtherTarget = false,
  targetRef,
  onCloseAutoFocus,
}: {
  useOtherTarget?: boolean;
  targetRef?: RefObject<HTMLElement | null>;
  onCloseAutoFocus?: (event: Event, otherTarget: HTMLElement | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const otherTargetRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef: RefObject<HTMLElement | null> | undefined =
    targetRef ?? (useOtherTarget ? otherTargetRef : undefined);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Als beendet melden
      </button>
      <button type="button" ref={otherTargetRef}>
        Statusanzeige
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          width={480}
          returnFocusRef={returnFocusRef}
          onCloseAutoFocus={
            onCloseAutoFocus && ((event) => onCloseAutoFocus(event, otherTargetRef.current))
          }
        >
          <DialogHeader>
            <DialogTitle>Als beendet melden</DialogTitle>
          </DialogHeader>
          <DialogBody>Inhalt</DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button>Abbrechen</Button>
            </DialogClose>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Melden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function openDialogFromFocusedButton(): HTMLElement {
  const opener = screen.getByRole('button', { name: 'Als beendet melden' });
  opener.focus();
  fireEvent.click(opener);
  return screen.getByRole('dialog', { name: 'Als beendet melden' });
}

describe('UI building blocks (Technical Specification 2.0.10)', () => {
  afterEach(cleanup);

  it('Dialog takes its design width, never wider than the window minus 16 px', () => {
    render(
      <Dialog open>
        <DialogContent width={720}>
          <DialogHeader>
            <DialogTitle>Gerät zuordnen</DialogTitle>
          </DialogHeader>
          <DialogBody>Inhalt</DialogBody>
          <DialogFooter>
            <Button>Abbrechen</Button>
            <Button variant="primary">Zuordnen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Gerät zuordnen' });
    expect(dialog.style.width).toMatch(/^min\(720px, (100vw - 16px|-16px \+ 100vw)\)$/);
    expect(dialog.style.maxHeight).toBe('calc(100dvh - 16px)');
    expect(dialog.className).toContain('flex-col');
    expect(screen.getByText('Inhalt').className).toContain('overflow-y-auto');
  });

  it('E1 Dialog returns the focus to the opening element after Esc', async () => {
    render(<DialogScreen />);
    const dialog = openDialogFromFocusedButton();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Als beendet melden' }),
      ),
    );
  });

  it('E1 Dialog returns the focus to the opening element after "Abbrechen"', async () => {
    render(<DialogScreen />);
    openDialogFromFocusedButton();

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Als beendet melden' }),
      ),
    );
  });

  it('E1 Dialog returns the focus to the opening element after the action', async () => {
    render(<DialogScreen />);
    openDialogFromFocusedButton();

    fireEvent.click(screen.getByRole('button', { name: 'Melden' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Als beendet melden' }),
      ),
    );
  });

  it('E1 Dialog moves the focus to the target the screen sets instead', async () => {
    render(<DialogScreen useOtherTarget />);
    openDialogFromFocusedButton();

    fireEvent.click(screen.getByRole('button', { name: 'Melden' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Statusanzeige' })),
    );
  });

  /** A target the screen set, e.g. a list cell, that is gone from the DOM when the dialog closes. */
  function removedTarget(): RefObject<HTMLElement | null> {
    const target = document.createElement('button');
    document.body.append(target);
    target.remove();
    return { current: target };
  }

  it('F1 Dialog returns the focus to the opening element after Esc when the target is gone', async () => {
    render(<DialogScreen targetRef={removedTarget()} />);
    const dialog = openDialogFromFocusedButton();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Als beendet melden' }),
      ),
    );
  });

  it('F1 Dialog returns the focus to the opening element after "Abbrechen" when the target is gone', async () => {
    render(<DialogScreen targetRef={removedTarget()} />);
    openDialogFromFocusedButton();

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Als beendet melden' }),
      ),
    );
  });

  it('F2 an own onCloseAutoFocus with preventDefault() takes precedence over the focus return', async () => {
    const onCloseAutoFocus = vi.fn((event: Event, otherTarget: HTMLElement | null) => {
      event.preventDefault();
      otherTarget?.focus();
    });
    render(<DialogScreen onCloseAutoFocus={onCloseAutoFocus} />);
    openDialogFromFocusedButton();

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledOnce());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Statusanzeige' }));
  });

  it('F2 an own onCloseAutoFocus without preventDefault() keeps the focus return', async () => {
    const onCloseAutoFocus = vi.fn();
    render(<DialogScreen onCloseAutoFocus={onCloseAutoFocus} />);
    openDialogFromFocusedButton();

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    await waitFor(() => expect(onCloseAutoFocus).toHaveBeenCalledOnce());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Als beendet melden' }));
  });

  it('Sheet overlays with "Schließen" and closes with it and with Esc', () => {
    render(
      <Sheet>
        <SheetTrigger>Panel</SheetTrigger>
        <SheetContent title="Geräte" width={400}>
          Liste
        </SheetContent>
      </Sheet>,
    );

    fireEvent.click(screen.getByText('Panel'));
    expect(screen.getByRole('dialog', { name: 'Geräte' }).style.width).toMatch(
      /^min\(400px, (100vw - 16px|-16px \+ 100vw)\)$/,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByText('Panel'));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Table scrolls horizontally in its own container with a fixed first column', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Titel</TableHead>
            <TableHead>Stückzahl</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>ThinkPad</TableCell>
            <TableCell>2</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    const table = screen.getByRole('table');
    expect(table.parentElement?.className).toContain('overflow-x-auto');
    expect(table.parentElement?.className).toContain('min-w-0');
    expect(table.className).toContain('[&_tr>*:first-child]:sticky');
    expect(table.className).toContain('[&_tr>*:first-child]:left-0');
    expect(table.className).toContain('tabular-nums');
  });

  it('Button and Badge use the token classes', () => {
    render(
      <>
        <Button variant="primary">Freigeben</Button>
        <Badge variant="published">Veröffentlicht</Badge>
      </>,
    );

    const button = screen.getByRole('button', { name: 'Freigeben' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('rounded-control');
    expect(screen.getByText('Veröffentlicht').className).toContain('rounded-chip');
  });
});
