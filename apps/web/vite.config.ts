import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

// Build of web-ui (ADR-001). The server delivers `dist/index.html` and `dist/assets/*`
// (Technical Specification 2.0.1); JSX is compiled by esbuild from `tsconfig.json`.
const SERVER_ORIGIN = `http://127.0.0.1:${process.env.PORT ?? '4310'}`;

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    host: '127.0.0.1',
    // Development only: forward the API to the local server with the host and origin
    // that `local-guard` expects (Technical Specification 2.0.2).
    proxy: {
      '/api': { target: SERVER_ORIGIN, changeOrigin: true, headers: { origin: SERVER_ORIGIN } },
    },
  },
  test: {
    name: 'web',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
