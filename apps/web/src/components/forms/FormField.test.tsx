import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState, type FormEvent } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Input } from '../ui/Input.tsx';
import { FormField, useFocusFirstError } from './FormField.tsx';

type Errors = Partial<Record<'wiNr' | 'supplier' | 'note', string>>;

/** A form like the feature screens build it: the errors come from the check on "Speichern". */
function DeviceForm({ check }: { check: () => Errors }) {
  const formRef = useRef<HTMLFormElement>(null);
  const focusFirstError = useFocusFirstError(formRef);
  const [errors, setErrors] = useState<Errors>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = check();
    setErrors(next);
    if (Object.keys(next).length > 0) focusFirstError();
  }

  return (
    <form ref={formRef} onSubmit={submit}>
      <FormField label="WI-Nr" required error={errors.wiNr}>
        {(control) => <Input {...control} />}
      </FormField>
      <FormField label="Lieferant" required error={errors.supplier}>
        {(control) => <Input {...control} />}
      </FormField>
      <FormField label="Notiz" error={errors.note}>
        {(control) => <Input {...control} />}
      </FormField>
      <button type="submit">Gerät speichern</button>
    </form>
  );
}

describe('FormField (CU-057, design chapter 5)', () => {
  afterEach(cleanup);

  it('shows the label above the field and marks required fields with "*"', () => {
    render(<DeviceForm check={() => ({})} />);

    const wiNr = screen.getByRole('textbox', { name: 'WI-Nr' });
    const label = screen.getByText('WI-Nr').closest('label')!;
    expect(label.htmlFor).toBe(wiNr.id);
    expect(label.textContent).toBe('WI-Nr*');
    expect(label.compareDocumentPosition(wiNr) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(wiNr.getAttribute('aria-required')).toBe('true');

    const note = screen.getByRole('textbox', { name: 'Notiz' });
    expect(note.getAttribute('aria-required')).toBeNull();
    expect(screen.getByText('Notiz').closest('label')!.textContent).toBe('Notiz');
  });

  it('E6 shows the error text below the field, linked to it', () => {
    render(
      <FormField
        label="WI-Nr"
        required
        error="WI-Nr darf nur Buchstaben und Ziffern enthalten (1–20 Zeichen)"
      >
        {(control) => <Input {...control} defaultValue="62-61" />}
      </FormField>,
    );

    const field = screen.getByRole('textbox', { name: 'WI-Nr' });
    const message = screen.getByText(
      'WI-Nr darf nur Buchstaben und Ziffern enthalten (1–20 Zeichen)',
    );
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(field.getAttribute('aria-describedby')).toBe(message.id);
    expect(field.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(message.parentElement?.className).toContain('text-error');
    expect(message.parentElement?.querySelector('svg')).not.toBeNull();
  });

  it('E6 a field without error is not marked invalid and has no error text', () => {
    const { container } = render(
      <FormField label="Notiz">{(control) => <Input {...control} />}</FormField>,
    );

    const field = screen.getByRole('textbox', { name: 'Notiz' });
    expect(field.getAttribute('aria-invalid')).toBeNull();
    expect(field.getAttribute('aria-describedby')).toBeNull();
    expect(container.querySelector('.text-error')).toBeNull();
  });

  it('E6 on an error the first faulty field receives the focus', () => {
    render(
      <DeviceForm
        check={() => ({ note: 'Notiz: höchstens 500 Zeichen', supplier: 'Pflichtfeld' })}
      />,
    );
    screen.getByRole('button', { name: 'Gerät speichern' }).focus();

    fireEvent.submit(screen.getByRole('button', { name: 'Gerät speichern' }));

    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Lieferant' }));
    expect(screen.getByText('Pflichtfeld')).toBeTruthy();
    expect(screen.getByText('Notiz: höchstens 500 Zeichen')).toBeTruthy();
  });

  it('E6 the focus follows the first error of each new check', () => {
    let errors: Errors = { supplier: 'Pflichtfeld' };
    render(<DeviceForm check={() => errors} />);
    const submit = screen.getByRole('button', { name: 'Gerät speichern' });

    fireEvent.submit(submit);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Lieferant' }));

    errors = { wiNr: 'WI-Nr bereits vergeben', supplier: 'Pflichtfeld' };
    screen.getByRole('textbox', { name: 'Notiz' }).focus();
    fireEvent.submit(submit);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'WI-Nr' }));
  });

  it('E6 without errors the focus stays where it is', () => {
    render(<DeviceForm check={() => ({})} />);
    const note = screen.getByRole('textbox', { name: 'Notiz' });
    note.focus();

    fireEvent.submit(screen.getByRole('button', { name: 'Gerät speichern' }));

    expect(document.activeElement).toBe(note);
  });

  it('E5 (#285) an error text without spaces wraps instead of overflowing the field', () => {
    const longWord = 'https://www.example.com/' + 'a'.repeat(200);
    render(
      <FormField label="Shop-Adresse" error={longWord}>
        {(control) => <Input {...control} />}
      </FormField>,
    );

    const text = screen.getByText(longWord);
    expect(text.className).toContain('[overflow-wrap:anywhere]');
    expect(text.className).toContain('min-w-0');
  });
});
