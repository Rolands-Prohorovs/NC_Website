import { dayNumber } from '../../src/lib/daily.ts';

// The streak (API.md "Progress", Q6): days in a row (Helsinki calendar days) with activity.
// Which days count as activity is decided by the caller; this only does the counting.

export type Streak = {
  /** Days in a row up to lastDay; still shown the day after lastDay, 0 once a day is missed. */
  current: number;
  /** The longest run ever. Never lowered, because it is computed from all days. */
  best: number;
  /** The last day with activity, or null if there is none yet. */
  lastDay: string | null;
};

/** `days`: activity days "YYYY-MM-DD" in any order, repeats allowed. `today`: Helsinki today. */
export function streakOf(days: readonly string[], today: string): Streak {
  const unique = [...new Set(days)].sort(); // "YYYY-MM-DD" sorts like dates
  if (unique.length === 0) return { current: 0, best: 0, lastDay: null };

  let best = 1;
  let run = 1; // length of the run ending at unique[i]
  for (let i = 1; i < unique.length; i++) {
    run = dayNumber(unique[i]) === dayNumber(unique[i - 1]) + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }

  const lastDay = unique[unique.length - 1];
  // Active today or yesterday: the streak is alive (yesterday's can still be continued today).
  const alive = dayNumber(today) - dayNumber(lastDay) <= 1;
  return { current: alive ? run : 0, best, lastDay };
}
