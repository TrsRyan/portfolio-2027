/**
 * The full intro plays only when the homepage is the first page of the
 * session. If storage is unavailable, the intro plays.
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
    // Storage unavailable: the intro replays.
  }
}
