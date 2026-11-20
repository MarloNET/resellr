import { defineConfig } from 'vitest/config';

// Tests of `server`: unit (`*.test.ts`) and integration (`*.int.test.ts`) tests next to the unit
// they test (Technical Specification 4.2, 6.1); after each of them the invariant test of the
// stock columns (DER-65-03, 3.3).
export default defineConfig({
  test: {
    name: '@resellr/server',
    setupFiles: ['./test/stock-invariant.ts'],
  },
});
