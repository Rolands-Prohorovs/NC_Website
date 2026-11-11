import {
  getCollection,
  getEntry,
  type CollectionEntry,
  type CollectionKey,
} from 'astro:content';
import { isInfoPage, type InfoPageId, type Locale } from './pages';
import type { City, CityLink } from './schema';

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
    const file = collection === 'info' ? `${id}.json` : `${id}/${collection}.json`;
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

/** Checks that progress.json has copy for every task, daily task and group in city.json. */
export async function loadProgress(city: City, lang: string) {
  const copy = await load('progress', `${city.id}/${lang}`);
  const file = `src/content/${city.id}/${lang}/progress.json`;
  for (const task of city.tasks) {
    if (!copy.tasks[task.id]) throw new Error(`${file}: no text for task "${task.id}"`);
    if (!copy.groups[task.group]) throw new Error(`${file}: no group "${task.group}"`);
  }
  for (const task of city.dailyTasks) {
    if (!copy.dailyTasks[task.id]) throw new Error(`${file}: no text for daily task "${task.id}"`);
  }
  return copy;
}
