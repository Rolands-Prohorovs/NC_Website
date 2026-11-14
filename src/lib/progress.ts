import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  dailyPoolUrl,
  pickDaily,
  type DailyPoolEntry,
  type DailyPoolFile,
  type Tier,
} from './daily';
import type { City, Task } from './schema';

// Checklist progress and daily-task ticks, stored on this device for now.
// TODO: replace with API calls once the backend (PostgreSQL) exists.
//
// State lives in this module rather than in a component, so every island on the
// page (header pills, home dashboard, progress page) sees the same ticks.

const EMPTY: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// ---------- To-do list: progress:<cityId> = ["taskId", ...] ----------

const cache = new Map<string, ReadonlySet<string>>();
const keyFor = (cityId: string) => `progress:${cityId}`;

function read(cityId: string): ReadonlySet<string> {
  let done = cache.get(cityId);
  if (!done) {
    done = EMPTY;
    try {
      const raw = localStorage.getItem(keyFor(cityId));
      if (raw) done = new Set(JSON.parse(raw) as string[]);
    } catch {
      /* storage unavailable */
    }
    cache.set(cityId, done);
  }
  return done;
}

export type Progress = {
  done: ReadonlySet<string>;
  toggle: (id: string) => void;
  xp: number;
  doneCount: number;
  total: number;
};

/** `xp` = baseXp + XP of the ticked to-do tasks + all XP earned from daily tasks. */
export function useProgress(cityId: string, tasks: Task[], baseXp: number): Progress {
  // Server render and hydration use EMPTY; the saved ticks appear right after.
  const done = useSyncExternalStore(subscribe, () => read(cityId), () => EMPTY);
  const dailyXp = useSyncExternalStore(subscribe, () => readDaily(cityId).xp, () => 0);

  const toggle = useCallback(
    (id: string) => {
      const next = toggled(read(cityId), id);
      cache.set(cityId, next);
      save(keyFor(cityId), [...next]);
    },
    [cityId]
  );

  return useMemo(() => {
    const known = tasks.filter((task) => done.has(task.id));
    return {
      done,
      toggle,
      xp: baseXp + dailyXp + known.reduce((sum, task) => sum + task.xp, 0),
      doneCount: known.length,
      total: tasks.length,
    };
  }, [done, dailyXp, toggle, tasks, baseXp]);
}

// ---------- Daily tasks: daily:<cityId> = { date: "YYYY-MM-DD", done: ["taskId", ...], xp: 35 } ----------
// Ticks count only for `date`; on any other (local) day every daily task shows as unchecked.
// Ids in `done` that are not offered today (data saved before the pool existed, or a task that
// was removed from the pool) are ignored; the XP stays.
// `xp` is all XP ever earned from daily tasks (today's included): ticking adds the task's XP,
// un-ticking the same day removes it, and it is kept when the ticks reset.
// TODO: replace with the API's /daily endpoints once the backend (PostgreSQL) exists (API.md).

type DailyState = { date: string; done: ReadonlySet<string>; xp: number };

const dailyCache = new Map<string, DailyState>();
const dailyKeyFor = (cityId: string) => `daily:${cityId}`;

/** Today's date in the device's local time zone, as YYYY-MM-DD. */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function readDaily(cityId: string): DailyState {
  let state = dailyCache.get(cityId);
  if (!state) {
    state = { date: '', done: EMPTY, xp: 0 };
    try {
      const raw = localStorage.getItem(dailyKeyFor(cityId));
      const saved = raw
        ? (JSON.parse(raw) as { date?: unknown; done?: unknown; xp?: unknown })
        : null;
      if (saved && typeof saved.date === 'string' && Array.isArray(saved.done))
        state = {
          date: saved.date,
          done: new Set(saved.done as string[]),
          // Missing in data saved before daily tasks gave XP.
          xp: typeof saved.xp === 'number' && saved.xp > 0 ? saved.xp : 0,
        };
    } catch {
      /* storage unavailable or corrupt: start empty */
    }
    dailyCache.set(cityId, state);
  }
  return state;
}

/** Today's ticks; a stored day that isn't today counts as nothing done. */
function dailySnapshot(cityId: string): ReadonlySet<string> {
  const state = readDaily(cityId);
  return state.date === today() ? state.done : EMPTY;
}

