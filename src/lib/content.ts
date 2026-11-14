import {
  getCollection,
  getEntry,
  type CollectionEntry,
  type CollectionKey,
} from 'astro:content';
import type { DailyPoolFile } from './daily';
import { isInfoPage, type AuthPageId, type InfoPageId, type Locale } from './pages';
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
