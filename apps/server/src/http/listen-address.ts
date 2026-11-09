/**
 * The server listens only on the loopback address (ADR-002, TH-01). It is fixed in the code
 * and not a configuration value, so resellr is never reachable from another device.
 */
export const LISTEN_HOST = '127.0.0.1';
