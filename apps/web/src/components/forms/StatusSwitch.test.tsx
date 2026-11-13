import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StatusSwitch } from './StatusSwitch.tsx';

function renderSwitch(checked: boolean, disabled = false) {
  const onChange = vi.fn();
  render(
    <StatusSwitch
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      label="Status"
      activeText="aktiv"
      inactiveText="deaktiviert"
    />,
  );
  return { onChange, control: screen.getByRole('switch', { name: 'Status' }) };
}

describe('StatusSwitch (CU-315, addendum MAR-555)', () => {
  afterEach(cleanup);

  it('is a switch named by its label through aria-labelledby', () => {
    const { control } = renderSwitch(true);
    const labelId = control.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId ?? '')?.textContent).toBe('Status');
  });

  it.each([
    [true, 'true', 'aktiv'],
    [false, 'false', 'deaktiviert'],
  ] as const)('shows checked=%s as aria-checked and its text', (checked, ariaChecked, text) => {
    const { control } = renderSwitch(checked);
    expect(control.getAttribute('aria-checked')).toBe(ariaChecked);
    expect(screen.getByText(text)).toBeTruthy();
  });

  it.each([true, false])('calls onChange with the reversed value of %s', (checked) => {
    const { control, onChange } = renderSwitch(checked);
    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(!checked);
  });

  it('does not call onChange while disabled', () => {
    const { control, onChange } = renderSwitch(true, true);
    expect((control as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(control);
    expect(onChange).not.toHaveBeenCalled();
  });
});
