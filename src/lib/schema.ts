/**
 * Shape of every content file in src/content/. Objects are strict, so a typo'd or
 * misplaced key fails the build with the file and field name instead of silently
 * disappearing. Types for components are inferred from these schemas.
 */
import { z } from 'astro/zod';
import { PAGES } from './pages';

const link = z.strictObject({ label: z.string(), url: z.url() });
// A link to another page of the same city and language, optionally to one topic on it (its `id`).
const pageLink = z.strictObject({
  label: z.string(),
  page: z.enum(PAGES),
  topic: z.string().optional(),
});

// src/content/<city>/city.json
export const citySchema = z.strictObject({
  name: z.string(),
  languages: z.array(z.string()).min(1),
  stats: z.strictObject({ xp: z.number(), streak: z.number(), checklistDays: z.number() }),
  tasks: z.array(z.strictObject({ id: z.string(), group: z.string(), xp: z.number() })),
});

// src/content/<city>/<lang>/site.json — strings used on every page
export const siteSchema = z.strictObject({
  club: z.string(),
  xp: z.string(),
  ui: z.strictObject({
    nav: z.strictObject({
      home: z.string(),
      progress: z.string(),
      students: z.string(),
      living: z.string(),
      meet: z.string(),
    }),
    openMenu: z.string(),
    closeMenu: z.string(),
    language: z.string(),
    city: z.string(),
    streakDays: z.string(),
    comingSoon: z.string(),
    comingSoonHint: z.string(),
    jumpTo: z.string(),
    sources: z.string(),
    officialSource: z.string(),
    checked: z.string(),
    need: z.string(),
    cost: z.string(),
    time: z.string(),
  }),
});

const start = z.strictObject({
  title: z.string(),
  desc: z.string(),
  cta: z.string(),
  page: z.enum(PAGES),
  hash: z.string().optional(),
});

const card = z.strictObject({ title: z.string(), desc: z.string(), icon: z.string(), tone: z.string() });

// src/content/<city>/<lang>/home.json
export const homeSchema = z.strictObject({
  welcome: z.string(),
  tagline: z.string(),
  subtitle: z.string(),
  checklistTitle: z.string(),
  checklistHint: z.string(),
  aboutTitle: z.string(),
  about: z.string(),
  whereTitle: z.string(),
  whereHint: z.string(),
  stages: z.array(
    z.strictObject({ id: z.string(), icon: z.string(), title: z.string(), desc: z.string() })
  ),
  startTitle: z.string(),
  // Keyed by stage id; "none" is shown before a stage is picked.
  starts: z
    .record(z.string(), start)
    .refine((s) => 'none' in s, { message: 'starts needs a "none" entry' }),
  exploreTitle: z.string(),
  pages: z.strictObject({
    progress: card,
    students: card,
    living: card,
    meet: card,
  }),
});

// src/content/<city>/<lang>/progress.json
export const progressSchema = z.strictObject({
  title: z.string(),
  subtitle: z.string(),
  xpLabel: z.string(),
  level: z.string(),
  toNext: z.string(),
  streakLabel: z.string(),
  streakHint: z.string(),
  tasksLabel: z.string(),
  tasksDone: z.string(),
  previewNote: z.string(),
  // Group order here is the order shown on the page.
  groups: z.record(z.string(), z.strictObject({ title: z.string(), desc: z.string() })),
  tasks: z.record(z.string(), z.strictObject({ label: z.string(), hint: z.string() })),
});

// Short format (ROADMAP.md "Content format"): the answer in one sentence, then a few
// numbered steps or bulleted facts, plus optional chips. Shared by topics and sub-sections.
const short = {
  summary: z.string().optional(),
  steps: z.array(z.string()).min(1).max(5).optional(),
  facts: z.array(z.string()).min(1).max(5).optional(),
  need: z.array(z.string()).optional(),
  cost: z.string().optional(),
  time: z.string().optional(),
  // Longer text, only where it really helps. Blank lines ("\n\n") split it into paragraphs.
  body: z.string().optional(),
  links: z.array(z.union([link, pageLink])).optional(),
};

const notStepsAndFacts = (t: { steps?: unknown; facts?: unknown }) => !(t.steps && t.facts);
const stepsOrFacts = { message: 'use steps or facts, not both' };

const topicSection = z
  .strictObject({ label: z.string(), ...short })
  .refine(notStepsAndFacts, stepsOrFacts)
  .refine((s) => s.summary || s.body, { message: 'a sub-section needs a summary or body' });

const topic = z
  .strictObject({
    // Anchor for links from other pages ({ page, topic }); lowercase letters, digits and dashes.
    id: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    label: z.string(),
    ...short,
    sections: z.array(topicSection).optional(),
    // Official page the facts come from, and the day they were last confirmed there.
    source: link.optional(),
    checked: z.iso.date().optional(),
  })
  .refine(notStepsAndFacts, stepsOrFacts)
  .refine((t) => !t.source === !t.checked, { message: 'source and checked go together' })
  // Every short-format topic needs an official source (DECISIONS.md D10).
  .refine((t) => !t.summary || t.source, { message: 'a topic with a summary needs a source' });

// src/content/<city>/<lang>/{students,living,meet}.json
export const infoSchema = z.strictObject({
  title: z.string(),
  subtitle: z.string(),
  sections: z.array(
    z.strictObject({
      id: z.string(),
      title: z.string(),
      intro: z.string().optional(),
      // A topic with no summary, body or sections shows a "coming soon" placeholder.
      topics: z.array(topic),
    })
  ),
  sources: z.array(link).optional(),
});

export type CityData = z.infer<typeof citySchema>;
export type City = CityData & { id: string };
export type CityLink = { id: string; name: string };
export type Task = CityData['tasks'][number];
export type SiteCopy = z.infer<typeof siteSchema>;
export type HomeCopy = z.infer<typeof homeSchema>;
export type ProgressCopy = z.infer<typeof progressSchema>;
export type InfoCopy = z.infer<typeof infoSchema>;
export type TopicLink = z.infer<typeof link> | z.infer<typeof pageLink>;
export type ShortContent = z.infer<z.ZodObject<typeof short>>;
