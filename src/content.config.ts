import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import {
  citySchema,
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
