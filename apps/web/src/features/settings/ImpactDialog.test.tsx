import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImpactDialog } from './ImpactDialog.tsx';

// Component tests of UI-043 (Technical Specification 6.1, 6.2).

const NO_IMPACT = { updated: 0, rerelease: 0, manualReview: 0 };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function renderDialog(impact: typeof NO_IMPACT | null = NO_IMPACT) {
  const onClose = vi.fn();
  render(<ImpactDialog impact={impact} onClose={onClose} />);
  return { onClose };
}

const dialog = () => screen.getByRole('dialog', { name: 'Auswirkung der Änderung' });

describe('UI-043 impact dialog (CU-103)', () => {
  it('UI-043.empty DER-39-10 an answer with impact 0/0/0 shows "Keine Kanal-Inhalte betroffen" and only "Schließen"', () => {
    renderDialog();

    expect(within(dialog()).getByText('Keine Kanal-Inhalte betroffen')).toBeTruthy();
    const buttons = within(dialog()).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Schließen']);
    // Accessibility: the dialog is named by its title and the focus is inside it.
    expect(dialog().getAttribute('aria-labelledby')).toBeTruthy();
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('UI-043 DER-39-12 has no load of its own, no error state and no reference number', () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    renderDialog();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(within(dialog()).queryByRole('status')).toBeNull();
    expect(within(dialog()).queryByRole('alert')).toBeNull();
    expect(dialog().textContent).not.toMatch(/Referenz|Lade/);
  });

  it('UI-043 DER-39-12 is 480 px wide and never higher than the window', () => {
    renderDialog();

    expect(dialog().style.width).toMatch(/^min\(480px, (100vw - 16px|-16px \+ 100vw)\)$/);
    expect(dialog().style.maxHeight).toBe('calc(100dvh - 16px)');
  });

  it('UI-043 DER-39-12 Esc and "Schließen" lead back to the calling screen', () => {
    const { onClose } = renderDialog();

    fireEvent.keyDown(dialog(), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('stays closed without an answer', () => {
    renderDialog(null);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
