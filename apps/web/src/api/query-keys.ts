/**
 * All query keys of web-ui (CU-048, hotspot): `['<component>', '<resource>', id?]`
 * (Technical Specification 4.2), grouped by server component.
 */
export const queryKeys = {
  ops: {
    all: ['ops'] as const,
    status: () => ['ops', 'status'] as const,
    health: () => ['ops', 'health'] as const,
  },
} as const;

/**
 * Resource of the copy assistant view (UI-019). Its queries are not refetched on window
 * focus (Technical Specification 2.0.8, CU-046); the key itself is added with UI-019.
 */
export const COPY_VIEW_RESOURCE = 'copy-view';
