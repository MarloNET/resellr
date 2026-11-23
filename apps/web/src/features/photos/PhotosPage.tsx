import { ERROR_MESSAGES, MESSAGES } from '@resellr/domain/messages/messages.de';
import { useQueryClient } from '@tanstack/react-query';
import { type DragEvent, type KeyboardEvent, useId, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';

import type { ApiError } from '../../api/api-client.ts';
import { type Photo, type PhotoList, usePhotosQuery } from '../../api/media.api.ts';
import { queryKeys } from '../../api/query-keys.ts';
import { useWritesLocked } from '../../api/write-outcome-store.ts';
import { OutcomeUnknownBanner } from '../../components/patterns/OutcomeUnknownBanner.tsx';
import { bannerClassName, PageBanner } from '../../components/patterns/PageBanner.tsx';
import { UnreachableBanner } from '../../components/patterns/UnreachableBanner.tsx';
import { Button, buttonClassName } from '../../components/ui/Button.tsx';
import { cn } from '../../components/ui/cn.ts';
import { CARD } from '../devices/DeviceIntakePage.tsx';
import { type UploadEntry, usePhotoUploadQueue } from './photo-upload-queue.ts';

/** Highest number of photos of a model listing (REQ-042, AC-REQ-042-03). */
export const MAX_PHOTOS = 20;

/** File types the choice offers; the server checks the content itself (2.11, TH-04). */
const PHOTO_TYPES = 'image/jpeg,image/png';

// Texts of UI-015 `screen.md` (UI/UX design v0.6.1).
const TEXTS = {
  title: 'Fotos verwalten',
  photos: 'Fotos',
  counter: (count: number) => `${count} von ${MAX_PHOTOS} Fotos`,
  add: 'Fotos hinzufügen',
  done: 'Fertig',
  empty: 'Noch keine Fotos. Fotos hinzufügen oder hierher ziehen.',
  uploading: (fileName: string, percent: number) => `Lade ${fileName} hoch (${percent} %)`,
  uploadError: (fileName: string, referenceNumber: string | null) =>
    `${fileName} konnte nicht hochgeladen werden. Referenz: ${referenceNumber ?? '–'}`,
  limit: ERROR_MESSAGES['photo_limit_reached.default'],
  loadError: (referenceNumber: string | null) =>
    `Die Fotos konnten nicht geladen werden. Referenz: ${referenceNumber ?? '–'}`,
} as const;

/** The id of the address, `null` for one that is no id (then the server is not asked). */
function listingIdOf(param: string | undefined): number | null {
  const id = Number(param);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

const sizeFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

/** File size as „850 KB“ or „2,4 MB“ (UI-015 „Dateiname und Größe je Foto“). */
export function formatByteSize(bytes: number): string {
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${sizeFormat.format(Math.max(1, Math.round(kilobytes)))} KB`;
  return `${sizeFormat.format(kilobytes / 1024)} MB`;
}

/** Number of a photo in the grid: „01“, „02“ … (DER-80-01). */
const photoNumber = (position: number) => String(position).padStart(2, '0');

/**
 * Message at a rejected file (`UI-015.validation`, `.error`): the text of the server, which names
 * the file for a wrong type or size (AC-REQ-042-02) and the highest number (AC-REQ-042-03), and for
 * `500` the text of the screen with the reference number (DER-80-04).
 */
function rejectionText(fileName: string, error: ApiError): string {
  if (error.kind === 'error')
    return TEXTS.uploadError(fileName, error.error?.referenceNumber ?? null);
  return error.error?.message || TEXTS.uploadError(fileName, null);
}

/** The files of the upload queue: progress per file, rejections at their file (DER-80-02). */
function UploadQueue({ entries }: { entries: readonly UploadEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {entries.map((entry) =>
        entry.status === 'failed' ? (
          <li key={entry.key} role="alert" className={bannerClassName('error')}>
            {rejectionText(entry.fileName, entry.error)}
          </li>
        ) : (
          <li key={entry.key} role="status" className="text-body text-text-secondary">
            {TEXTS.uploading(entry.fileName, entry.status === 'uploading' ? entry.progress : 0)}
          </li>
        ),
      )}
    </ul>
  );
}

/**
 * Grid of the numbered thumbnails (DER-80-01, DER-80-10): it adapts its columns to the width, and
 * the arrow keys select a photo (one tab stop, the selected photo has the focus).
 */
function PhotoGrid({ photos }: { photos: readonly Photo[] }) {
  const [selected, setSelected] = useState(0);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const current = Math.min(selected, photos.length - 1);

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    // Alt+arrow moves a photo; that follows with the order of the photos (#239).
    if (step === undefined || event.altKey) return;
    event.preventDefault();
    const next = Math.min(Math.max(current + step, 0), photos.length - 1);
    setSelected(next);
    optionRefs.current[next]?.focus();
  }

  return (
    <ul
      role="listbox"
      aria-label={TEXTS.photos}
      className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4 p-0"
      onKeyDown={onKeyDown}
    >
      {photos.map((photo, index) => (
        <li
          key={photo.id}
          ref={(element) => {
            optionRefs.current[index] = element;
          }}
          role="option"
          aria-selected={index === current}
          tabIndex={index === current ? 0 : -1}
          onClick={() => setSelected(index)}
          className={cn(
            'flex min-w-0 flex-col gap-2 rounded-control border bg-surface p-2',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            index === current ? 'border-primary' : 'border-border',
          )}
        >
          <span className="text-label font-semibold">{photoNumber(photo.position)}</span>
          <img
            src={photo.thumbUrl}
            alt={photo.originalName}
            className="h-32 w-full rounded-control bg-bg object-contain"
          />
          <span className="text-body [overflow-wrap:anywhere]">{photo.originalName}</span>
          <span className="text-label text-text-secondary">{formatByteSize(photo.byteSize)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Photos UI-015 (CU-214, REQ-042; Technical Specification 2.11, 7.3): grid of the numbered
 * thumbnails with file name and size, counter "n von 20 Fotos", "Fotos hinzufügen" by file choice
 * or by dropping files, and the upload queue with the progress per file (CU-215). Every photo is
 * stored at once; there is no save button, and "Fertig" only leads back to UI-014. States:
 * loading, empty, P-06 when the photos cannot be read (DER-80-12), rejection per file
 * (`validation`, `error`), `disabled` with 20 photos (DER-80-03) and P-08 when an upload ends
 * without an answer (DER-80-05). Ordering and removing follow with #239.
 */
export function PhotosPage() {
  const id = listingIdOf(useParams().listingId);
  const queryClient = useQueryClient();
  const query = usePhotosQuery(id);
  const writesLocked = useWritesLocked();
  const headingId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const queue = usePhotoUploadQueue(id ?? 0, (result) => {
    if (id === null) return;
    // The answer goes into the cache at once; the lists are read again in the background (2.0.7).
    queryClient.setQueryData<PhotoList>(queryKeys.media.photos(id), (list) =>
      list === undefined ? list : { items: [...list.items, result.photo], total: result.count },
    );
    void queryClient.invalidateQueries({ queryKey: queryKeys.media.photos(id) });
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'listing', id] });
  });

  const photos = query.data?.items;
  const error = query.error;
  // An address without a valid id names no model listing, like `404 not_found` (M-15, 2.0.5).
  const notFound = id === null || error?.kind === 'not-found';
  const unreachable = error?.kind === 'unreachable';
  const loadError = error && !notFound && !unreachable ? error : undefined;
  const atLimit = photos !== undefined && photos.length >= MAX_PHOTOS;
  const addDisabled = photos === undefined || atLimit || writesLocked;

  function addFiles(files: readonly File[]) {
    if (!addDisabled && files.length > 0) queue.add(files);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  }

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

      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <h1 id={headingId} className="m-0 text-page-title font-semibold">
          {TEXTS.title}
        </h1>
        <div className="flex flex-wrap gap-2">
          {/* Deactivated with 20 photos, with the reason as tooltip (UI-015.disabled, 2.0.7). */}
          <span title={atLimit ? TEXTS.limit : undefined}>
            <Button
              disabled={addDisabled}
              title={atLimit ? TEXTS.limit : undefined}
              onClick={() => inputRef.current?.click()}
            >
              {TEXTS.add}
            </Button>
          </span>
          {id !== null && (
            <Link to={`/inserate/${id}`} className={buttonClassName('primary')}>
              {TEXTS.done}
            </Link>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={PHOTO_TYPES}
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            // Empty again, so choosing the same files once more is a new upload.
            event.target.value = '';
            addFiles(files);
          }}
        />
      </header>

      {id !== null && !notFound && (
        <section
          aria-labelledby={headingId}
          aria-busy={photos === undefined && !error}
          className={CARD}
          onDragOver={(event) => {
            if (!addDisabled) event.preventDefault();
          }}
          onDrop={onDrop}
        >
          {photos === undefined ? (
            !error && (
              <div
                aria-hidden="true"
                className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4"
              >
                <div className="h-48 rounded-control bg-border" />
                <div className="h-48 rounded-control bg-border" />
                <div className="h-48 rounded-control bg-border" />
              </div>
            )
          ) : (
            <>
              <p className="m-0 text-body text-text-secondary">{TEXTS.counter(photos.length)}</p>
              <UploadQueue entries={queue.entries} />
              {photos.length === 0 ? (
                <p className="m-0 rounded-control border border-dashed border-border-input p-6 text-center text-body">
                  {TEXTS.empty}
                </p>
              ) : (
                <PhotoGrid photos={photos} />
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
