import { useMutation, useQuery } from '@tanstack/react-query';

import { apiClient, type ApiError } from './api-client.ts';
import { isAppTerminated, useAppTermination } from './app-termination.ts';
import { queryKeys } from './query-keys.ts';

/** `GET /api/ops/status` (Technical Specification 2.17). */
export interface OpsStatus {
  dataDirPath: string;
  appVersion: string;
}

/** `GET /api/ops/health` (Technical Specification 2.17). */
export interface OpsHealth {
  state: 'starting' | 'ready' | 'stopping';
  startId: string;
}

/** `200` of `POST /api/ops/shutdown` (Technical Specification 2.17). */
export interface ShutdownResult {
  dataDirPath: string;
}

/** Time limit of `POST /api/ops/shutdown` from UI-045 (Technical Specification 2.0.8, T-3). */
export const SHUTDOWN_TIMEOUT_MS = 30_000;

/**
 * Data folder path for UI-044. With `enabled: false` it only reads the cached state and requests
 * nothing, e.g. for P-06 of the frame (CU-053 `alwaysShow`). After the shutdown it requests
 * nothing either (flag `terminated`, CU-257).
 */
export function useOpsStatusQuery(options: { enabled?: boolean } = {}) {
  return useQuery<OpsStatus, ApiError>({
    queryKey: queryKeys.ops.status(),
    queryFn: ({ signal }) => apiClient.get<OpsStatus>('/api/ops/status', { signal }),
    enabled: () => !isAppTerminated() && (options.enabled ?? true),
  });
}

/**
 * Connection check of "Erneut versuchen" (P-06); runs only when enabled or refetched, and never
 * after the shutdown (flag `terminated`, CU-257).
 */
export function useOpsHealthQuery(options: { enabled?: boolean } = {}) {
  return useQuery<OpsHealth, ApiError>({
    queryKey: queryKeys.ops.health(),
    queryFn: ({ signal }) => apiClient.get<OpsHealth>('/api/ops/health', { signal }),
    enabled: () => !isAppTerminated() && (options.enabled ?? false),
  });
}

/**
 * "resellr beenden" (UI-045): write with a 30 s time limit. `200` and no answer (time limit or
 * connection lost) end the use of this window with UI-046 `success` or `unknown` (CU-257); the
 * caller handles the error answers.
 */
export function useShutdownMutation() {
  const terminate = useAppTermination();
  return useMutation<ShutdownResult, ApiError>({
    mutationFn: () =>
      apiClient.post<ShutdownResult>('/api/ops/shutdown', {}, { timeoutMs: SHUTDOWN_TIMEOUT_MS }),
    onSuccess: ({ dataDirPath }) => terminate({ kind: 'success', dataDirPath }),
    onError: (error) => (error.status === null ? terminate({ kind: 'unknown' }) : undefined),
  });
}
