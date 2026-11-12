// Page change of the launcher pages (CU-271, Technical Specification 2.18 "Seitenwechsel", T-5).
// `fetch` is blocked on `file://` pages, so the page loads `./launcher-state.js` every second as a
// classic script with a changing query; the script calls `window.__resellrLauncherState(state)`.
// The page reacts only to the `request` of its own call (URL parameter). No server, no foreign
// scripts.

const RELOAD_MS = 1000;

const request = new URLSearchParams(location.search).get('request');
const page = document.body.dataset.page;
let done = false;

/** @typedef {{ request?: unknown, phase?: unknown, url?: unknown }} LauncherState */

/** Reaction of each page to a state of its own call. */
const reactions = {
  /** @param {LauncherState} state */
  'lp-01': (state) => {
    if (state.phase === 'ready' && typeof state.url === 'string') goTo(state.url);
  },
};

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
if (request !== null) loadState();
