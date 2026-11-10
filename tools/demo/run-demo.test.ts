import { describe, expect, it } from 'vitest';

import { demoPort } from './run-demo.ts';

describe('demoPort', () => {
  it('uses 4310 without PORT (Baseline 11.3)', () => {
    expect(demoPort(undefined)).toBe(4310);
    expect(demoPort('')).toBe(4310);
  });

  it('uses PORT when it is a port number', () => {
    expect(demoPort('4311')).toBe(4311);
    expect(demoPort('1')).toBe(1);
    expect(demoPort('65535')).toBe(65535);
  });

  it.each(['0', '65536', '43.1', '-1', 'abc', ' 4311'])('rejects PORT %j', (value) => {
    expect(() => demoPort(value)).toThrow('PORT must be a port number');
  });
});
