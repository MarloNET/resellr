import type {
  DeviceType,
  DeviceTypeCreate,
  DeviceTypeList,
  DeviceTypeUpdate,
} from '@resellr/domain/schemas/device-type.schema';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { apiClient, type ApiError } from './api-client.ts';
import { queryKeys } from './query-keys.ts';

// Hooks of the settings of F-01 and F-02 (CU-092, Technical Specification 2.1, 2.2).

/** Largest page of a list (2.0.1); UI-027 shows all device types at once. */
const ALL_DEVICE_TYPES = '/api/device-types?limit=200';

/** Device types of UI-027, active and deactivated (`GET /api/device-types`). */
export function useDeviceTypesQuery() {
  return useQuery<DeviceTypeList, ApiError>({
    queryKey: queryKeys.settings.deviceTypes(),
    queryFn: ({ signal }) => apiClient.get<DeviceTypeList>(ALL_DEVICE_TYPES, { signal }),
  });
}

/**
 * Takes the saved device type into the cache at once and loads the list again in the
 * background (2.0.7 "Wartezustand bei Folgeanfragen").
 */
function storeDeviceType(queryClient: QueryClient, saved: DeviceType) {
  queryClient.setQueryData<DeviceTypeList>(queryKeys.settings.deviceTypes(), (list) => {
    if (list === undefined) return list;
    const known = list.items.some((item) => item.id === saved.id);
    return known
      ? { ...list, items: list.items.map((item) => (item.id === saved.id ? saved : item)) }
      : { items: [...list.items, saved], total: list.total + 1 };
  });
  void queryClient.invalidateQueries({ queryKey: queryKeys.settings.deviceTypes() });
}

/** "Geräteart speichern" for a new device type (`POST /api/device-types`). */
export function useCreateDeviceTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation<DeviceType, ApiError, DeviceTypeCreate>({
    mutationFn: (body) => apiClient.post<DeviceType>('/api/device-types', body),
    onSuccess: (saved) => storeDeviceType(queryClient, saved),
  });
}

/** "Geräteart speichern" for an existing device type (`PATCH /api/device-types/{id}`). */
export function useUpdateDeviceTypeMutation() {
  const queryClient = useQueryClient();
  return useMutation<DeviceType, ApiError, DeviceTypeUpdate & { id: number }>({
    mutationFn: ({ id, ...body }) => apiClient.patch<DeviceType>(`/api/device-types/${id}`, body),
    onSuccess: (saved) => storeDeviceType(queryClient, saved),
  });
}
