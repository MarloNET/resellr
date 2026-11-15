// Public interface of `channels` (Technical Specification 4.1): its reader (CU-161) and its
// route registration (CU-163).
export { createChannelReader, type ChannelReader } from './channel-reader.ts';
export { channelsRoutes, type ChannelsRoutesOptions } from './channels.routes.ts';
