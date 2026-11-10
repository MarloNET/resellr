import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { sendError } from '../http/index.ts';
import type { LifecycleState } from './lifecycle-state.ts';
import type { ShutdownService } from './shutdown-service.ts';

export interface OpsRoutesOptions {
  lifecycle: LifecycleState;
  /** Start identifier from the supervisor (`RESELLR_START_ID`); null when started directly. */
  startId: string | null;
  /** Data folder shown in UI-044 and UI-046 (REQ-104, REQ-106). */
  dataDirPath: string;
  appVersion: string;
  shutdownService: ShutdownService;
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

const shutdownRequest = z.strictObject({});

const shutdownResponse = z.object({ dataDirPath: z.string() });

/**
 * Ops routes (CU-041, Technical Specification 2.17): `GET /api/ops/health`,
 * `GET /api/ops/status` and `POST /api/ops/shutdown`.
 */
export const opsRoutes: FastifyPluginAsyncZod<OpsRoutesOptions> = async (
  app,
  { lifecycle, startId, dataDirPath, appVersion, shutdownService },
) => {
  app.get('/api/ops/health', { schema: { response: { 200: healthResponse } } }, async () => ({
    state: lifecycle.get(),
    startId,
  }));

  app.get('/api/ops/status', { schema: { response: { 200: statusResponse } } }, async () => ({
    dataDirPath,
    appVersion,
  }));

  // The write gate rejects it in state `stopping` (503 shutting_down), but does not count it:
  // the shutdown waits for the other writes (2.17 step 3). Without `Origin` from the launcher (G-3).
  app.post(
    '/api/ops/shutdown',
    {
      config: { uncountedWrite: true },
      schema: { body: shutdownRequest, response: { 200: shutdownResponse } },
    },
    async (_request, reply) => {
      const result = await shutdownService.shutdown();
      if (result.state === 'failed') {
        return sendError(reply, 'internal_error', { referenceNumber: result.refNo });
      }
      shutdownService.exitAfterResponse(reply.raw);
      return { dataDirPath: result.dataDirPath };
    },
  );
};
