import { createBrowserRouter, Link, Navigate, type RouteObject } from 'react-router';

import { buttonClassName } from '../components/ui/Button.tsx';
import { AppFrame } from './AppFrame.tsx';

/**
 * UI-002 in S1 is only the placeholder page of its route (Technical Specification 4.6):
 * state `UI-002.empty` with text and action from `screen.md`.
 */
function ListingOverviewPlaceholder() {
  return (
    <div className="flex flex-col items-start gap-4 p-6">
      <p className="m-0 text-body">Noch keine Modell-Inserate</p>
      <Link to="/geraete/neu" className={buttonClassName('primary')}>
        Gerät einbuchen
      </Link>
    </div>
  );
}

/**
 * Routes of the UI (CU-043, hotspot; paths only after Technical Specification 4.2). Each
 * task that builds a screen adds its route here. Until then a path without route keeps the
 * frame with an empty content area, so the navigation stays usable.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppFrame />,
    children: [
      { index: true, element: <Navigate to="/inserate" replace /> },
      { path: 'inserate', element: <ListingOverviewPlaceholder /> },
      { path: '*', element: null },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
