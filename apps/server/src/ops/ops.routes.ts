import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { LifecycleState } from './lifecycle-state.ts';

export interface OpsRoutesOptions {
  lifecycle: LifecycleState;
  /** Start identifier from the supervisor (`RESELLR_START_ID`); null when started directly. */
  startId: string | null;
  /** Data folder shown in UI-044 and UI-046 (REQ-104, REQ-106). */
  dataDirPath: string;
  appVersion: string;
}

const healthResponse = z.object({
  state: z.enum(['starting', 'ready', 'stopping']),
  startId: z.string().nullable(),
});

// Only what the design shows; size, free space and the kind of the last end stay in the
// operations log (2.17, X-8).
const statusResponse = z.object({
  dataDirPath: z.string(),
  appVersion: z.string(),
});

/**
 * Ops routes (CU-041, Technical Specification 2.17): `GET /api/ops/health` and
 * `GET /api/ops/status`. `POST /api/ops/shutdown` follows in S10.
 */
export const opsRoutes: FastifyPluginAsyncZod<OpsRoutesOptions> = async (
  app,
  { lifecycle, startId, dataDirPath, appVersion },
) => {
  app.get('/api/ops/health', { schema: { response: { 200: healthResponse } } }, async () => ({
    state: lifecycle.get(),
    startId,
  }));

  app.get('/api/ops/status', { schema: { response: { 200: statusResponse } } }, async () => ({
    dataDirPath,
    appVersion,
  }));
};
