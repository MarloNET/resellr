import type {
  DeviceType,
  DeviceTypeCreate,
  DeviceTypeList,
  DeviceTypeUpdate,
} from '@resellr/domain/schemas/device-type.schema';
import type {
  MerchantProfile,
  MerchantProfileUpdate,
} from '@resellr/domain/schemas/merchant-profile.schema';
import type {
  PickList,
  PickListList,
  PickListValue,
  PickListValueCreate,
  PickListValueList,
  PickListValueOrder,
  PickListValueUpdate,
} from '@resellr/domain/schemas/pick-list.schema';
import type {
  Supplier,
  SupplierCreate,
  SupplierList,
  SupplierUpdate,
} from '@resellr/domain/schemas/supplier.schema';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { apiClient, type ApiError } from './api-client.ts';
import { queryKeys } from './query-keys.ts';

// Hooks of the settings of F-01 and F-02 (CU-092, Technical Specification 2.1, 2.2).

/**
 * Largest page of a list (2.0.1); UI-027 shows all device types, UI-028 all lists and all values
 * of a list at once.
 */
const ALL = 'limit=200';

/** Largest page of a list (2.0.1); UI-032 shows all suppliers, active and deactivated. */
const ALL_SUPPLIERS = '/api/suppliers?includeInactive=true&limit=200';

/**
 * Takes the saved entry into the cached list at once and loads the list again in the
 * background (2.0.7 "Wartezustand bei Folgeanfragen").
 */
function storeSaved<T extends { id: number }>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  saved: T,
) {
  queryClient.setQueryData<{ items: T[]; total: number }>(queryKey, (list) => {
    if (list === undefined) return list;
    const known = list.items.some((item) => item.id === saved.id);
    return known
      ? { ...list, items: list.items.map((item) => (item.id === saved.id ? saved : item)) }
      : { items: [...list.items, saved], total: list.total + 1 };
  });
  void queryClient.invalidateQueries({ queryKey });
}

/** Device types of UI-027, active and deactivated (`GET /api/device-types`). */
export function useDeviceTypesQuery() {
  return useQuery<DeviceTypeList, ApiError>({
    queryKey: queryKeys.settings.deviceTypes(),
    queryFn: ({ signal }) => apiClient.get<DeviceTypeList>(`/api/device-types?${ALL}`, { signal }),
  });
}

/** "Geräteart speichern" for a new device type (`POST /api/device-types`). */
export function useCreateDeviceTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation<DeviceType, ApiError, DeviceTypeCreate>({
    mutationFn: (body) => apiClient.post<DeviceType>('/api/device-types', body),
    onSuccess: (saved) => storeSaved(queryClient, queryKeys.settings.deviceTypes(), saved),
  });
}

/** "Geräteart speichern" for an existing device type (`PATCH /api/device-types/{id}`). */
export function useUpdateDeviceTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation<DeviceType, ApiError, DeviceTypeUpdate & { id: number }>({
    mutationFn: ({ id, ...body }) => apiClient.patch<DeviceType>(`/api/device-types/${id}`, body),
    onSuccess: (saved) => storeSaved(queryClient, queryKeys.settings.deviceTypes(), saved),
  });
}

/** Suppliers of UI-032, active and deactivated (`GET /api/suppliers?includeInactive=true`). */
export function useSuppliersQuery() {
  return useQuery<SupplierList, ApiError>({
    queryKey: queryKeys.settings.suppliers(),
    queryFn: ({ signal }) => apiClient.get<SupplierList>(ALL_SUPPLIERS, { signal }),
  });
}

/** "Speichern" for a new supplier (`POST /api/suppliers`). */
export function useCreateSupplierMutation() {
  const queryClient = useQueryClient();
  return useMutation<Supplier, ApiError, SupplierCreate>({
    mutationFn: (body) => apiClient.post<Supplier>('/api/suppliers', body),
    onSuccess: (saved) => storeSaved(queryClient, queryKeys.settings.suppliers(), saved),
  });
}

/** "Speichern" for an existing supplier (`PATCH /api/suppliers/{id}`). */
export function useUpdateSupplierMutation() {
  const queryClient = useQueryClient();
  return useMutation<Supplier, ApiError, SupplierUpdate & { id: number }>({
    mutationFn: ({ id, ...body }) => apiClient.patch<Supplier>(`/api/suppliers/${id}`, body),
    onSuccess: (saved) => storeSaved(queryClient, queryKeys.settings.suppliers(), saved),
  });
}

