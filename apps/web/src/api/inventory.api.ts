import type {
  Device,
  DeviceCreateInput,
  DeviceDetail,
  DevicePrefillAnswer,
  DeviceSearchResult,
  DeviceUpdateInput,
} from '@resellr/domain/schemas/device.schema';
import {
  type DeviceAssignment,
  type DeviceAssignmentInput,
  type DeviceRebooking,
  type DeviceRebookingInput,
  type Listing,
  type ListingChoice,
  type ListingCreateInput,
  type ListingDetail,
  type ListingPriceInput,
  type ListingPrices,
  variantDeviationDetailsSchema,
  type VariantDeviationItem,
} from '@resellr/domain/schemas/listing.schema';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, type ApiError } from './api-client.ts';
import { queryKeys } from './query-keys.ts';

// Hooks of the devices of F-05 and the model listings of F-06 and F-07 (CU-131, Technical
// Specification 2.5 to 2.7), with #204 the price per channel. The unassigned devices (#258) and
// the other model listing hooks follow.

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

/** What a prefill is asked for: the model template, the condition code and its supplier. */
export interface DevicePrefillRequest {
  modelTemplateId: number;
  conditionCode: string | null;
  supplierId: number | null;
}

/**
 * The prefill of a device from a model template with its review flags and the result of the
 * condition code for the supplier
 * (`GET /api/model-templates/{id}/device-prefill?conditionCode=&supplierId=`, 2.5); no request
 * without a model template.
 */
export function useDevicePrefillQuery(request: DevicePrefillRequest | null) {
  const code = {
    conditionCode: request?.conditionCode ?? null,
    supplierId: request?.supplierId ?? null,
  };
  return useQuery<DevicePrefillAnswer, ApiError>({
    queryKey: queryKeys.inventory.devicePrefill(request?.modelTemplateId ?? 0, code),
    queryFn: ({ signal }) => {
      const query = new URLSearchParams();
      if (code.conditionCode !== null) query.set('conditionCode', code.conditionCode);
      if (code.supplierId !== null) query.set('supplierId', String(code.supplierId));
      const search = query.size === 0 ? '' : `?${query}`;
      return apiClient.get<DevicePrefillAnswer>(
        `/api/model-templates/${request?.modelTemplateId}/device-prefill${search}`,
        { signal },
      );
    },
    enabled: request !== null,
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
 * A model listing with stock data, prices, devices and delivery scope for UI-014
 * (`GET /api/listings/{id}?includeCancelled=`, 2.7); no request without an id.
 */
export function useListingQuery(id: number | null, { includeCancelled = false } = {}) {
  return useQuery<ListingDetail, ApiError>({
    queryKey: queryKeys.inventory.listing(id ?? 0, { includeCancelled }),
    queryFn: ({ signal }) =>
      apiClient.get<ListingDetail>(
        `/api/listings/${id}${includeCancelled ? '?includeCancelled=true' : ''}`,
        { signal },
      ),
    enabled: id !== null,
    // The filter "auch stornierte" keeps the page while the other list loads.
    placeholderData: keepPreviousData,
  });
}

/**
 * The model listings of a model template with their deviations to a device for UI-005
 * (`GET /api/model-templates/{id}/listings?deviceId=`, 2.6).
 */
export function useListingDeviationsQuery(modelTemplateId: number, deviceId: number) {
  return useQuery<ListingChoice, ApiError>({
    queryKey: queryKeys.inventory.listingDeviations(modelTemplateId, deviceId),
    queryFn: ({ signal }) =>
      apiClient.get<ListingChoice>(
        `/api/model-templates/${modelTemplateId}/listings?${new URLSearchParams({ deviceId: String(deviceId) })}`,
        { signal },
      ),
  });
}

/**
 * The deviations of deviating variant data (`422 confirmation_required`, `details.kind:
 * variant_deviation`, REQ-018; 2.6) from a failed assignment; `null` for any other error.
 */
export function variantDeviationsOf(error: ApiError): VariantDeviationItem[] | null {
  if (error.kind !== 'confirmation-required') return null;
  const details = variantDeviationDetailsSchema.safeParse(error.error?.details);
  return details.success ? details.data.deviations : null;
}

/**
 * "Zuordnen" of UI-004 and "Trotzdem zuordnen" of UI-005 (`POST /api/devices/{id}/assignment`,
 * 2.6): the device and the quantity of its model listing change, so the cached devices and model
 * listings are read again.
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

/**
 * "Preis speichern" of a channel in UI-014 (`PUT /api/listings/{id}/prices/{channelId}`, 2.7): the
 * answer holds the prices of all channels and the new version, which the cached model listing
 * takes over without reading it again (DER-62-04).
 */
export function useSaveListingPriceMutation(listingId: number) {
  const queryClient = useQueryClient();
  return useMutation<ListingPrices, ApiError, { channelId: number; body: ListingPriceInput }>({
    mutationFn: ({ channelId, body }) =>
      apiClient.put<ListingPrices>(`/api/listings/${listingId}/prices/${channelId}`, body),
    onSuccess: ({ listing, prices }) => {
      queryClient.setQueriesData<ListingDetail>(
        {
          queryKey: queryKeys.inventory.listing(listingId, { includeCancelled: false }).slice(0, 3),
        },
        (previous) =>
          previous === undefined ? previous : { ...previous, version: listing.version, prices },
      );
    },
  });
}

/**
 * "Umbuchen" of UI-004 (Modus "umbuchen") and UI-005 (`POST /api/devices/{id}/rebooking`, 2.6,
 * REQ-020): the device and the quantities of both model listings change, so the cached devices
 * and model listings are read again.
 */
export function useRebookDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation<DeviceRebooking, ApiError, { deviceId: number; body: DeviceRebookingInput }>({
    mutationFn: ({ deviceId, body }) =>
      apiClient.post<DeviceRebooking>(`/api/devices/${deviceId}/rebooking`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
  });
}
