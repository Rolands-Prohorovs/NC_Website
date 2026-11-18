import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// The same pure algorithm the frontend runs today (API.md "Daily offer algorithm"), imported
// rather than copied so the two can't drift apart.
import { TIERS, pickDaily, type DailyDef, type DailyQuota, type Tier } from '../../src/lib/daily.ts';

// Task definitions are content, not database rows (API.md Q5): src/content/<city>/city.json
// holds the to-do tasks and the daily tiers, daily.json the daily pool. The backend reads only
// ids, tiers and XP; it never needs the texts. The frontend build checks these files fully
// (src/lib/schema.ts); here we check just what the backend relies on, and refuse to start if
// something is wrong instead of running with half the tasks.

export type City = {
  id: string;
  /** To-do task id -> XP, in content order. */
  todo: Map<string, number>;
  /** XP of a daily task of each tier. */
  dailyXp: Record<Tier, number>;
  /** How many tasks of each tier are offered per day. */
  perDay: DailyQuota;
  /** The daily pool, id -> definition. */
  pool: Map<string, DailyDef>;
};

/** A task of today's offer, as API.md `Daily.offered` shows it. */
export type OfferedTask = DailyDef & { xp: number };

const DEFAULT_DIR = fileURLToPath(new URL('../../src/content/', import.meta.url));
const ID_RE = /^[a-z0-9-]+$/;

let cities = new Map<string, City>();

/** Loads every city once at startup. CONTENT_DIR overrides where the content folder is. */
export async function initContent(dir = process.env.CONTENT_DIR ?? DEFAULT_DIR): Promise<void> {
  cities = await loadCities(dir);
}

export function getCity(id: string): City | undefined {
  return cities.get(id);
}

/** Reads all cities from a content folder: one subfolder per city, named by its id. */
export async function loadCities(dir: string): Promise<Map<string, City>> {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = new Map<string, City>();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const city = await loadCity(path.join(dir, entry.name), entry.name);
    result.set(city.id, city);
  }
  if (result.size === 0) throw new Error(`${dir}: no city folders found`);
  return result;
}

async function loadCity(dir: string, id: string): Promise<City> {
  if (!ID_RE.test(id)) throw new Error(`${dir}: city folder name must be a-z 0-9 -`);
  const cityFile = path.join(dir, 'city.json');
  const dailyFile = path.join(dir, 'daily.json');
  const cityJson = await readJson(cityFile);
  const dailyJson = await readJson(dailyFile);

  // city.json: to-do tasks
  const todo = new Map<string, number>();
  const tasks = field(cityJson, 'tasks', cityFile);
  if (!Array.isArray(tasks)) throw new Error(`${cityFile}: "tasks" must be a list`);
  for (const task of tasks) {
    const taskId = field(task, 'id', cityFile);
    if (typeof taskId !== 'string' || !ID_RE.test(taskId)) {
      throw new Error(`${cityFile}: to-do task id ${JSON.stringify(taskId)} must be a-z 0-9 -`);
    }
    if (todo.has(taskId)) throw new Error(`${cityFile}: to-do task "${taskId}" appears twice`);
    todo.set(taskId, wholeNumber(field(task, 'xp', cityFile), `${cityFile}: xp of "${taskId}"`));
  }

  // city.json: daily tiers
  const daily = field(cityJson, 'daily', cityFile);
  const xp = field(daily, 'xp', cityFile);
  const perDay = field(daily, 'perDay', cityFile);
  const dailyXp = {} as Record<Tier, number>;
  const quota = {} as DailyQuota;
  for (const tier of TIERS) {
    dailyXp[tier] = wholeNumber(field(xp, tier, cityFile), `${cityFile}: daily.xp.${tier}`);
    quota[tier] = wholeNumber(field(perDay, tier, cityFile), `${cityFile}: daily.perDay.${tier}`);
  }

  // daily.json: the pool
  const pool = new Map<string, DailyDef>();
  const poolTasks = field(dailyJson, 'tasks', dailyFile);
  if (!Array.isArray(poolTasks)) throw new Error(`${dailyFile}: "tasks" must be a list`);
  for (const task of poolTasks) {
    const taskId = field(task, 'id', dailyFile);
    const tier = field(task, 'tier', dailyFile);
    if (typeof taskId !== 'string' || !ID_RE.test(taskId)) {
      throw new Error(`${dailyFile}: daily task id ${JSON.stringify(taskId)} must be a-z 0-9 -`);
    }
    if (!TIERS.includes(tier as Tier)) {
      throw new Error(`${dailyFile}: tier of "${taskId}" must be one of ${TIERS.join(', ')}`);
    }
    if (pool.has(taskId)) throw new Error(`${dailyFile}: daily task "${taskId}" appears twice`);
    pool.set(taskId, { id: taskId, tier: tier as Tier });
  }

  return { id, todo, dailyXp, perDay: quota, pool };
}

/** The tasks offered in a city on a calendar day ("YYYY-MM-DD"), with their XP. */
export function dailyOffer(city: City, day: string): OfferedTask[] {
  return pickDaily([...city.pool.values()], city.perDay, city.id, day).map((task) => ({
    ...task,
    xp: city.dailyXp[task.tier],
  }));
}

const helsinkiDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Helsinki',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The calendar day in Finland ("YYYY-MM-DD"): streaks and daily offers use Helsinki time. */
export function todayInHelsinki(now = new Date()): string {
  const parts = Object.fromEntries(helsinkiDate.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function readJson(file: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    throw new Error(`${file}: file is missing`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${file}: not valid JSON (${(err as Error).message})`);
  }
}

/** obj[key], or an error naming the file if obj isn't an object or the key is missing. */
function field(obj: unknown, key: string, file: string): unknown {
  if (typeof obj !== 'object' || obj === null || !(key in obj)) {
    throw new Error(`${file}: "${key}" is missing`);
  }
  return (obj as Record<string, unknown>)[key];
}

/** XP and per-day counts are whole numbers >= 0 (the database stores XP as an integer). */
function wholeNumber(value: unknown, where: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${where} must be a whole number >= 0, got ${JSON.stringify(value)}`);
  }
  return value as number;
}
