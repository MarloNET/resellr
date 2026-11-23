import { useRef, useState } from 'react';

import { ApiError, type ApiErrorKind } from '../../api/api-client.ts';
import { type PhotoUploadResult, uploadPhoto } from '../../api/media.api.ts';

/** A file of the queue: waiting, uploading with its progress, or rejected with its error. */
export type UploadEntry = { key: number; fileName: string } & (
  | { status: 'waiting' }
  | { status: 'uploading'; progress: number }
  | { status: 'failed'; error: ApiError }
);

/**
 * Errors after which no further file is sent: the outcome is unknown and the page is locked
 * until it is reloaded (P-08), or resellr is shutting down (P-07); every further upload would end
 * the same way.
 */
const STOPPING: ReadonlySet<ApiErrorKind> = new Set(['outcome-unknown', 'shutting-down']);

export interface PhotoUploadQueue {
  /** Files not uploaded yet and rejected files, in the order they were added. */
  entries: UploadEntry[];
  /** Appends files; they are uploaded one after the other. */
  add(files: readonly File[]): void;
  /** A file is waiting or uploading. */
  busy: boolean;
  /** The error that stopped the queue, `null` while it runs or after it has ended normally. */
  stoppedBy: ApiError | null;
}

/**
 * Upload queue of UI-015 (CU-215, T-2; Technical Specification 2.11 "Mehrere Dateien"): uploads
 * the files one after the other, one request per file with its progress. A rejection stays at
 * its file and the others go on; an uploaded file leaves the queue, because the grid shows it
 * (`UI-015.success` has no banner). Only an unknown outcome or the shutdown stops the queue.
 */
export function usePhotoUploadQueue(
  listingId: number,
  onUploaded: (result: PhotoUploadResult) => void,
): PhotoUploadQueue {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [stoppedBy, setStoppedBy] = useState<ApiError | null>(null);
  const pending = useRef<{ key: number; file: File }[]>([]);
  const running = useRef(false);
  const nextKey = useRef(1);
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const update = (key: number, change: (entry: UploadEntry) => UploadEntry) =>
    setEntries((list) => list.map((entry) => (entry.key === key ? change(entry) : entry)));
  const remove = (keys: ReadonlySet<number>) =>
    setEntries((list) => list.filter((entry) => !keys.has(entry.key)));

  async function run() {
    running.current = true;
    for (let next = pending.current.shift(); next; next = pending.current.shift()) {
      const { key, file } = next;
      const uploading = (progress: number) =>
        update(key, ({ fileName }) => ({ key, fileName, status: 'uploading', progress }));
      uploading(0);
      try {
        const result = await uploadPhoto(listingId, file, { onProgress: uploading });
        remove(new Set([key]));
        onUploadedRef.current(result);
      } catch (cause) {
        const error = cause instanceof ApiError ? cause : new ApiError('error', null, null);
        if (STOPPING.has(error.kind)) {
          remove(new Set([key, ...pending.current.map((entry) => entry.key)]));
          pending.current = [];
          setStoppedBy(error);
          break;
        }
        update(key, ({ fileName }) => ({ key, fileName, status: 'failed', error }));
      }
    }
    running.current = false;
  }

  function add(files: readonly File[]) {
    const added = files.map((file) => ({ key: nextKey.current++, file }));
    pending.current.push(...added);
    setStoppedBy(null);
    // The rejections of an earlier choice give way to the new files.
    setEntries((list) => [
      ...list.filter((entry) => entry.status !== 'failed'),
      ...added.map(({ key, file }) => ({ key, fileName: file.name, status: 'waiting' as const })),
    ]);
    if (!running.current) void run();
  }

  return {
    entries,
    add,
    busy: entries.some((entry) => entry.status !== 'failed'),
    stoppedBy,
  };
}
