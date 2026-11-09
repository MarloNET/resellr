import { Outlet } from 'react-router';

import { Navigation } from './Navigation.tsx';

/**
 * Application frame (CU-044, Technical Specification 2.17 variant A, Design Kap. 3): left
 * column 208 px wide and as high as the viewport with the fixed head "resellr" (40 px) and
 * below it one scrolling area with the entries (the backup notice UI-044 follows there with
 * `margin-top: auto`); the content area scrolls separately and never horizontally (R-1 (2)).
 */
export function AppFrame() {
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
        </div>
      </aside>
      <main
        data-testid="content-area"
        className="h-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto [overflow-wrap:anywhere]"
      >
        <Outlet />
      </main>
    </div>
  );
}
