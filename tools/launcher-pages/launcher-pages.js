// Page change of the launcher pages (CU-271, Technical Specification 2.18 "Seitenwechsel", T-5).
// `fetch` is blocked on `file://` pages, so the page loads `./launcher-state.js` every second as a
// classic script with a changing query; the script calls `window.__resellrLauncherState(state)`.
// The page reacts only to the `request` of its own call (URL parameter). No server, no foreign
// scripts.

const RELOAD_MS = 1000;
/** Pattern of a reference number (Technical Specification 2.0.5, H-11). */
const REFERENCE_NUMBER = /^R-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

const params = new URLSearchParams(location.search);
const request = params.get('request');
const page = document.body.dataset.page;
let done = false;

/** @typedef {{ request?: unknown, phase?: unknown, url?: unknown, refNo?: unknown, dataDir?: unknown }} LauncherState */

/** Title of `LP-02.zeitueberschreitung` (K-07). */
const TIMEOUT_TITLE = 'resellr startet länger als erwartet';

/** Card and title of LP-03 for each result phase `stop` writes (2.18 "Seitenwechsel"). */
const LP_03_RESULTS = {
  stopped: { card: 'lp-03-success', title: 'resellr ist beendet' },
  error: { card: 'lp-03-error', title: 'resellr konnte nicht beendet werden' },
  not_running: { card: 'lp-03-nicht-aktiv', title: 'resellr läuft nicht' },
};

/**
 * Reaction of each page to a state of its own call. Every target address was written by `open`
 * through CU-268 and CU-310 (2.18 "Seitenwechsel").
 */
const reactions = {
  /** @param {LauncherState} state */
  'lp-01': (state) => {
    // `aborted` (also for `gave_up` and `already_running` without a server) leads to LP-02 with
    // the reference number, `timeout` after 120 s to `LP-02.zeitueberschreitung` (K-07).
    if (
      (state.phase === 'ready' || state.phase === 'aborted' || state.phase === 'timeout') &&
      typeof state.url === 'string'
    ) {
      goTo(state.url);
    }
  },
  /** @param {LauncherState} state */
  'lp-02': (state) => {
    // `LP-02.zeitueberschreitung` reads on: `ready` goes on to the local address like LP-01,
    // `aborted` to `LP-02.default` with the number of the abort (K-07).
    if ((state.phase === 'ready' || state.phase === 'aborted') && typeof state.url === 'string') {
      goTo(state.url);
    }
  },
  /** @param {LauncherState} state */
  'lp-03': (state) => {
    // LP-03 goes nowhere: it shows the result of its `stop` call in place of `loading`.
    const result = LP_03_RESULTS[/** @type {keyof typeof LP_03_RESULTS} */ (state.phase)];
    if (result === undefined) return;
    done = true;
    const card = document.getElementById(result.card);
    if (card === null) return;
    document.getElementById('lp-03-loading')?.setAttribute('hidden', '');
    if (state.phase === 'stopped') showDataDir(card, state.dataDir);
    if (state.phase === 'error') showReferenceNumber(card, state.refNo);
    card.hidden = false;
    document.title = result.title;
  },
};

/**
 * LP-02 shows `zeitueberschreitung` instead of `default` when its address carries the `request` of
 * a waiting call; only then it reads `launcher-state.js` (K-07). Returns the shown card.
 * @returns {HTMLElement | null}
 */
function showLp02State() {
  if (request === null) return document.getElementById('lp-02-default');
  const card = document.getElementById('lp-02-zeitueberschreitung');
  if (card === null) return null;
  document.getElementById('lp-02-default')?.setAttribute('hidden', '');
  card.hidden = false;
  document.title = TIMEOUT_TITLE;
  return card;
}

/**
 * Shows a reference number in the card, but only one that matches the pattern (H-11): LP-02 takes
 * it from its address, LP-03 from `launcher-state.js`.
 * @param {HTMLElement | null} card
 * @param {unknown} refNo
 */
function showReferenceNumber(card, refNo) {
  const element = /** @type {HTMLElement | null | undefined} */ (
    card?.querySelector('.reference-number')
  );
  if (!element || typeof refNo !== 'string' || !REFERENCE_NUMBER.test(refNo)) return;
  element.textContent = refNo;
  element.hidden = false;
}

/**
 * LP-03.success shows the data folder as plain, selectable text (REQ-105, X-6).
 * @param {HTMLElement} card
 * @param {unknown} dataDir
 */
function showDataDir(card, dataDir) {
  const element = card.querySelector('.data-dir');
  if (element !== null && typeof dataDir === 'string') element.textContent = dataDir;
}

/** @param {string} url */
function goTo(url) {
  done = true;
  location.replace(url);
}

/** @param {unknown} state */
function onLauncherState(state) {
  if (done || typeof state !== 'object' || state === null) return;
  if (/** @type {LauncherState} */ (state).request !== request) return;
  const react = reactions[/** @type {keyof typeof reactions} */ (page)];
  react?.(/** @type {LauncherState} */ (state));
}

/** Loads `launcher-state.js` once and schedules the next load, also if the file is missing. */
function loadState() {
  if (done) return;
  const script = document.createElement('script');
  script.src = `./launcher-state.js?t=${Date.now()}`;
  const next = () => {
    script.remove();
    setTimeout(loadState, RELOAD_MS);
  };
  script.addEventListener('load', next);
  script.addEventListener('error', next);
  document.head.append(script);
}

Object.assign(window, { __resellrLauncherState: onLauncherState });
if (page === 'lp-02') showReferenceNumber(showLp02State(), params.get('ref'));
if (request !== null) loadState();
