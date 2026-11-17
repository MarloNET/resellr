import {
  type ModelTemplate,
  type ModelTemplateCreateInput,
  type ModelTemplateList,
  type ModelTemplateMatch,
  modelTemplateMatchSchema,
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
 * with `q` the hits of the search (2.4).
 */
export function useModelTemplatesQuery(filter: ModelTemplateFilter) {
  return useQuery<ModelTemplateList, ApiError>({
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
