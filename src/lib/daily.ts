// Daily tasks: which tasks of a city's pool are offered on a given day (DECISIONS.md D16).
//
// Pure functions only: no React, no DOM, no storage. The backend will own this later (D7), so
// that a logged-in user gets the same offer on every device and can't choose their own tasks.
// Until then the browser runs it. API.md "Daily offer algorithm" describes the same steps in
// words, with test vectors; keep the two in sync when changing anything here.

export const TIERS = ['easy', 'medium', 'hard'] as const;
export type Tier = (typeof TIERS)[number];

/** One task of the pool (src/content/<city>/daily.json). Its XP comes from its tier. */
export type DailyDef = { id: string; tier: Tier };

/** How many tasks of each tier are offered per day (city.json `daily.perDay`). */
export type DailyQuota = Record<Tier, number>;

/** 32-bit FNV-1a over the string's char codes. Ids, city ids and tier names are ASCII. */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a tiny seeded generator returning numbers in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A shuffled copy of `items` (Fisher–Yates from the end), the same for the same seed. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const random = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Whole days from 1970-01-01 to a calendar date "YYYY-MM-DD" (no time zone involved). */
export function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/**
 * The tasks offered on `date` ("YYYY-MM-DD"): `perDay[tier]` tasks of each tier, easy first.
 *
 * Seeded by city + date only, so everyone in a city gets the same tasks on the same day and a
 * reload changes nothing. Each tier walks through a shuffled copy of its pool, a few tasks per
 * day, and reshuffles (with a new seed) only once it has gone through it: no task of a tier
 * comes back before the others in that tier had their turn. (When the quota doesn't divide the
 * pool size, the left-over tasks of a round wait for the next one.)
 *
 * A tier with fewer tasks than its quota offers all of them every day; an empty tier offers none.
 */
export function pickDaily(
  pool: readonly DailyDef[],
  perDay: DailyQuota,
  cityId: string,
  date: string
): DailyDef[] {
  const day = dayNumber(date);
  return TIERS.flatMap((tier) => {
    // Sorted by id, so the order of the content file doesn't change the offer.
    const tasks = pool
      .filter((task) => task.tier === tier)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const count = Math.min(Math.max(0, Math.floor(perDay[tier])), tasks.length);
    if (count === 0) return [];

    const daysPerRound = Math.floor(tasks.length / count);
    const round = Math.floor(day / daysPerRound);
    const slot = day % daysPerRound;
    return shuffled(tasks, hash32(`${cityId}:${tier}:${round}`)).slice(
      slot * count,
      slot * count + count
    );
  });
}

/** Where the browser fetches a city's pool with the texts of one language (built statically). */
export const dailyPoolUrl = (cityId: string, lang: string) =>
  `/data/${encodeURIComponent(cityId)}/${encodeURIComponent(lang)}/daily.json`;

/** One entry of that file: definition + text in the page's language. */
export type DailyPoolEntry = DailyDef & { label: string; hint: string };
export type DailyPoolFile = { tasks: DailyPoolEntry[] };
