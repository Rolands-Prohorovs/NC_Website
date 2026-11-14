/**
 * Shape of every content file in src/content/. Objects are strict, so a typo'd or
 * misplaced key fails the build with the file and field name instead of silently
 * disappearing. Types for components are inferred from these schemas.
 */
import { z } from 'astro/zod';
import { TIERS } from './daily';
import { PAGES } from './pages';

const link = z.strictObject({ label: z.string(), url: z.url() });
// A link to another page of the same city and language, optionally to one topic on it (its `id`).
const pageLink = z.strictObject({
  label: z.string(),
  page: z.enum(PAGES),
  topic: z.string().optional(),
});

const tierNumbers = {
  easy: z.number().int().min(0),
  medium: z.number().int().min(0),
  hard: z.number().int().min(0),
};

// src/content/<city>/city.json
export const citySchema = z.strictObject({
  name: z.string(),
  // The Rotary club's own website; the header logo links to it.
  clubUrl: z.url(),
  languages: z.array(z.string()).min(1),
  stats: z.strictObject({ xp: z.number(), checklistDays: z.number() }),
  // To-do list: only things nearly every newcomer has to do (DECISIONS.md D15). Done once.
  tasks: z.array(z.strictObject({ id: z.string(), group: z.string(), xp: z.number() })),
  // Daily tasks (DECISIONS.md D16): the XP of each tier, and how many tasks of each tier are
  // offered per day. The pool itself is in daily.json; a quota of 0 switches a tier off.
  daily: z.strictObject({
    xp: z.strictObject(tierNumbers),
    perDay: z.strictObject(tierNumbers),
  }),
});

// src/content/<city>/daily.json — the pool of daily tasks: id + tier only. Texts are per
// language in <lang>/daily.json. Written by scripts/import-daily.mjs, or by hand.
export const dailyPoolSchema = z
  .strictObject({
    tasks: z.array(
      z.strictObject({ id: z.string().regex(/^[a-z0-9-]+$/), tier: z.enum(TIERS) })
    ),
  })
  .refine((p) => new Set(p.tasks.map((t) => t.id)).size === p.tasks.length, {
    message: 'daily task ids must be unique',
  });

// src/content/<city>/<lang>/site.json — strings used on every page
export const siteSchema = z.strictObject({
  club: z.string(),
  // Accessible name of the header logo link: says where it goes and that it opens a new tab.
  clubLink: z.string(),
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
    // `streakDays` takes {n}; `streakStart` is shown instead while the streak is 0.
    streakDays: z.string(),
    streakStart: z.string(),
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
  // Daily tasks section; `done` is the counter, e.g. "{done}/{total} today". `loading` and
  // `error` show while today's tasks are fetched after the page has loaded.
  daily: z.strictObject({
    title: z.string(),
    desc: z.string(),
    done: z.string(),
    loading: z.string(),
    error: z.string(),
  }),
  // Heading of the to-do list, above the groups.
  todo: z.strictObject({ title: z.string(), desc: z.string() }),
  // Group order here is the order shown on the page.
  groups: z.record(z.string(), z.strictObject({ title: z.string(), desc: z.string() })),
  tasks: z.record(z.string(), taskCopy),
  // League table. `rank` takes {n} (screen readers); the login line shows when logged out.
  league: z.strictObject({
    title: z.string(),
    desc: z.string(),
    you: z.string(),
    rank: z.string(),
    loginPrompt: z.string(),
    loginCta: z.string(),
    empty: z.string(),
  }),
});

// src/content/<city>/<lang>/daily.json — text of every daily task in the pool, keyed by id
export const dailyCopySchema = z.record(z.string(), taskCopy);

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
  .refine((t) => !t.summary || t.source, { message: 'a topic with a summary needs a source' })
  // No empty placeholders: a topic that isn't written yet stays out of the file.
  .refine((t) => t.summary || t.body || t.sections?.length, {
    message: 'a topic needs a summary, body or sections',
  });

// src/content/<city>/<lang>/{students,living,meet}.json
export const infoSchema = z.strictObject({
  title: z.string(),
  subtitle: z.string(),
  sections: z.array(
    z.strictObject({
      id: z.string(),
      title: z.string(),
      intro: z.string().optional(),
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
