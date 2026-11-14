import { createBrowserRouter, Link, Navigate, type RouteObject } from 'react-router';

import { buttonClassName } from '../components/ui/Button.tsx';
import {
  LastSettingsSectionRedirect,
  SettingsLayout,
} from '../features/settings/SettingsLayout.tsx';
import { ConditionCodesPage } from '../features/settings/condition-codes/ConditionCodesPage.tsx';
import { DatasheetLayoutPage } from '../features/settings/datasheet-layout/DatasheetLayoutPage.tsx';
import { DeviceTypesPage } from '../features/settings/device-types/DeviceTypesPage.tsx';
import { ManufacturersPage } from '../features/settings/manufacturers/ManufacturersPage.tsx';
import { MerchantProfilePage } from '../features/settings/merchant/MerchantProfilePage.tsx';
import { SuppliersPage } from '../features/settings/suppliers/SuppliersPage.tsx';
import { TextBlocksPage } from '../features/settings/text-blocks/TextBlocksPage.tsx';
import { PickListsPage } from '../features/settings/pick-lists/PickListsPage.tsx';
import { TerminatedPage } from '../features/shutdown/TerminatedPage.tsx';
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
 * task that builds a screen adds its route here, before the fallback route `*`. The fallback
 * route stays the last entry permanently (Technical Specification 4.2, DG-18): every path
 * without its own route shows the frame with navigation and an empty content area, without
 * text, redirect or change of the address. There is no route for a login, an access password,
 * user accounts or a password reset (OD-02 A, Technical Specification 2.20): UI-001 and UI-040
 * are not built, and `router.test.tsx` checks the table for such paths.
 */
export const routes: RouteObject[] = [
  // UI-046 after "resellr beenden" replaces the frame (CU-256, Technical Specification 2.17).
  { path: '/beendet', element: <TerminatedPage /> },
  {
    path: '/',
    element: <AppFrame />,
    children: [
      { index: true, element: <Navigate to="/inserate" replace /> },
      { path: 'inserate', element: <ListingOverviewPlaceholder /> },
      {
        // UI-025 (CU-093) with its 14 sections; a section without its own screen keeps an
        // empty content area until the task that builds its screen sets `element`.
        path: 'einstellungen',
        element: <SettingsLayout />,
        children: [
          { index: true, element: <LastSettingsSectionRedirect /> },
          { path: 'haendlermarke', element: <MerchantProfilePage /> },
          { path: 'geraetearten', element: <DeviceTypesPage /> },
          { path: 'auswahllisten', element: <PickListsPage /> },
          { path: 'titelmuster', element: null },
          { path: 'textbausteine', element: <TextBlocksPage /> },
          { path: 'hersteller', element: <ManufacturersPage /> },
          { path: 'lieferanten', element: <SuppliersPage /> },
          { path: 'code-uebersetzung', element: <ConditionCodesPage /> },
          { path: 'zustandszuordnung', element: null },
          { path: 'kategoriezuordnung', element: null },
          { path: 'merkmalszuordnung', element: null },
          { path: 'beschreibungsvorlagen', element: null },
          { path: 'kanaele', element: null },
          { path: 'datenblatt-layout', element: <DatasheetLayoutPage /> },
        ],
      },
      { path: '*', element: null },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
