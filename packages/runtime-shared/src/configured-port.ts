import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The single rule for `port` in `config.json`, shared by server and launcher (CU-309,
 * Technical Specification 2.19, FIND-266). Reads only; writes and logs nothing.
 */

export const CONFIG_FILE_NAME = 'config.json';
/** Standard port (Technical Specification 2.0.1, Baseline 10.1). */
export const DEFAULT_PORT = 4310;

export type ConfigProblem = 'not_a_json_object' | 'invalid_port';

export interface ConfiguredPort {
  port: number;
  problem: ConfigProblem | null;
}

/**
 * Parses the text of `config.json`. A leading UTF-8 BOM is removed first, because Windows
 * editors such as Notepad may write one (FIND-267). Returns null if the text is no JSON object.
 */
export function parseConfigText(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text.replace(/^\uFEFF/, ''));
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * `port` must be an integer JSON number from 1 to 65535; otherwise 4310 applies with the
 * problem `invalid_port`. A missing `port` gives 4310 without a problem.
 */
export function resolvePort(values: Record<string, unknown>): ConfiguredPort {
  const { port } = values;
  if (port === undefined) return { port: DEFAULT_PORT, problem: null };
  if (typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535) {
    return { port, problem: null };
  }
  return { port: DEFAULT_PORT, problem: 'invalid_port' };
}

/** Port from `config.json` in the data folder; a missing file gives 4310 without a problem. */
export function readConfiguredPort(dataDir: string): ConfiguredPort {
  let text: string;
  try {
    text = readFileSync(join(dataDir, CONFIG_FILE_NAME), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { port: DEFAULT_PORT, problem: null };
    }
    throw error;
  }
  const values = parseConfigText(text);
  return values === null
    ? { port: DEFAULT_PORT, problem: 'not_a_json_object' }
    : resolvePort(values);
}
