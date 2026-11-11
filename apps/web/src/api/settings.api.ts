import type {
  PickList,
  PickListList,
  PickListValue,
  PickListValueCreate,
  PickListValueList,
  PickListValueOrder,
  PickListValueUpdate,
} from '@resellr/domain/schemas/pick-list.schema';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { apiClient, type ApiError } from './api-client.ts';
import { queryKeys } from './query-keys.ts';

// Hooks of the settings of F-01 and F-02 (CU-092, Technical Specification 2.1, 2.2).

/** Largest page of a list (2.0.1); UI-028 shows all lists and all values of a list at once. */
const ALL = 'limit=200';

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
