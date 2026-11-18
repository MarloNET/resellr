import type {
  Device,
  DeviceCreateInput,
  DeviceDetail,
  DevicePrefillAnswer,
  DeviceSearchResult,
  DeviceUpdateInput,
} from '@resellr/domain/schemas/device.schema';
import type {
  DeviceAssignment,
  DeviceAssignmentInput,
  Listing,
  ListingChoice,
  ListingCreateInput,
} from '@resellr/domain/schemas/listing.schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, type ApiError } from './api-client.ts';
import { queryKeys } from './query-keys.ts';

// Hooks of the devices of F-05 and the model listings of F-06 (CU-131, Technical Specification
// 2.5, 2.6). The unassigned devices (#258) and the other model listing hooks
// follow.

/**
 * Hits of the device search of UI-009 (`GET /api/devices?wiNr=`, REQ-016): the first page of
 * 50 by a part of the WI-Nr; no request without a term.
 */
export function useDeviceSearchQuery(wiNr: string | undefined) {
  return useQuery<DeviceSearchResult, ApiError>({
    queryKey: queryKeys.inventory.deviceSearch(wiNr ?? ''),
    queryFn: ({ signal }) =>
      apiClient.get<DeviceSearchResult>(
        `/api/devices?${new URLSearchParams({ wiNr: wiNr ?? '' })}`,
        {
          signal,
        },
      ),
    enabled: wiNr !== undefined,
  });
}

/** One device with its model listing (`GET /api/devices/{id}`); no request without an id. */
export function useDeviceQuery(id: number | null) {
  return useQuery<DeviceDetail, ApiError>({
    queryKey: queryKeys.inventory.device(id ?? 0),
    queryFn: ({ signal }) => apiClient.get<DeviceDetail>(`/api/devices/${id}`, { signal }),
    enabled: id !== null,
  });
}

/**
 * The prefill of a device from a model template with its review flags
 * (`GET /api/model-templates/{id}/device-prefill`, 2.5); no request without a model template.
 */
export function useDevicePrefillQuery(modelTemplateId: number | null) {
  return useQuery<DevicePrefillAnswer, ApiError>({
    queryKey: queryKeys.inventory.devicePrefill(modelTemplateId ?? 0),
    queryFn: ({ signal }) =>
      apiClient.get<DevicePrefillAnswer>(`/api/model-templates/${modelTemplateId}/device-prefill`, {
        signal,
      }),
    enabled: modelTemplateId !== null,
  });
}

/** "Gerät speichern" and "Speichern und zuordnen" of UI-003 (`POST /api/devices`, 2.5). */
export function useCreateDeviceMutation() {
  return useMutation<Device, ApiError, DeviceCreateInput>({
    mutationFn: (body) => apiClient.post<Device>('/api/devices', body),
  });
}

/**
 * "Neues Modell-Inserat anlegen" of UI-004 (`POST /api/listings`, 2.6): the device is then
 * assigned to the new model listing, so the cached devices are read again.
 */
export function useCreateListingMutation() {
  const queryClient = useQueryClient();
  return useMutation<Listing, ApiError, ListingCreateInput>({
    mutationFn: (body) => apiClient.post<Listing>('/api/listings', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
  });
}

/**
 * "Gerätewerte speichern" of UI-010 (`PATCH /api/devices/{id}`, 2.5): on success the device of
 * the page takes the answer, and the hit lists of the search are read again (capture status).
 */
export function useUpdateDeviceMutation(id: number) {
  const queryClient = useQueryClient();
  return useMutation<Device, ApiError, DeviceUpdateInput>({
    mutationFn: (body) => apiClient.patch<Device>(`/api/devices/${id}`, body),
    onSuccess: (device) => {
      queryClient.setQueryData<DeviceDetail>(queryKeys.inventory.device(id), (previous) =>
        previous === undefined ? previous : { ...previous, ...device },
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.deviceSearch('').slice(0, -1),
      });
    },
  });
}

/**
 * The model listings of a model template to choose from in UI-004
 * (`GET /api/model-templates/{id}/listings`, 2.6).
 */
export function useListingChoiceQuery(modelTemplateId: number) {
  return useQuery<ListingChoice, ApiError>({
    queryKey: queryKeys.inventory.listingChoice(modelTemplateId),
    queryFn: ({ signal }) =>
      apiClient.get<ListingChoice>(`/api/model-templates/${modelTemplateId}/listings`, { signal }),
  });
}

/**
 * "Zuordnen" of UI-004 (`POST /api/devices/{id}/assignment`, 2.6): the device and the quantity
 * of its model listing change, so the cached devices and model listings are read again.
 */
export function useAssignDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation<DeviceAssignment, ApiError, { deviceId: number; body: DeviceAssignmentInput }>(
    {
      mutationFn: ({ deviceId, body }) =>
        apiClient.post<DeviceAssignment>(`/api/devices/${deviceId}/assignment`, body),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
    },
  );
}
