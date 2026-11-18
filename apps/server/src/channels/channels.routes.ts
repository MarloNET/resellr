import { channelListSchema, type ChannelList } from '@resellr/domain/schemas/channel.schema';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { Kysely } from 'kysely';
import { z } from 'zod';

import type { DB } from '../db/schema.ts';
import { createChannelReader } from './channel-reader.ts';

export interface ChannelsRoutesOptions {
  db: Kysely<DB>;
}

/** Paging of lists (Technical Specification 2.0.1): `limit` 50 by default, at most 200. */
const pageQuery = z.strictObject({
  limit: z.coerce.number().pipe(z.int().min(1).max(200)).default(50),
  offset: z.coerce.number().pipe(z.int().nonnegative()).default(0),
});

/**
 * Channel routes (CU-163, Technical Specification 2.3): in S2 only `GET /api/channels`, the
 * channel list of the initial settings for the scope of a text block (UI-030; 4.4.0, addendum
 * MAR-773). The further paths and channel fields follow with S5 (#169).
 */
export const channelsRoutes: FastifyPluginAsyncZod<ChannelsRoutesOptions> = async (app, { db }) => {
  const reader = createChannelReader(db);

  app.get(
    '/api/channels',
    { schema: { querystring: pageQuery, response: { 200: channelListSchema } } },
    async (request): Promise<ChannelList> => {
      const { limit, offset } = request.query;
      const channels = await reader.listChannels();
      return { items: channels.slice(offset, offset + limit), total: channels.length };
    },
  );
};
