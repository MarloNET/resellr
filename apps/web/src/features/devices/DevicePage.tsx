import { MESSAGES } from '@resellr/domain/messages/messages.de';
import type { DeviceDetail } from '@resellr/domain/schemas/device.schema';
import { Link, useParams } from 'react-router';

import { useDeviceQuery } from '../../api/inventory.api.ts';
import { bannerClassName, PageBanner } from '../../components/patterns/PageBanner.tsx';
import { UnreachableBanner } from '../../components/patterns/UnreachableBanner.tsx';
import { Badge, type BadgeVariant } from '../../components/ui/Badge.tsx';
import { CAPTURE_STATUS_LABELS, STOCK_STATUS_LABELS, UNASSIGNED_TEXT } from './DevicesPage.tsx';

// Texts of UI-010 `screen.md` (UI/UX design v0.6.1); "geladen" for opening (DER-54-10).
const TEXTS = {
  title: 'Gerät',
  head: 'Gerätekopf',
  modelTemplate: 'Modellvorlage',
  listing: 'Modell-Inserat',
  stockStatus: 'Bestandsstatus',
  captureStatus: 'Erfassungsstatus',
  loading: 'Lade Gerät …',
  loadError: (referenceNumber: string | null) =>
    `Gerät konnte nicht geladen werden. Referenz: ${referenceNumber ?? '–'}`,
} as const;

const STOCK_STATUS_CHIPS: Record<DeviceDetail['stockStatus'], BadgeVariant> = {
  available: 'published',
  sold: 'approved',
  cancelled: 'draft',
};

const CAPTURE_STATUS_CHIPS: Record<DeviceDetail['captureStatus'], BadgeVariant> = {
  checked: 'published',
  review_pending: 'warn',
};

/** The id of the address, `null` for one that is no id (then the server is not asked). */
function deviceIdOf(param: string | undefined): number | null {
  const id = Number(param);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Head of UI-010: WI-Nr, model template, model listing as link or "nicht zugeordnet", chips. */
function DeviceHead({ device }: { device: DeviceDetail }) {
  return (
    <dl aria-label={TEXTS.head} className="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2">
      <dt className="text-label text-text-secondary">{TEXTS.modelTemplate}</dt>
      <dd className="m-0 text-body">{device.modelTemplateLabel}</dd>
      <dt className="text-label text-text-secondary">{TEXTS.listing}</dt>
      <dd className="m-0 text-body">
        {device.listing === null ? (
          UNASSIGNED_TEXT
        ) : (
          <Link to={`/inserate/${device.listing.id}`} className="text-primary">
            {device.listing.title}
          </Link>
        )}
      </dd>
      <dt className="text-label text-text-secondary">{TEXTS.stockStatus}</dt>
      <dd className="m-0">
        <Badge variant={STOCK_STATUS_CHIPS[device.stockStatus]}>
          {STOCK_STATUS_LABELS[device.stockStatus]}
        </Badge>
      </dd>
      <dt className="text-label text-text-secondary">{TEXTS.captureStatus}</dt>
      <dd className="m-0">
        <Badge variant={CAPTURE_STATUS_CHIPS[device.captureStatus]}>
          {CAPTURE_STATUS_LABELS[device.captureStatus]}
        </Badge>
      </dd>
    </dl>
  );
}

/**
 * Device UI-010 (CU-137, REQ-016; Technical Specification 2.5, 7.3): in #187 the head with
 * WI-Nr, model template, model listing as link or "nicht zugeordnet" and the chips of inventory
 * and capture status, with the states loading, error ("geladen", DER-54-10) and P-06 above the
 * page (DER-54-13). The device values follow with #190, the actions with S8 and S9.
 */
export function DevicePage() {
  const id = deviceIdOf(useParams().deviceId);
  const query = useDeviceQuery(id);
  const device = query.data;
  const error = query.error;
  // An address without a valid id names no device, like `404 not_found` (M-15, 2.0.5).
  const notFound = id === null || error?.kind === 'not-found';

  return (
    <div className="flex flex-col gap-4 p-6">
      {error?.kind === 'unreachable' && <UnreachableBanner />}
      {notFound && (
        <div role="alert" className={bannerClassName('error')}>
          {MESSAGES['M-15']}
        </div>
      )}
      {error && error.kind !== 'unreachable' && error.kind !== 'not-found' && (
        <PageBanner variant="error" error={error}>
          {TEXTS.loadError}
        </PageBanner>
      )}

      <h1 className="m-0 text-page-title font-semibold">
        {device ? `${TEXTS.title} ${device.wiNr}` : TEXTS.title}
      </h1>

      {id !== null && query.isPending && (
        <p role="status" className="m-0 text-body text-text-secondary">
          {TEXTS.loading}
        </p>
      )}
      {device && <DeviceHead device={device} />}
    </div>
  );
}
