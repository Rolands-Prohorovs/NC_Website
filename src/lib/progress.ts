import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { Task } from './schema';

// Checklist progress, stored on this device for now.
// TODO: replace with API calls once the backend (PostgreSQL) exists.
//
// State lives in this module rather than in a component, so every island on the
// page (header pills, home checklist, progress page) sees the same ticks.

const EMPTY: ReadonlySet<string> = new Set();
const cache = new Map<string, ReadonlySet<string>>();
const listeners = new Set<() => void>();

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

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type Progress = {
  done: ReadonlySet<string>;
  toggle: (id: string) => void;
  xp: number;
  doneCount: number;
  total: number;
};

export function useProgress(cityId: string, tasks: Task[], baseXp: number): Progress {
  // Server render and hydration use EMPTY; the saved ticks appear right after.
  const done = useSyncExternalStore(subscribe, () => read(cityId), () => EMPTY);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(read(cityId));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      cache.set(cityId, next);
      try {
        localStorage.setItem(keyFor(cityId), JSON.stringify([...next]));
      } catch {
        /* storage unavailable */
      }
      listeners.forEach((l) => l());
    },
    [cityId]
  );

  return useMemo(() => {
    const known = tasks.filter((task) => done.has(task.id));
    return {
      done,
      toggle,
      xp: baseXp + known.reduce((sum, task) => sum + task.xp, 0),
      doneCount: known.length,
      total: tasks.length,
    };
  }, [done, toggle, tasks, baseXp]);
}
