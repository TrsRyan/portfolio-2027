/**
 * "Intro played once per session" guard (a preloader convention, per
 * research: `sessionStorage`, not `localStorage` — the intro comes back
 * once per new session / tab, it isn't disabled for good).
 *
 * The flag is set on the FIRST load of any page on the site: the full
 * homepage intro (centered name -> flight to the corner) therefore only
 * plays if `/` is the session's actual entry point. Refresh, a direct link
 * to a project, browser back, clicking "Return" after an F5: all of these
 * see the flag -> "light fade" regime, never the signature gesture.
 *
 * try/catch: private browsing / blocked storage -> we report "not visited"
 * (the intro plays). Safe default: better to replay the intro than to skip
 * it wrongly.
 */
const KEY = "pf-visited";

export function hasVisited(): boolean {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markVisited(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    /* storage unavailable: the intro will replay, no big deal */
  }
}
