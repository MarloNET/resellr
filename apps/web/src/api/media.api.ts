import { useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, ApiError, toApiError } from './api-client.ts';
import { queryKeys } from './query-keys.ts';
import {
  writeOutcomeStore as defaultWriteOutcomeStore,
  type WriteOutcomeStore,
} from './write-outcome-store.ts';

/** A photo of a model listing (`GET /api/listings/{id}/photos`, Technical Specification 2.11). */
export interface Photo {
  id: number;
  hash: string;
  /** 1 to 20, the order of the copy assistant. */
  position: number;
  originalName: string;
  byteSize: number;
  url: string;
  thumbUrl: string;
}

export interface PhotoList {
  items: Photo[];
  total: number;
}

/** Answer of `POST /api/listings/{id}/photos` (2.11). */
export interface PhotoUploadResult {
  photo: Photo;
  listingVersion: number;
  count: number;
}

/** Photos of a model listing in their order (UI-015). */
export function usePhotosQuery(listingId: number | null) {
  return useQuery<PhotoList, ApiError>({
    queryKey: queryKeys.media.photos(listingId ?? 0),
    queryFn: ({ signal }) =>
      apiClient.get<PhotoList>(`/api/listings/${listingId}/photos`, { signal }),
    enabled: listingId !== null,
  });
}

export interface UploadPhotoOptions {
  /** Upload progress of the file in percent, 0 to 100. */
  onProgress: (percent: number) => void;
  writeOutcomeStore?: WriteOutcomeStore;
}

/**
 * "Fotos hinzufügen" of UI-015 for one file (`POST /api/listings/{id}/photos`, multipart, one file
 * per request, 2.11, T-2). It sends with `XMLHttpRequest`, because only its `upload.onprogress`
 * reports the progress ("Lade <Datei> hoch (n %)"). Like every write of the API client (CU-047) it
 * has no time limit; the answer is classified the same way (2.0.7), and an end without an HTTP
 * answer locks the page until it is reloaded (P-08).
 */
export function uploadPhoto(
  listingId: number,
  file: File,
  { onProgress, writeOutcomeStore = defaultWriteOutcomeStore }: UploadPhotoOptions,
): Promise<PhotoUploadResult> {
  if (writeOutcomeStore.isLocked()) {
    return Promise.reject(new ApiError('outcome-unknown', null, null));
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `/api/listings/${listingId}/photos`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.floor((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(toApiError(request.status, request.responseText, 'write'));
        return;
      }
      try {
        resolve(JSON.parse(request.responseText) as PhotoUploadResult);
      } catch {
        reject(new ApiError('error', request.status, null));
      }
    };
    // No (complete) HTTP answer: the outcome is unknown (P-08, K-6).
    request.onerror = request.onabort = () => {
      writeOutcomeStore.lock();
      reject(new ApiError('outcome-unknown', null, null));
    };
    const form = new FormData();
    form.append('file', file);
    request.send(form);
  });
}

/**
 * `uploadPhoto` for the photos of one model listing: after each accepted file the photo goes into
 * the cache at once, and the photos and the model listing (`GET /api/listings/{id}`) are read
 * again in the background (2.0.7, Nachtrag MAR-1280), so UI-014 shows the current state after
 * "Fertig".
 */
export function useUploadPhoto(listingId: number) {
  const queryClient = useQueryClient();
  return async (file: File, onProgress: (percent: number) => void) => {
    const result = await uploadPhoto(listingId, file, { onProgress });
    queryClient.setQueryData<PhotoList>(queryKeys.media.photos(listingId), (list) =>
      list === undefined ? list : { items: [...list.items, result.photo], total: result.count },
    );
    void queryClient.invalidateQueries({ queryKey: queryKeys.media.photos(listingId) });
    void queryClient.invalidateQueries({ queryKey: ['inventory', 'listing', listingId] });
    return result;
  };
}
