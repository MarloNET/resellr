import { LauncherExitCode } from '@resellr/runtime-shared/exit-codes';

import type { ChromeOpener } from './chrome-opener.ts';
import type { HealthClient } from './health-client.ts';

export interface OpenCommandDeps {
  healthClient: Pick<HealthClient, 'appUrl' | 'getHealth'>;
  chromeOpener: ChromeOpener;
}

/**
 * Command `open` (CU-259, Technical Specification 2.18, flow `open` step 1): asks
 * `GET /api/ops/health` with a time limit of 1 s and, if the server is `ready`, opens Chrome with
 * the local address. Steps 2 to 6 (pipe of the supervisor, own start, LP-01, LP-02) are not built
 * yet; until then `open` ends with `Failed` without a ready server.
 */
export async function runOpenCommand({
  healthClient,
  chromeOpener,
}: OpenCommandDeps): Promise<LauncherExitCode> {
  if ((await healthClient.getHealth()) !== 'ready') return LauncherExitCode.Failed;
  await chromeOpener.open(healthClient.appUrl);
  return LauncherExitCode.Success;
}
