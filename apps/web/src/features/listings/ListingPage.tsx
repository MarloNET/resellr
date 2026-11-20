import { formatDate } from '@resellr/domain/format/format-value';
import { MESSAGES } from '@resellr/domain/messages/messages.de';
import type { Attribute } from '@resellr/domain/schemas/attribute.schema';
import type { ListingDetail, ListingDevice } from '@resellr/domain/schemas/listing.schema';
import { type ReactNode, useId, useState } from 'react';
import { Link, useParams } from 'react-router';

import { useModelTemplateQuery } from '../../api/catalog.api.ts';
import { useChannelsQuery } from '../../api/channels.api.ts';
import { useListingQuery } from '../../api/inventory.api.ts';
import {
  useAttributesQuery,
  useDeviceTypesQuery,
  usePickListsQuery,
} from '../../api/settings.api.ts';
import { OutcomeUnknownBanner } from '../../components/patterns/OutcomeUnknownBanner.tsx';
import { bannerClassName, PageBanner } from '../../components/patterns/PageBanner.tsx';
import { UnreachableBanner } from '../../components/patterns/UnreachableBanner.tsx';
import { Button } from '../../components/ui/Button.tsx';
import { Checkbox } from '../../components/ui/Checkbox.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/Table.tsx';
import {
  CARD,
  CARD_HEADING,
  listIdOf,
  ModelValue,
  PickListLabel,
} from '../devices/DeviceIntakePage.tsx';
import { STOCK_STATUS_LABELS } from '../devices/DevicesPage.tsx';
import { ListingValuesForm } from './ListingValuesForm.tsx';

// Texts of UI-014 `screen.md` (UI/UX design v0.6.1); "geladen" for opening (DER-60-02).
const TEXTS = {
  title: 'Modell-Inserat',
  back: 'Zurück zu Inserate',
  head: (deviceType: string, quantity: number, articleNumber: string) =>
    `${deviceType} · Stückzahl ${quantity} · Artikelnummer ${articleNumber}`,
  loading: 'Lade Modell-Inserat …',
  loadError: (referenceNumber: string | null) =>
    `Das Modell-Inserat konnte nicht geladen werden. Referenz: ${referenceNumber ?? '–'}`,
  values: 'Inseratswerte',
  edit: 'Bearbeiten',
  saved: 'Inseratswerte gespeichert',
  modelDataHint: 'Modelldaten werden in der Modellvorlage gepflegt.',
  condition: 'Zustand',
  visualGrade: 'Optik-Note',
  conditionDescription: 'Zustandsbeschreibung',
  deliveryScope: 'Lieferumfang',
  articleNumber: 'Artikelnummer',
  ean: 'EAN',
  eanOriginal: (ean: string | null) => `Original (${ean ?? '–'})`,
  eanOwn: (ean: string | null) => `eigene (${ean ?? '–'})`,
  empty: '–',
  devices: 'Geräte',
  includeCancelled: 'auch stornierte',
  wiNr: 'WI-Nr',
  stockStatus: 'Bestandsstatus',
  batteryCapacity: 'Akkukapazität',
  capturedOn: 'Erfassungsdatum',
  notDeterminable: 'nicht ermittelbar',
} as const;

