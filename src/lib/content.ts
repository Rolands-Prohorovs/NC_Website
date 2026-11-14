import {
  getCollection,
  getEntry,
  type CollectionEntry,
  type CollectionKey,
} from 'astro:content';
import type { DailyPoolFile } from './daily';
import { INFO_PAGES, isInfoPage, type AuthPageId, type InfoPageId, type Locale } from './pages';
import type { AuthPageCopy, City, CityLink } from './schema';

export async function getCities(): Promise<City[]> {
  const entries = await getCollection('cities');
  return entries.map((e) => ({ id: e.id, ...e.data }));
}

export async function getCityLinks(): Promise<CityLink[]> {
  return (await getCities()).map(({ id, name }) => ({ id, name }));
}

/** Loads one content file, failing the build with the expected path if it is missing. */
export async function load<C extends CollectionKey>(
  collection: C,
  id: string
): Promise<CollectionEntry<C>['data']> {
  const entry = await getEntry(collection, id);
  if (!entry) {
    const name: Record<string, string> = { dailyPool: 'daily', dailyCopy: 'daily' };
    const file = collection === 'info' ? `${id}.json` : `${id}/${name[collection] ?? collection}.json`;
    throw new Error(`Missing content file: src/content/${file}`);
  }
  return entry.data;
}

/** Loads an info page and checks that its links to topics on other pages point at real topic ids. */
export async function loadInfo(loc: Locale, page: InfoPageId) {
  const key = `${loc.city}/${loc.lang}`;
  const copy = await load('info', `${key}/${page}`);
  const file = `src/content/${key}/${page}.json`;
  const links = copy.sections
    .flatMap((s) => s.topics)
    .flatMap((t) => [t, ...(t.sections ?? [])])
    .flatMap((c) => c.links ?? []);
  for (const l of links) {
    if (!('page' in l) || !l.topic) continue;
    if (!isInfoPage(l.page)) throw new Error(`${file}: "${l.label}" links to a topic on ${l.page}, which has no topics`);
    const target = l.page === page ? copy : await load('info', `${key}/${l.page}`);
    if (!target.sections.some((s) => s.topics.some((t) => t.id === l.topic)))
      throw new Error(`${file}: "${l.label}" links to topic "${l.topic}", but ${l.page}.json has no topic with that id`);
  }
  return copy;
}

/** Checks that progress.json has copy for every task and group in city.json. */
export async function loadProgress(city: City, lang: string) {
  const copy = await load('progress', `${city.id}/${lang}`);
  const file = `src/content/${city.id}/${lang}/progress.json`;
  for (const task of city.tasks) {
    if (!copy.tasks[task.id]) throw new Error(`${file}: no text for task "${task.id}"`);
    if (!copy.groups[task.group]) throw new Error(`${file}: no group "${task.group}"`);
  }
  return copy;
}

/**
 * The city's pool of daily tasks with the texts of one language, as served to the browser by
 * src/pages/data/[city]/[lang]/daily.json.ts. Fails the build if a task of the pool has no
 * text in ANY of the city's languages, or if a language has text for a task that isn't in the
 * pool (a typo'd or forgotten id).
 */
export async function loadDailyPool(city: City, lang: string): Promise<DailyPoolFile> {
  const pool = (await load('dailyPool', city.id)).tasks;
  const ids = new Set(pool.map((task) => task.id));
  for (const l of city.languages) {
    const texts = await load('dailyCopy', `${city.id}/${l}`);
    const file = `src/content/${city.id}/${l}/daily.json`;
    for (const { id } of pool) {
      if (!texts[id]?.label) throw new Error(`${file}: no text for daily task "${id}"`);
    }
    for (const id of Object.keys(texts)) {
      if (!ids.has(id))
        throw new Error(`${file}: text for "${id}", which is not in src/content/${city.id}/daily.json`);
    }
  }
  const texts = await load('dailyCopy', `${city.id}/${lang}`);
  return { tasks: pool.map((task) => ({ ...task, ...texts[task.id] })) };
}

/** Loads auth.json and keeps only what one page (login or register) needs. */
export async function loadAuth(loc: Locale, page: AuthPageId): Promise<AuthPageCopy> {
  const { login, register, ...shared } = await load('auth', `${loc.city}/${loc.lang}`);
  return { ...shared, page: page === 'login' ? login : register };
}

// ---------- Language parity ----------
// Every language of a city must have the same content structure as the default (first)
// language: the same sections, topic ids, tasks, fields and list lengths. Only the text may
// differ. Without this a translation silently falls behind when the default language changes.

