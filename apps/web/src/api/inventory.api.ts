import type {
  Device,
  DeviceCreateInput,
  DeviceDetail,
  DevicePrefillAnswer,
  DeviceSearchResult,
} from '@resellr/domain/schemas/device.schema';
import { useMutation, useQuery } from '@tanstack/react-query';

import { apiClient, type ApiError } from './api-client.ts';
import { queryKeys } from './query-keys.ts';

// Hooks of the devices of F-05 (CU-131, Technical Specification 2.5). Changing (#190), the
// unassigned devices (#258) and the model listings follow.

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
