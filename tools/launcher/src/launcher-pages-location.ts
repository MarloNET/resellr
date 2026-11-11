import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { isReferenceNumber } from '@resellr/runtime-shared/reference-number';

/** The three launcher pages (Technical Specification 2.18 "Launcher-Seiten"). */
export type LauncherPage = 'lp-01' | 'lp-02' | 'lp-03';

/** URL parameters of a launcher page (2.18). */
export interface LauncherPageParams {
  /** Identifier of the call; the page reacts only to `launcher-state.js` with this `request`. */
  request?: string;
  /** Reference number; set only if it matches the pattern of 2.0.5 (H-11). */
  ref?: string | null;
  dataDir?: string;
}

/** Folder of the launcher pages, `<program folder>/launcher-pages` (2.19). */
export function launcherPagesDir(programDir: string): string {
  return join(programDir, 'launcher-pages');
}

/**
 * Address of a launcher page (CU-310, Nachtrag MAR-382) as `file:` URL. `pathToFileURL` encodes
 * spaces, umlauts and `#` of the user's path; the parameters go through `URLSearchParams`.
 */
export function launcherPageUrl(
  programDir: string,
  page: LauncherPage,
  { request, ref, dataDir }: LauncherPageParams = {},
): string {
  const url = pathToFileURL(join(launcherPagesDir(programDir), `${page}.html`));
  if (request !== undefined) url.searchParams.set('request', request);
  if (isReferenceNumber(ref)) url.searchParams.set('ref', ref);
  if (dataDir !== undefined) url.searchParams.set('dataDir', dataDir);
  return url.href;
}
