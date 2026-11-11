import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { type NavigateFunction, useNavigate } from 'react-router';

/** Route of the end state UI-046 (Technical Specification 4.2). */
export const TERMINATED_PATH = '/beendet';

/**
 * Outcome of "resellr beenden" that UI-046 shows: `success` = `200` with the data folder path of
 * the answer, `unknown` = no answer within 30 s or connection lost (Technical Specification 2.17).
 */
export type TerminationOutcome = { kind: 'success'; dataDirPath: string } | { kind: 'unknown' };

let outcome: TerminationOutcome | null = null;

/**
 * Flag `terminated`: set once resellr was shut down from this window, kept until the page is
 * reloaded. While it is set, the query client starts no query (CU-046).
 */
export function isAppTerminated(): boolean {
  return outcome !== null;
}

/** Outcome for UI-046 (CU-256); `null` when this window has not shut resellr down. */
export function getTerminationOutcome(): TerminationOutcome | null {
  return outcome;
}

/**
 * Ends the use of resellr in this window after "resellr beenden" (CU-257, Technical
 * Specification 2.17): sets the flag `terminated`, stops all running queries
 * (`cancelQueries()`), drops the cache (`clear()`) and navigates client-side to `/beendet`,
 * which replaces the frame with UI-046. Only the first outcome counts.
 */
export async function terminateApp(
  queryClient: QueryClient,
  navigate: NavigateFunction,
  next: TerminationOutcome,
): Promise<void> {
  if (outcome !== null) return;
  outcome = next;
  await queryClient.cancelQueries();
  queryClient.clear();
  await navigate(TERMINATED_PATH, { replace: true });
}

/** {@link terminateApp} with the query client and the router of the calling component. */
export function useAppTermination(): (next: TerminationOutcome) => Promise<void> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useCallback((next) => terminateApp(queryClient, navigate, next), [queryClient, navigate]);
}