/** Merchant profile of UI-026 (`GET /api/merchant-profile`). */
export function useMerchantProfileQuery() {
  return useQuery<MerchantProfile, ApiError>({
    queryKey: queryKeys.settings.merchantProfile(),
    queryFn: ({ signal }) => apiClient.get<MerchantProfile>('/api/merchant-profile', { signal }),
  });
}

/** "Speichern" of UI-026 (`PUT /api/merchant-profile`); the answer is the saved profile. */
export function useSaveMerchantProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation<MerchantProfile, ApiError, MerchantProfileUpdate>({
    mutationFn: (body) => apiClient.put<MerchantProfile>('/api/merchant-profile', body),
    onSuccess: (saved) => queryClient.setQueryData(queryKeys.settings.merchantProfile(), saved),
  });
}

/** The nine pick lists of UI-028 (`GET /api/pick-lists`). */
export function usePickListsQuery() {
  return useQuery<PickListList, ApiError>({
    queryKey: queryKeys.settings.pickLists(),
    queryFn: ({ signal }) => apiClient.get<PickListList>(`/api/pick-lists?${ALL}`, { signal }),
  });
}

/** Values of one list, active and deactivated (`GET /api/pick-lists/{id}/values`). */
export function usePickListValuesQuery(pickListId: number | null) {
  return useQuery<PickListValueList, ApiError>({
    queryKey: queryKeys.settings.pickListValues(pickListId ?? 0),
    queryFn: ({ signal }) =>
      apiClient.get<PickListValueList>(`/api/pick-lists/${pickListId}/values?${ALL}`, { signal }),
    enabled: pickListId !== null,
  });
}

/**
 * Takes the saved value into the cache at once and loads the values again in the background
 * (2.0.7 "Wartezustand bei Folgeanfragen").
 */
function storeValue(queryClient: QueryClient, pickListId: number, saved: PickListValue) {
  const key = queryKeys.settings.pickListValues(pickListId);
  queryClient.setQueryData<PickListValueList>(key, (list) => {
    if (list === undefined) return list;
    const known = list.items.some((item) => item.id === saved.id);
    return known
      ? { ...list, items: list.items.map((item) => (item.id === saved.id ? saved : item)) }
      : { items: [...list.items, saved], total: list.total + 1 };
  });
  void queryClient.invalidateQueries({ queryKey: key });
}

/** "Wert anlegen" (`POST /api/pick-lists/{id}/values`). */
export function useCreatePickListValueMutation() {
  const queryClient = useQueryClient();
  return useMutation<PickListValue, ApiError, PickListValueCreate & { pickListId: number }>({
    mutationFn: ({ pickListId, ...body }) =>
      apiClient.post<PickListValue>(`/api/pick-lists/${pickListId}/values`, body),
    onSuccess: (saved, { pickListId }) => storeValue(queryClient, pickListId, saved),
  });
}

/** Rename, flag and status of a value (`PATCH /api/pick-list-values/{id}`). */
export function useUpdatePickListValueMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    PickListValue,
    ApiError,
    PickListValueUpdate & { id: number; pickListId: number }
  >({
    // Fields left `undefined` are not sent (`JSON.stringify`), so they stay unchanged.
    mutationFn: ({ id, version, label, active, batteryPresent }) =>
      apiClient.patch<PickListValue>(`/api/pick-list-values/${id}`, {
        version,
        label,
        active,
        batteryPresent,
      }),
    onSuccess: (saved, { pickListId }) => storeValue(queryClient, pickListId, saved),
  });
}

/** New order of the values (`PUT /api/pick-lists/{id}/value-order`, DER-35-08). */
export function useReorderPickListValuesMutation() {
  const queryClient = useQueryClient();
  return useMutation<PickList, ApiError, PickListValueOrder & { pickListId: number }>({
    mutationFn: ({ pickListId, ...body }) =>
      apiClient.put<PickList>(`/api/pick-lists/${pickListId}/value-order`, body),
    onSuccess: (saved, { pickListId, valueIds }) => {
      queryClient.setQueryData<PickListList>(queryKeys.settings.pickLists(), (lists) =>
        lists === undefined
          ? lists
          : { ...lists, items: lists.items.map((item) => (item.id === saved.id ? saved : item)) },
      );
      const key = queryKeys.settings.pickListValues(pickListId);
      queryClient.setQueryData<PickListValueList>(key, (list) => {
        if (list === undefined) return list;
        const byId = new Map(list.items.map((item) => [item.id, item]));
        const items = valueIds.flatMap((id, index) => {
          const item = byId.get(id);
          return item ? [{ ...item, sortOrder: index + 1 }] : [];
        });
        return { ...list, items };
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.pickLists() });
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
