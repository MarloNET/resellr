import {
  type ModelTemplate,
  type ModelTemplateCreateInput,
  type ModelTemplateList,
  type ModelTemplateMatch,
  modelTemplateMatchSchema,
  type ModelTemplateUpdateInput,
} from '@resellr/domain/schemas/model-template.schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, type ApiError } from './api-client.ts';
import { queryKeys } from './query-keys.ts';

// Hooks of the model templates of F-04 (CU-110, Technical Specification 2.4).

/** Search of UI-006: `q` with at least 2 characters or none, optional device type. */
export interface ModelTemplateFilter {
  q?: string;
  deviceTypeId?: number;
}

/**
 * Model templates of UI-006 (`GET /api/model-templates`): without `q` the 50 latest created,
 * with `q` the hits of the search (2.4). UI-003 asks only with a search term (`enabled`).
 */
export function useModelTemplatesQuery(
  filter: ModelTemplateFilter,
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery<ModelTemplateList, ApiError>({
    enabled,
    queryKey: queryKeys.catalog.modelTemplates(filter),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (filter.q !== undefined) params.set('q', filter.q);
      if (filter.deviceTypeId !== undefined)
        params.set('deviceTypeId', String(filter.deviceTypeId));
      const query = params.size > 0 ? `?${params.toString()}` : '';
      return apiClient.get<ModelTemplateList>(`/api/model-templates${query}`, { signal });
    },
  });
}

/**
 * One model template (`GET /api/model-templates/{id}`, 2.4), e.g. its model values for the
 * panel "Modelldaten" of UI-003; no request without an id.
 */
export function useModelTemplateQuery(id: number | null) {
  return useQuery<ModelTemplate, ApiError>({
    queryKey: queryKeys.catalog.modelTemplate(id ?? 0),
    queryFn: ({ signal }) => apiClient.get<ModelTemplate>(`/api/model-templates/${id}`, { signal }),
    enabled: id !== null,
  });
}

/**
 * "Modellvorlage speichern" of UI-007 for a new model template (`POST /api/model-templates`,
 * 2.4). The lists of UI-006 load again in the background (2.0.7 "Wartezustand bei
 * Folgeanfragen").
 */
export function useCreateModelTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation<ModelTemplate, ApiError, ModelTemplateCreateInput>({
    mutationFn: (body) => apiClient.post<ModelTemplate>('/api/model-templates', body),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.modelTemplateLists() }),
  });
}

/**
 * "Modellvorlage speichern" of UI-007 for a model template being changed
 * (`PATCH /api/model-templates/{id}`, 2.4). The answer goes into the cache of the model template,
 * the lists of UI-006 load again in the background (2.0.7 "Wartezustand bei Folgeanfragen").
 */
export function useUpdateModelTemplateMutation(id: number) {
  const queryClient = useQueryClient();
  return useMutation<ModelTemplate, ApiError, ModelTemplateUpdateInput>({
    mutationFn: (body) => apiClient.patch<ModelTemplate>(`/api/model-templates/${id}`, body),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.catalog.modelTemplate(id), saved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.modelTemplateLists() });
    },
  });
}

const matchesSchema = modelTemplateMatchSchema.array().min(1);

/**
 * The hits of a possible duplicate (`422 confirmation_required`, `details.kind:
 * possible_duplicate`, REQ-011; 2.4) from a failed `POST /api/model-templates`; `null` for any
 * other error.
 */
export function possibleDuplicatesOf(error: ApiError): ModelTemplateMatch[] | null {
  const details = error.error?.details;
  if (error.kind !== 'confirmation-required' || details?.kind !== 'possible_duplicate') return null;
  const matches = matchesSchema.safeParse(details.matches);
  return matches.success ? matches.data : null;
}