/** Like `subscribe`, but also re-checks the date at local midnight and when the tab becomes visible. */
function subscribeDaily(listener: () => void) {
  const unsubscribe = subscribe(listener);
  let timer: ReturnType<typeof setTimeout>;
  const scheduleMidnight = () => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    // +1 s so the timer never fires just before midnight.
    timer = setTimeout(() => {
      listener();
      scheduleMidnight();
    }, midnight.getTime() - now.getTime() + 1000);
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') listener();
  };
  scheduleMidnight();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    unsubscribe();
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

// The pool is fetched once per city + language and shared by every island on the page.
const poolCache = new Map<string, Promise<DailyPoolEntry[]>>();

function fetchPool(cityId: string, lang: string): Promise<DailyPoolEntry[]> {
  const url = dailyPoolUrl(cityId, lang);
  let pool = poolCache.get(url);
  if (!pool) {
    pool = fetch(url).then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return ((await res.json()) as DailyPoolFile).tasks;
    });
    // A failed download is not remembered, so the next page view tries again.
    pool.catch(() => poolCache.delete(url));
    poolCache.set(url, pool);
  }
  return pool;
}

/** A task offered today: its text in the page's language and the XP of its tier. */
export type OfferedTask = { id: string; tier: Tier; xp: number; label: string; hint: string };

export type Daily = {
  /** `loading` during server render, hydration and the download of the pool. */
  status: 'loading' | 'ready' | 'error';
  /** Today's tasks, easy first. Empty until `ready`. */
  tasks: OfferedTask[];
  /** How many tasks a day offers according to city.json; known before the pool has loaded. */
  quota: number;
  done: ReadonlySet<string>;
  toggle: (id: string) => void;
  doneCount: number;
  total: number;
};

/**
 * Today's daily tasks for a city and their ticks (DECISIONS.md D16).
 *
 * The site is built statically, so "today" is only known in the browser: the first render (and
 * the server's) has no tasks, then the pool for this language is downloaded and `pickDaily`
 * chooses today's. Same store as before, so Home and Progress stay in sync.
 * TODO: replace with GET /api/cities/:city/daily once the backend exists (API.md).
 */
export function useDaily(city: City, lang: string): Daily {
  const cityId = city.id;
  // null on the server and while hydrating, so the HTML never depends on the date.
  const date = useSyncExternalStore(subscribeDaily, today, () => null);
  const ticked = useSyncExternalStore(subscribeDaily, () => dailySnapshot(cityId), () => EMPTY);
  const [pool, setPool] = useState<DailyPoolEntry[] | 'error' | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPool(cityId, lang)
      .then((tasks) => !cancelled && setPool(tasks))
      .catch((err) => {
        console.warn('Daily tasks failed to load', err);
        if (!cancelled) setPool('error');
      });
    return () => {
      cancelled = true;
    };
  }, [cityId, lang]);

  const { xp: tierXp, perDay } = city.daily;
  const tasks = useMemo<OfferedTask[]>(() => {
    if (!date || !pool || pool === 'error') return [];
    const byId = new Map(pool.map((task) => [task.id, task]));
    return pickDaily(pool, perDay, cityId, date).map(({ id, tier }) => {
      const { label, hint } = byId.get(id)!;
      return { id, tier, xp: tierXp[tier], label, hint };
    });
  }, [pool, date, cityId, tierXp, perDay]);

  const toggle = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const day = today();
      // Only today's offered tasks are kept; anything else in storage is stale.
      const before = new Set(tasks.filter((t) => dailySnapshot(cityId).has(t.id)).map((t) => t.id));
      const next = toggled(before, id);
      const xp = Math.max(0, readDaily(cityId).xp + (before.has(id) ? -task.xp : task.xp));
      dailyCache.set(cityId, { date: day, done: next, xp });
      save(dailyKeyFor(cityId), { date: day, done: [...next], xp });
    },
    [cityId, tasks]
  );

  return useMemo(() => {
    const status = pool === 'error' ? 'error' : date && pool ? 'ready' : 'loading';
    return {
      status,
      tasks,
      quota: perDay.easy + perDay.medium + perDay.hard,
      done: ticked,
      toggle,
      doneCount: tasks.filter((task) => ticked.has(task.id)).length,
      total: tasks.length,
    };
  }, [pool, date, tasks, perDay, ticked, toggle]);
}
