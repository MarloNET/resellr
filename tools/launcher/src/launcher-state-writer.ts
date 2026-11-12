import { isReferenceNumber } from '@resellr/runtime-shared/reference-number';
import {
  ensureLauncherStateFile,
  writeLauncherState,
} from '@resellr/runtime-shared/runtime-state-files';

import { launcherPagesDir, launcherPageUrl } from './launcher-pages-location.ts';

/**
 * Launcher state (CU-268, Technical Specification 2.18 "Seitenwechsel"): writes
 * `launcher-pages/launcher-state.js` next to the pages through CU-009. An open launcher page
 * reloads it every second and reacts only to the `request` of its own call.
 */
export interface LauncherStateWriter {
  /**
   * Creates `launcher-state.js` if it is missing, before `open` opens LP-01 (later `stop`
   * LP-03), so the page finds the file from its first load (FIND-311, Nachtrag MAR-470).
   */
  prepare(): void;
  /** `ready`: the page goes on to the local address `url` itself. */
  ready(request: string, url: string): void;
  /** `aborted`, also for `gave_up` and `already_running` without a server: the page goes to LP-02. */
  aborted(request: string, refNo: string | null): void;
  /**
   * `timeout` after 120 s without a result (K-07): the page goes to `LP-02.zeitueberschreitung`
   * with the number of `start_timeout`; the `request` in its address lets LP-02 read on.
   */
  timeout(request: string, refNo: string): void;
}

export function createLauncherStateWriter(programDir: string): LauncherStateWriter {
  const pagesDir = launcherPagesDir(programDir);
  return {
    prepare: () => ensureLauncherStateFile(pagesDir),
    ready: (request, url) =>
      writeLauncherState(pagesDir, { request, phase: 'ready', url, refNo: null, dataDir: null }),
    aborted: (request, refNo) => {
      const ref = isReferenceNumber(refNo) ? refNo : null;
      writeLauncherState(pagesDir, {
        request,
        phase: 'aborted',
        // The address of LP-02 comes from CU-310, like the one `open` opens directly.
        url: launcherPageUrl(programDir, 'lp-02', { ref }),
        refNo: ref,
        dataDir: null,
      });
    },
    timeout: (request, refNo) => {
      const ref = isReferenceNumber(refNo) ? refNo : null;
      writeLauncherState(pagesDir, {
        request,
        phase: 'timeout',
        url: launcherPageUrl(programDir, 'lp-02', { request, ref }),
        refNo: ref,
        dataDir: null,
      });
    },
  };
}
