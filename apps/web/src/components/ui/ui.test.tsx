import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './Dialog.tsx';
import { Sheet, SheetContent, SheetTrigger } from './Sheet.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './Table.tsx';

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
