import { z } from 'zod';

import { idSchema, listResponseSchema } from './common.schema.ts';

// Channel settings (REQ-029; Technical Specification 2.3, 3.1). In S2 only the channel list of
// the initial settings for the scopes (4.4.0); the further fields follow with S5 (#169).

/** A channel in `GET /api/channels`. */
export const channelSummarySchema = z.object({
  id: idSchema,
  code: z.string(),
  name: z.string(),
  active: z.boolean(),
  sortOrder: z.int(),
});
export type ChannelSummary = z.infer<typeof channelSummarySchema>;

/** `GET /api/channels`: all channels, active or not, in their order. */
export const channelListSchema = listResponseSchema(channelSummarySchema);
export type ChannelList = z.infer<typeof channelListSchema>;
