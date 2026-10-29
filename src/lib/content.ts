import {
  getCollection,
  getEntry,
  type CollectionEntry,
  type CollectionKey,
} from 'astro:content';
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
