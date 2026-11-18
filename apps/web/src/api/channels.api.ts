import type { ChannelList } from '@resellr/domain/schemas/channel.schema';
import { useQuery } from '@tanstack/react-query';

import { apiClient, type ApiError } from './api-client.ts';
import { queryKeys } from './query-keys.ts';

/**
 * Channels of the initial settings, active and deactivated (`GET /api/channels`, CU-176): in S2
 * for the scope of a text block (UI-030); the channel settings follow with S5.
 */
export function useChannelsQuery() {
  return useQuery<ChannelList, ApiError>({
    queryKey: queryKeys.channels.channels(),
    queryFn: ({ signal }) => apiClient.get<ChannelList>('/api/channels', { signal }),
  });
}
