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
  // To-do list: done once. `mandatory` = legally or practically required for a newcomer.
  tasks: z.array(
    z.strictObject({ id: z.string(), group: z.string(), xp: z.number(), mandatory: z.boolean() })
  ),
  // Small repeatable tasks whose ticks reset every day at local midnight. May be empty.
  dailyTasks: z.array(z.strictObject({ id: z.string() })),
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
    // Account control in the header. `loggedInAs` takes {nickname}.
    account: z.strictObject({
      login: z.string(),
      register: z.string(),
      logout: z.string(),
      menu: z.string(),
      loggedInAs: z.string(),
    }),
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

const taskCopy = z.strictObject({ label: z.string(), hint: z.string() });

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
  // "{done} of {total} mandatory done"
  mandatoryDone: z.string(),
  previewNote: z.string(),
  // Daily tasks section; `done` is the counter, e.g. "{done}/{total} today".
  daily: z.strictObject({ title: z.string(), desc: z.string(), done: z.string() }),
  dailyTasks: z.record(z.string(), taskCopy),
  // Heading of the to-do list, above the groups.
  todo: z.strictObject({ title: z.string(), desc: z.string() }),
  // Badge text on mandatory to-do tasks.
  mandatory: z.string(),
  // Group order here is the order shown on the page.
  groups: z.record(z.string(), z.strictObject({ title: z.string(), desc: z.string() })),
  tasks: z.record(z.string(), taskCopy),
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

const authPage = z.strictObject({
  title: z.string(),
  subtitle: z.string(),
  submit: z.string(),
  // Button text while the request is in flight.
  busy: z.string(),
  // "No account yet?" + link to the other form.
  switchPrompt: z.string(),
  switchLink: z.string(),
});

// src/content/<city>/<lang>/auth.json — login and register pages (one island each)
export const authSchema = z.strictObject({
  nickname: z.string(),
  password: z.string(),
  // Rules shown under the fields on the register page only.
  nicknameHint: z.string(),
  passwordHint: z.string(),
  showPassword: z.string(),
  hidePassword: z.string(),
  // Shown instead of the form when already logged in; {nickname}.
  loggedIn: z.string(),
  continue: z.string(),
  errors: z.strictObject({
    // Stable API codes (API.md "Accounts"), plus `network` when there is no answer.
    nickname_taken: z.string(),
    invalid_nickname: z.string(),
    weak_password: z.string(),
    wrong_credentials: z.string(),
    too_many_attempts: z.string(),
    not_logged_in: z.string(),
    network: z.string(),
    // Client-side checks only.
    nicknameRequired: z.string(),
    passwordRequired: z.string(),
    passwordTooLong: z.string(),
  }),
  // Forgotten password (DECISIONS.md D-open-5, undecided): one line on the login page.
  login: authPage.extend({ forgot: z.string() }),
  register: authPage,
});

export type CityData = z.infer<typeof citySchema>;
export type City = CityData & { id: string };
export type CityLink = { id: string; name: string };
export type Task = CityData['tasks'][number];
export type DailyTask = CityData['dailyTasks'][number];
export type SiteCopy = z.infer<typeof siteSchema>;
export type HomeCopy = z.infer<typeof homeSchema>;
export type ProgressCopy = z.infer<typeof progressSchema>;
export type InfoCopy = z.infer<typeof infoSchema>;
export type AuthCopy = z.infer<typeof authSchema>;
/** What one auth page island gets: the shared strings plus its own page's. */
export type AuthPageCopy = Omit<AuthCopy, 'login' | 'register'> & {
  page: AuthCopy['register'] & { forgot?: string };
};
export type TopicLink = z.infer<typeof link> | z.infer<typeof pageLink>;
export type ShortContent = z.infer<z.ZodObject<typeof short>>;
