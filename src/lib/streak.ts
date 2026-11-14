// The streak: days in a row on which the user completed a task (DECISIONS.md D11).
//
// There is no streak logic in the frontend, on purpose: the backend owns it (D7). Every place
// that shows a streak (header, Progress, Home) reads it through this one hook, so the real value
// can be plugged in here and nowhere else.

/**
 * Current streak in days for a city. Always 0 until the backend exists.
 * TODO (API.md "Progress"): return `streak.current` from GET /api/cities/:city/progress for a
 * logged-in user; keep 0 when logged out.
 */
export function useStreak(_cityId: string): number {
  return 0;
}
