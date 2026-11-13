import { Navigate, Outlet } from 'react-router';

import { isAppTerminated, TERMINATED_PATH } from '../api/app-termination.ts';
import { useOpsStatusQuery } from '../api/ops.api.ts';
import { UnreachableBanner } from '../components/patterns/UnreachableBanner.tsx';
import { BackupNotice } from '../features/backup-notice/BackupNotice.tsx';
import { useShutdownOutcome } from '../features/shutdown/shutdown-outcome-store.ts';
import { ShutdownOutcomeBanner } from '../features/shutdown/ShutdownOutcomeBanner.tsx';
import { Navigation } from './Navigation.tsx';

/**
 * Application frame (CU-044, Technical Specification 2.17 variant A, Design Kap. 3): left
 * column 208 px wide and as high as the viewport with the fixed head "resellr" (40 px) and
 * below it one scrolling area with the entries and the backup notice UI-044 (`margin-top: auto`:
 * at the lower edge with enough height, otherwise after the entries); the content area scrolls
 * separately and never horizontally (R-1 (2)). While `GET /api/ops/status` is unreachable, P-06
 * stands as the first element of the content area, the page below it stays (DG-06, Nachtrag
 * MAR-395); not while the status loads and not on `500` (then `UI-044.error` in the notice).
 * After it follows the banner of "resellr beenden" (CU-312: `UI-045.error` or P-07, Nachtrag
 * MAR-421), both before the page. Once this window has shut resellr down (CU-257), no route
 * under `/` shows the frame any more: it leads with `replace` to `/beendet`, so "Zurück" and "Vor"
 * show UI-046 again instead of a frame whose queries are stopped (Nachtrag MAR-510).
 */
export function AppFrame() {
  const status = useOpsStatusQuery();
  const unreachable = status.error?.kind === 'unreachable';
  const shutdownOutcome = useShutdownOutcome();

  if (isAppTerminated()) return <Navigate to={TERMINATED_PATH} replace />;

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <aside
        data-testid="navigation-column"
        className="flex h-full w-nav shrink-0 flex-col border-r border-border bg-surface"
      >
        <header className="flex h-nav-header shrink-0 items-center px-4 text-section font-semibold">
          resellr
        </header>
        <div
          data-testid="navigation-scroll-area"
          className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto"
        >
          <Navigation />
          <BackupNotice variant="sidebar" />
        </div>
      </aside>
      <main
        data-testid="content-area"
        className="h-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto [overflow-wrap:anywhere]"
      >
        {(unreachable || shutdownOutcome !== null) && (
          <div className="flex flex-col gap-2 px-6 pt-6">
            {unreachable && <UnreachableBanner alwaysShow />}
            <ShutdownOutcomeBanner />
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
