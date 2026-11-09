import { defineConfig } from 'vitest/config';

// One Vitest project per workspace package; unit (`*.test.ts`) and integration
// (`*.int.test.ts`) tests live next to the unit they test (Technical Specification 4.2, 6.1).
export default defineConfig({
  test: {
    projects: [
      'apps/*',
      'packages/*',
      'tools/*',
      {
        test: {
          name: 'workspace-root',
          include: ['test/**/*.test.ts'],
          exclude: ['test/fixtures/**'],
        },
      },
    ],
  },
});
