import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import {
  authSchema,
  citySchema,
  dailyCopySchema,
  dailyPoolSchema,
  homeSchema,
  infoSchema,
  progressSchema,
  siteSchema,
} from './lib/schema';

const base = './src/content';

/** "lahti/en/home.json" -> "lahti/en" (one file of this kind per city + language). */
const cityLang = ({ entry }: { entry: string }) => entry.split('/').slice(0, 2).join('/');

export const collections = {
  // id: "lahti"
  cities: defineCollection({
    loader: glob({ base, pattern: '*/city.json', generateId: ({ entry }) => entry.split('/')[0] }),
    schema: citySchema,
  }),
  // id: "lahti" — the pool of daily tasks (ids + tiers)
  dailyPool: defineCollection({
    loader: glob({ base, pattern: '*/daily.json', generateId: ({ entry }) => entry.split('/')[0] }),
    schema: dailyPoolSchema,
  }),
  // id: "lahti/en"
  site: defineCollection({
    loader: glob({ base, pattern: '*/*/site.json', generateId: cityLang }),
    schema: siteSchema,
  }),
  home: defineCollection({
    loader: glob({ base, pattern: '*/*/home.json', generateId: cityLang }),
    schema: homeSchema,
  }),
  progress: defineCollection({
    loader: glob({ base, pattern: '*/*/progress.json', generateId: cityLang }),
    schema: progressSchema,
  }),
  dailyCopy: defineCollection({
    loader: glob({ base, pattern: '*/*/daily.json', generateId: cityLang }),
    schema: dailyCopySchema,
  }),
  auth: defineCollection({
    loader: glob({ base, pattern: '*/*/auth.json', generateId: cityLang }),
    schema: authSchema,
  }),
  // id: "lahti/en/living"
  info: defineCollection({
    loader: glob({
      base,
      pattern: '*/*/{students,living,meet}.json',
      generateId: ({ entry }) => entry.replace(/\.json$/, ''),
    }),
    schema: infoSchema,
  }),
};
