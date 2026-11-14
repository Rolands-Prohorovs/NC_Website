import { useEffect, useMemo, useState } from 'react';
import { USE_MOCK_API } from './auth';

// League: every user of a city ranked by XP (DECISIONS.md D15; API.md "League").
// XP comes from to-do tasks and daily tasks.
//
// Same switch as auth.ts: while Timofei's backend has no league endpoint, a MOCK answers.

/** One row of GET /api/cities/:city/league. */
export type LeagueRow = { nickname: string; xp: number; rank: number };
export type LeagueEntry = LeagueRow & { me: boolean };

// ---------- MOCK ----------
// !! TEMPORARY. These players are INVENTED so the table can be designed and demoed before the
// !! backend exists. Never ship them to real users: delete this block with the auth mock.
const MOCK_PLAYERS: { nickname: string; xp: number }[] = [
  { nickname: 'moomin42', xp: 145 },
  { nickname: 'Aino_K', xp: 120 },
  { nickname: 'salpausselka', xp: 95 },
  { nickname: 'new-in-lahti', xp: 60 },
  { nickname: 'sauna_fan', xp: 35 },
  { nickname: 'Vesijarvi', xp: 10 },
];
// ---------- END MOCK ----------

async function fetchLeague(cityId: string): Promise<{ nickname: string; xp: number }[]> {
  if (USE_MOCK_API) return MOCK_PLAYERS;
  const res = await fetch(`/api/cities/${encodeURIComponent(cityId)}/league?limit=20`, {
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as LeagueRow[];
}

/** Highest XP first; equal XP shares a rank (1, 2, 2, 4). */
export function rankLeague(
  players: { nickname: string; xp: number }[],
  me: { nickname: string; xp: number } | null
): LeagueEntry[] {
  const mine = me?.nickname.toLowerCase();
  const rows = players
    .filter((p) => p.nickname.toLowerCase() !== mine)
    .map((p) => ({ ...p, me: false }));
  if (me) rows.push({ ...me, me: true });
  // On equal XP the current user is listed first, then alphabetically.
  rows.sort(
    (a, b) => b.xp - a.xp || Number(b.me) - Number(a.me) || a.nickname.localeCompare(b.nickname)
  );
  let rank = 0;
  return rows.map((row, i) => {
    if (i === 0 || row.xp !== rows[i - 1].xp) rank = i + 1;
    return { ...row, rank };
  });
}

/**
 * The league table for a city. `me` is the logged-in user with the XP shown on this device, so
 * their row moves as soon as they tick a task.
 * TODO (real API): progress is still stored on the device, so the server can't know the user's
 * XP yet; once it does, drop the local XP and just re-fetch after a tick.
 */
export function useLeague(
  cityId: string,
  me: { nickname: string; xp: number } | null
): LeagueEntry[] | null {
  const [players, setPlayers] = useState<{ nickname: string; xp: number }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLeague(cityId)
      .then((rows) => !cancelled && setPlayers(rows))
      .catch((err) => {
        console.warn('League failed to load', err);
        if (!cancelled) setPlayers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  const nickname = me?.nickname;
  const xp = me?.xp;
  return useMemo(
    () =>
      players &&
      rankLeague(players, nickname === undefined || xp === undefined ? null : { nickname, xp }),
    [players, nickname, xp]
  );
}