/** The id of the address, `null` for one that is no id (then the server is not asked). */
function listingIdOf(param: string | undefined): number | null {
  const id = Number(param);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** "verfügbar", "verkauft (Shop, 17.11.2026)" or "storniert" (UI-014 "Geräte"). */
function stockStatusText(device: ListingDevice, channelName: (id: number) => string | undefined) {
  const label = STOCK_STATUS_LABELS[device.stockStatus];
  if (device.stockStatus !== 'sold') return label;
  const sale = [
    device.soldChannelId === null ? undefined : channelName(device.soldChannelId),
    device.soldOn === null ? undefined : formatDate(device.soldOn),
  ].filter(Boolean);
  return sale.length === 0 ? label : `${label} (${sale.join(', ')})`;
}

function batteryCapacityText(capacity: ListingDevice['batteryCapacity']) {
  if (capacity === null) return TEXTS.empty;
  return 'percent' in capacity ? `${capacity.percent} %` : TEXTS.notDeterminable;
}

/** One row of the listing values: label and value side by side (mockup UI-014). */
function ValueRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-body">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="m-0 text-right [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/**
 * Area "Inseratswerte" (read only): condition, visual grade, the listed device values (variant
 * values and other values) in the order of the attributes, delivery scope ("–" when empty),
 * article number, EAN and the condition description; the model data are not here, a hint names
 * the model template (DER-60-05, AC-REQ-088-06). "Bearbeiten" opens `UI-014.edit` in its place
 * (CU-139, DER-64-01).
 */
function ListingValues({
  listing,
  attributes,
  originalEan,
  editing,
}: {
  listing: ListingDetail;
  attributes: readonly Attribute[];
  originalEan: string | null;
  /** `UI-014.edit` instead of the values, with the hint to the model template kept. */
  editing: { form: ReactNode } | { onEdit: () => void };
}) {
  const headingId = useId();
  const lists = usePickListsQuery();
  const values: Record<string, unknown> = { ...listing.variantValues, ...listing.otherValues };
  const listed = attributes.filter(({ id }) => values[String(id)] !== undefined);
  return (
    <section aria-labelledby={headingId} className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <h2 id={headingId} className={CARD_HEADING}>
          {TEXTS.values}
        </h2>
        {'onEdit' in editing && <Button onClick={editing.onEdit}>{TEXTS.edit}</Button>}
      </div>
      <p className="m-0 text-body text-text-secondary">{TEXTS.modelDataHint}</p>
      {'form' in editing ? (
        editing.form
      ) : (
        <ListingValueList
          listing={listing}
          listed={listed}
          values={values}
          lists={lists.data?.items}
          originalEan={originalEan}
        />
      )}
    </section>
  );
}

/** The listing values read only: label and value side by side (mockup UI-014). */
function ListingValueList({
  listing,
  listed,
  values,
  lists,
  originalEan,
}: {
  listing: ListingDetail;
  listed: readonly Attribute[];
  values: Record<string, unknown>;
  lists: Parameters<typeof listIdOf>[0];
  originalEan: string | null;
}) {
  return (
    <>
      <dl className="m-0 grid grid-cols-1 gap-x-12 full:grid-cols-2">
        <ValueRow label={TEXTS.condition}>
          <PickListLabel
            pickListId={listIdOf(lists, 'condition')}
            valueId={listing.conditionValueId}
          />
        </ValueRow>
        <ValueRow label={TEXTS.visualGrade}>{listing.visualGrade}</ValueRow>
        {listed.map((attribute) => (
          <ValueRow key={attribute.id} label={attribute.label}>
            <ModelValue attribute={attribute} value={values[String(attribute.id)]} />
          </ValueRow>
        ))}
        <ValueRow label={TEXTS.deliveryScope}>
          {listing.deliveryScope.length === 0
            ? TEXTS.empty
            : listing.deliveryScope.map(({ name }) => name).join(', ')}
        </ValueRow>
        <ValueRow label={TEXTS.articleNumber}>{listing.articleNumber}</ValueRow>
        <ValueRow label={TEXTS.ean}>
          {listing.eanMode === 'own'
            ? TEXTS.eanOwn(listing.ownEan)
            : TEXTS.eanOriginal(originalEan)}
        </ValueRow>
      </dl>
      <dl className="m-0 flex flex-col gap-2">
        <dt className="text-label text-text-secondary">{TEXTS.conditionDescription}</dt>
        <dd className="m-0 rounded-control border border-border bg-bg px-4 py-2 text-body [overflow-wrap:anywhere]">
          {listing.conditionDescription === '' ? TEXTS.empty : listing.conditionDescription}
        </dd>
      </dl>
    </>
  );
}

/**
 * Area "Geräte": WI-Nr as link to UI-010, inventory status (sold with channel and date), battery
 * capacity and capture date; the cancelled devices only with the filter "auch stornierte"
 * (DER-60-03).
 */
function ListingDevices({
  devices,
  includeCancelled,
  onIncludeCancelled,
}: {
  devices: readonly ListingDevice[];
  includeCancelled: boolean;
  onIncludeCancelled: (next: boolean) => void;
}) {
  const headingId = useId();
  const channels = useChannelsQuery();
  const channelName = (id: number) => channels.data?.items.find((item) => item.id === id)?.name;
  return (
    <section aria-labelledby={headingId} className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <h2 id={headingId} className={CARD_HEADING}>
          {TEXTS.devices}
        </h2>
        <Checkbox
          label={TEXTS.includeCancelled}
          checked={includeCancelled}
          onChange={onIncludeCancelled}
        />
      </div>
      <Table aria-labelledby={headingId}>
        <TableHeader>
          <tr>
            <TableHead scope="col">{TEXTS.wiNr}</TableHead>
            <TableHead scope="col">{TEXTS.stockStatus}</TableHead>
            <TableHead scope="col">{TEXTS.batteryCapacity}</TableHead>
            <TableHead scope="col">{TEXTS.capturedOn}</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {devices.map((device) => (
            <TableRow key={device.id}>
              <TableCell>
                <Link to={`/geraete/${device.id}`} className="font-semibold text-primary">
                  {device.wiNr}
                </Link>
              </TableCell>
              <TableCell>{stockStatusText(device, channelName)}</TableCell>
              <TableCell>{batteryCapacityText(device.batteryCapacity)}</TableCell>
              <TableCell>{formatDate(device.capturedOn)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

/**
 * Model listing UI-014 (CU-138, REQ-019, REQ-088; Technical Specification 2.7, 7.3): in #198 the
 * head with the untruncated title and "Geräteart · Stückzahl n · Artikelnummer <Nr>", the listing
 * values (read only) with the hint to the model template, and the devices with the filter "auch
 * stornierte"; the states loading, error ("geladen", DER-60-02) and P-06 above the page
 * (DER-60-06); with #206 the edit view of the listing values (`UI-014.edit`, CU-139), the banner
 * "Inseratswerte gespeichert" after saving (DER-64-02) and P-08 (DER-64-06). Channel cards follow
 * with S5, photos with S7, prices with #204.
 */
export function ListingPage() {
  const id = listingIdOf(useParams().listingId);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const query = useListingQuery(id, { includeCancelled });
  // A failed later read (the filter "auch stornierte" without an answer) keeps the last loaded
  // state of this model listing, so P-06 stands above the page and never replaces it (7.3).
  const [lastLoaded, setLastLoaded] = useState<ListingDetail>();
  if (query.data !== undefined && query.data !== lastLoaded) setLastLoaded(query.data);
  const listing = query.data ?? (lastLoaded?.id === id ? lastLoaded : undefined);
  const template = useModelTemplateQuery(listing?.modelTemplateId ?? null);
  const deviceTypeId = template.data?.deviceTypeId ?? null;
  const deviceTypes = useDeviceTypesQuery();
  const attributes = useAttributesQuery(deviceTypeId);
  const deviceType = deviceTypes.data?.items.find((item) => item.id === deviceTypeId);

  const error = query.error;
  const supportError = [template.error, deviceTypes.error, attributes.error].find(Boolean);
  // An address without a valid id names no model listing, like `404 not_found` (M-15, 2.0.5).
  const notFound = id === null || error?.kind === 'not-found';
  const unreachable = error?.kind === 'unreachable' || supportError?.kind === 'unreachable';
  const loadError = [error, supportError].find(
    (candidate) => candidate && candidate.kind !== 'unreachable' && candidate.kind !== 'not-found',
  );
  const ready = listing !== undefined && attributes.data !== undefined && deviceType !== undefined;

  return (
    <div className="flex flex-col gap-6 p-6">
      <OutcomeUnknownBanner />
      {unreachable && <UnreachableBanner />}
      {notFound && (
        <div role="alert" className={bannerClassName('error')}>
          {MESSAGES['M-15']}
        </div>
      )}
      {loadError && (
        <PageBanner variant="error" error={loadError}>
          {TEXTS.loadError}
        </PageBanner>
      )}
      {saved && (
        <PageBanner variant="success" onClose={() => setSaved(false)}>
          {TEXTS.saved}
        </PageBanner>
      )}

      <Link to="/inserate" className="self-start text-body text-primary">
        ← {TEXTS.back}
      </Link>

      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <h1 className="m-0 text-page-title font-semibold [overflow-wrap:anywhere]">
          {ready ? listing.displayTitle : TEXTS.title}
        </h1>
        {ready && (
          <p className="m-0 text-body text-text-secondary">
            {TEXTS.head(deviceType.name, listing.quantity, listing.articleNumber)}
          </p>
        )}
      </header>

      {id !== null && !ready && !loadError && !unreachable && !notFound && (
        <div className="flex flex-col gap-4">
          <p role="status" className="m-0 text-body text-text-secondary">
            {TEXTS.loading}
          </p>
          <div aria-hidden="true" className="h-48 rounded-control bg-border" />
          <div aria-hidden="true" className="h-32 rounded-control bg-border" />
        </div>
      )}

      {ready && (
        <>
          <ListingValues
            listing={listing}
            attributes={attributes.data.items}
            originalEan={template.data?.originalEan ?? null}
            editing={
              editing && deviceTypeId !== null
                ? {
                    form: (
                      <ListingValuesForm
                        listing={listing}
                        attributes={attributes.data.items}
                        deviceTypeId={deviceTypeId}
                        onCancel={() => setEditing(false)}
                        onSaved={() => {
                          setEditing(false);
                          setSaved(true);
                        }}
                      />
                    ),
                  }
                : {
                    onEdit: () => {
                      setSaved(false);
                      setEditing(true);
                    },
                  }
            }
          />
          <ListingDevices
            devices={listing.devices}
            includeCancelled={includeCancelled}
            onIncludeCancelled={setIncludeCancelled}
          />
        </>
      )}
    </div>
  );
}
