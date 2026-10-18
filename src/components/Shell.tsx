import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Header from './Header';
import type { City, CityLink, Copy, PageId } from './types';

export type Progress = {
  done: Set<string>;
  toggle: (id: string) => void;
  xp: number;
  doneCount: number;
  total: number;
};

type Site = {
  city: City;
  cities: CityLink[];
  current: PageId;
  lang: string;
  setLang: (lang: string) => void;
  t: Copy;
  progress: Progress;
};

const SiteContext = createContext<Site | null>(null);

export function useSite(): Site {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error('useSite must be used inside <Shell>');
  return ctx;
}

export const fmt = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));

export default function Shell({
  city,
  cities,
  current,
  children,
}: {
  city: City;
  cities: CityLink[];
  current: PageId;
  children: ReactNode;
}) {
  const [lang, setLang] = useState(city.languages[0]);
  const [langReady, setLangReady] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());

  // Language: load saved choice once, then persist changes.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lang');
      if (saved && city.languages.includes(saved)) setLang(saved);
    } catch {
      /* storage unavailable */
    }
    setLangReady(true);
  }, [city]);

  useEffect(() => {
    document.documentElement.lang = lang;
    if (!langReady) return;
    try {
      localStorage.setItem('lang', lang);
    } catch {
      /* storage unavailable */
    }
  }, [lang, langReady]);

  // Checklist: stored on this device for now.
  // TODO: replace with API calls once the backend (PostgreSQL) exists.
  const storageKey = `progress:${city.id}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setDone(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const toggle = useCallback(
    (id: string) => {
      setDone((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          localStorage.setItem(storageKey, JSON.stringify([...next]));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [storageKey]
  );

  const progress = useMemo<Progress>(() => {
    const known = city.tasks.filter((task) => done.has(task.id));
    return {
      done,
      toggle,
      xp: city.stats.xp + known.reduce((sum, task) => sum + task.xp, 0),
      doneCount: known.length,
      total: city.tasks.length,
    };
  }, [done, toggle, city]);

  const value: Site = {
    city,
    cities,
    current,
    lang,
    setLang,
    t: city.content[lang],
    progress,
  };

  return (
    <SiteContext.Provider value={value}>
      <Header />
      {children}
      <footer className="foot">
        <div className="inner">{value.t.club}</div>
      </footer>
    </SiteContext.Provider>
  );
}