/** Keys that are ids or wiring, not text: their values must be identical in every language. */
const SAME_VALUE = new Set(['id', 'page', 'topic', 'hash', 'icon', 'tone']);

const kind = (v: unknown) => (Array.isArray(v) ? 'list' : v === null ? 'null' : typeof v);
const idOf = (v: unknown) =>
  v && typeof v === 'object' && 'id' in v && typeof v.id === 'string' ? v.id : undefined;

/** Lists where `other` differs in shape from `base`, as "path: what is wrong". */
function shapeDiff(base: unknown, other: unknown, path: string, langs: [string, string], out: string[]) {
  const [baseLang, lang] = langs;
  if (kind(base) !== kind(other)) {
    out.push(`${path}: is a ${kind(other)} in ${lang} but a ${kind(base)} in ${baseLang}`);
  } else if (Array.isArray(base) && Array.isArray(other)) {
    if (base.length !== other.length) {
      const ids = (list: unknown[]) => list.map(idOf).filter((id) => id !== undefined);
      const missing = ids(base).filter((id) => !ids(other).includes(id));
      const extra = ids(other).filter((id) => !ids(base).includes(id));
      const detail = [
        missing.length ? `${lang} lacks ${missing.map((id) => `"${id}"`).join(', ')}` : '',
        extra.length ? `only ${lang} has ${extra.map((id) => `"${id}"`).join(', ')}` : '',
      ].filter(Boolean);
      out.push(
        `${path}: ${other.length} item(s) in ${lang}, ${base.length} in ${baseLang}` +
          (detail.length ? ` (${detail.join('; ')})` : '')
      );
    }
    base.slice(0, other.length).forEach((item, i) => {
      const label = idOf(item) ? `${path}[${i} "${idOf(item)}"]` : `${path}[${i}]`;
      shapeDiff(item, other[i], label, langs, out);
    });
  } else if (base && other && typeof base === 'object' && typeof other === 'object') {
    const a = base as Record<string, unknown>;
    const b = other as Record<string, unknown>;
    for (const key of Object.keys(a)) {
      const here = path ? `${path}.${key}` : key;
      if (!(key in b)) out.push(`${here}: missing in ${lang} (${baseLang} has it)`);
      else if (SAME_VALUE.has(key) && typeof a[key] === 'string' && a[key] !== b[key])
        out.push(`${here}: "${String(b[key])}" in ${lang} but "${a[key]}" in ${baseLang}`);
      else shapeDiff(a[key], b[key], here, langs, out);
    }
    for (const key of Object.keys(b)) {
      if (!(key in a)) out.push(`${path ? `${path}.${key}` : key}: only in ${lang} (${baseLang} has no such field)`);
    }
  }
}

const parityChecked = new Map<string, Promise<void>>();

/**
 * Fails the build if any language of the city has a different content structure than the
 * default language, in any content file. Called from every page; runs once per city per build.
 */
export function checkParity(city: City): Promise<void> {
  // In dev, check on every request so an edit shows up without restarting the server.
  const cached = import.meta.env.PROD ? parityChecked.get(city.id) : undefined;
  if (cached) return cached;

  const run = (async () => {
    const [baseLang, ...others] = city.languages;
    const files: { collection: CollectionKey; name: string }[] = [
      { collection: 'site', name: 'site' },
      { collection: 'home', name: 'home' },
      { collection: 'progress', name: 'progress' },
      { collection: 'auth', name: 'auth' },
      { collection: 'dailyCopy', name: 'daily' },
      ...INFO_PAGES.map((page) => ({ collection: 'info' as const, name: page })),
    ];
    const problems: string[] = [];
    for (const { collection, name } of files) {
      const idFor = (lang: string) =>
        collection === 'info' ? `${city.id}/${lang}/${name}` : `${city.id}/${lang}`;
      const base = await load(collection, idFor(baseLang));
      for (const lang of others) {
        const found: string[] = [];
        shapeDiff(base, await load(collection, idFor(lang)), '', [baseLang, lang], found);
        const file = `src/content/${city.id}/${lang}/${name}.json`;
        problems.push(...found.map((problem) => `${file}: ${problem}`));
      }
    }
    if (problems.length) {
      const shown = problems.slice(0, 25);
      const more = problems.length > shown.length ? `\n  ...and ${problems.length - shown.length} more` : '';
      throw new Error(
        `Languages are out of sync with "${baseLang}" (${problems.length} problem(s)):\n  ${shown.join('\n  ')}${more}`
      );
    }
  })();
  parityChecked.set(city.id, run);
  return run;
}
