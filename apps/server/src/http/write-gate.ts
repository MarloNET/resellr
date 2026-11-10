import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { LifecycleState } from '../ops/index.ts';
import { ShuttingDownError } from '../shared/domain-error.ts';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

declare module 'fastify' {
  interface FastifyContextConfig {
    /**
     * The write gate rejects the write in state `stopping` but does not count it as running.
     * Only `POST /api/ops/shutdown`, which waits for the running writes itself (2.17 step 3).
     */
    uncountedWrite?: boolean;
  }
}

export interface WriteGate {
  /** Writes that were accepted and have not sent their response yet. */
  activeWrites(): number;
  /** Resolves true once no write runs, or false after `timeoutMs` (shutdown waits 10 s, 2.17). */
  waitUntilIdle(timeoutMs: number): Promise<boolean>;
}

/**
 * Write gate (CU-024, Technical Specification 2.0.4): in state `stopping` every new write is
 * rejected with `503 shutting_down` (P-07); reads keep working. Accepted writes are counted
 * until their response is sent, successful or not.
 */
export function registerWriteGate(
  app: FastifyInstance,
  { lifecycle }: { lifecycle: LifecycleState },
): WriteGate {
  const running = new Set<FastifyRequest>();
  let idleWaiters: (() => void)[] = [];

  const finish = async (request: FastifyRequest) => {
    if (!running.delete(request) || running.size > 0) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    for (const wake of waiters) wake();
  };

  app.addHook('onRequest', async (request) => {
    if (!WRITE_METHODS.has(request.method)) return;
    if (lifecycle.isStopping()) throw new ShuttingDownError();
    if (request.routeOptions.config.uncountedWrite) return;
    running.add(request);
  });
  // The response is complete when the action has ended; `onResponse` covers a reply that
  // never reaches `onSend`.
  app.addHook('onSend', async (request, _reply, payload) => {
    await finish(request);
    return payload;
  });
  app.addHook('onResponse', finish);

  return {
    activeWrites: () => running.size,
    waitUntilIdle: (timeoutMs) => {
      if (running.size === 0) return Promise.resolve(true);
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          idleWaiters = idleWaiters.filter((wake) => wake !== onIdle);
          resolve(false);
        }, timeoutMs);
        const onIdle = () => {
          clearTimeout(timer);
          resolve(true);
        };
        idleWaiters.push(onIdle);
      });
    },
  };
}
