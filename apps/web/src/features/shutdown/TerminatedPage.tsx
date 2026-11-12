import { FIXED_TEXTS } from '@resellr/domain/messages/messages.de';
import { useId } from 'react';
import { Navigate } from 'react-router';

import { getTerminationOutcome } from '../../api/app-termination.ts';
import { cn } from '../../components/ui/cn.ts';

/**
 * End state UI-046 on `/beendet` (CU-256, REQ-105, Technical Specification 2.17, 7.3): replaces
 * the whole frame, without navigation and without the notice UI-044, and loads nothing, because
 * no server runs any more. `success` shows the wording of REQ-105 and the data folder path of the
 * answer `200` as selectable text; `unknown` shows the warning without path. Neither shows the two
 * additional lines nor "Erneut versuchen" of the design proposal (Owner comment `97d46083`).
 * Reloading `/beendet` after the shutdown shows the error page of Chrome; that is intended. Without
 * a shutdown in this window there is no end state to show, so the route leads to the start page.
 */
export function TerminatedPage() {
  const outcome = getTerminationOutcome();
  const titleId = useId();
  if (outcome === null) return <Navigate to="/" replace />;

  const warn = outcome.kind === 'unknown';
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-bg p-4">
      <section
        aria-labelledby={titleId}
        className={cn(
          'flex w-full max-w-[560px] flex-col gap-4 rounded-control border p-6 text-body',
          warn ? 'border-flag-warn bg-flag-warn-bg text-flag-warn' : 'border-border bg-surface',
        )}
      >
        <h1 id={titleId} className="m-0 text-page-title font-semibold">
          {warn ? FIXED_TEXTS.shutdownUnknownTitle : FIXED_TEXTS.shutdownDone}
        </h1>
        {warn ? (
          <p className="m-0">{FIXED_TEXTS.shutdownUnknownText}</p>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="m-0">{FIXED_TEXTS.shutdownDoneLocationLead}</p>
            <p data-testid="terminated-path" className="m-0 break-all select-text">
              {outcome.dataDirPath}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
