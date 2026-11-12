import { QueryClient, type Query } from '@tanstack/react-query';

import { isAppTerminated } from '../api/app-termination.ts';
import { COPY_VIEW_RESOURCE } from '../api/query-keys.ts';

/**
 * TanStack Query settings of web-ui (CU-046, Technical Specification 2.0.8):
 * - no retry, neither for reads nor for writes (P-06, P-08);
 * - refetch on window focus, except the copy assistant view;
 * - the 5 s read limit is applied by the API client, which receives the query's signal;
 * - requests run regardless of the browser's online flag, because resellr only talks to
 *   127.0.0.1 (REQ-079);
 * - after "resellr beenden" no query starts any more (flag `terminated`, CU-257, Technical
 *   Specification 2.17); a hook with its own `enabled` combines it with `isAppTerminated()`.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        enabled: () => !isAppTerminated(),
        refetchOnWindowFocus: (query) => !isCopyViewQuery(query),
        networkMode: 'always',
      },
      mutations: {
        retry: false,
        networkMode: 'always',
      },
    },
  });
}

function isCopyViewQuery(query: Query): boolean {
  return query.queryKey[1] === COPY_VIEW_RESOURCE;
}

export const queryClient = createQueryClient();
