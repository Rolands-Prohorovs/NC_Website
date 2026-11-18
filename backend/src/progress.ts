import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { pool } from './db.ts';
import { currentUser, fail } from './auth.ts';
import { getCity, todayInHelsinki, type City } from './content.ts';
import { streakOf } from './streak.ts';
// Same level maths as the frontend until API.md Q7 is decided (100 XP per level).
import { levelOf } from '../../src/lib/level.ts';

// To-do list and progress (API.md "To-do list" and "Progress"). The frontend only says
// "done / not done"; XP, level, streak and badge are worked out here (D7).

/** Import accepts at most this many ids: there are 8 tasks, this leaves room for old ones. */
const IMPORT_MAX = 100;

type Params = { city: string; taskId?: string };

/** The logged-in user and the city of the URL, or null after sending 401 / 404. */
async function context(
  request: FastifyRequest<{ Params: Params }>,
  reply: FastifyReply
): Promise<{ userId: string; city: City } | null> {
  const user = await currentUser(request);
  if (!user) {
    fail(reply, 401, 'not_logged_in', 'No valid session');
    return null;
  }
  const city = getCity(request.params.city);
  if (!city) {
    fail(reply, 404, 'unknown_city', `No city "${request.params.city}"`);
    return null;
  }
  return { userId: user.id, city };
}

/** API.md `Progress` for one user in one city, computed from the tables every time. */
async function buildProgress(userId: string, city: City) {
  const [todo, badge, daily, days] = await Promise.all([
    pool.query<{ task_id: string }>(
      'select task_id from todo_done where user_id = $1 and city = $2 and done',
      [userId, city.id]
    ),
    pool.query<{ earned_at: Date }>(
      'select earned_at from todo_badge where user_id = $1 and city = $2',
      [userId, city.id]
    ),
    pool.query<{ xp: number }>(
      'select coalesce(sum(xp), 0)::int as xp from daily_done where user_id = $1 and city = $2',
      [userId, city.id]
    ),
    // Streak days: the Helsinki day of each first to-do tick (imported ticks have none) and
    // every day with a daily task. As text, because pg would turn a date into a local Date.
    pool.query<{ day: string }>(
      `select to_char(first_done_at at time zone 'Europe/Helsinki', 'YYYY-MM-DD') as day
         from todo_done where user_id = $1 and city = $2 and first_done_at is not null
       union
       select to_char(day, 'YYYY-MM-DD') from daily_done where user_id = $1 and city = $2`,
      [userId, city.id]
    ),
  ]);

  // Only tasks that are still in city.json count, in content order.
  const doneIds = new Set(todo.rows.map((row) => row.task_id));
  const done = [...city.todo.keys()].filter((id) => doneIds.has(id));
  const todoXp = done.reduce((sum, id) => sum + city.todo.get(id)!, 0);
  const xp = todoXp + daily.rows[0].xp;

  return {
    city: city.id,
    todo: {
      done,
      total: city.todo.size,
      badge: badge.rows[0] ? { earnedAt: badge.rows[0].earned_at.toISOString() } : null,
    },
    xp,
    level: levelOf(xp).level,
    streak: streakOf(
      days.rows.map((row) => row.day),
      todayInHelsinki()
    ),
  };
}

/** Gives the badge once every to-do task of the city is done. It is never taken away. */
async function awardBadgeIfComplete(userId: string, city: City) {
  const { rows } = await pool.query<{ task_id: string }>(
    'select task_id from todo_done where user_id = $1 and city = $2 and done',
    [userId, city.id]
  );
  const doneIds = new Set(rows.map((row) => row.task_id));
  const complete = city.todo.size > 0 && [...city.todo.keys()].every((id) => doneIds.has(id));
  if (complete) {
    await pool.query(
      'insert into todo_badge (user_id, city) values ($1, $2) on conflict do nothing',
      [userId, city.id]
    );
  }
}

export async function progressRoutes(app: FastifyInstance) {
  app.get<{ Params: Params }>('/api/cities/:city/progress', async (request, reply) => {
    const ctx = await context(request, reply);
    if (!ctx) return reply;
    return buildProgress(ctx.userId, ctx.city);
  });

  // Tick. The first tick ever sets first_done_at (a streak day); ticking again after an
  // un-tick keeps the old date, so un-ticking and re-ticking can't keep a streak alive.
  app.put<{ Params: Params }>('/api/cities/:city/todo/:taskId', async (request, reply) => {
    const ctx = await context(request, reply);
    if (!ctx) return reply;
    const taskId = request.params.taskId!;
    if (!ctx.city.todo.has(taskId)) return fail(reply, 404, 'unknown_task', `No task "${taskId}"`);

    await pool.query(
      `insert into todo_done (user_id, city, task_id, done, first_done_at)
       values ($1, $2, $3, true, now())
       on conflict (user_id, city, task_id) do update set done = true`,
      [ctx.userId, ctx.city.id, taskId]
    );
    await awardBadgeIfComplete(ctx.userId, ctx.city);
    return buildProgress(ctx.userId, ctx.city);
  });

  // Un-tick: the row stays (done = false) so the first tick's date is remembered.
  app.delete<{ Params: Params }>('/api/cities/:city/todo/:taskId', async (request, reply) => {
    const ctx = await context(request, reply);
    if (!ctx) return reply;
    const taskId = request.params.taskId!;
    if (!ctx.city.todo.has(taskId)) return fail(reply, 404, 'unknown_task', `No task "${taskId}"`);

    await pool.query(
      'update todo_done set done = false where user_id = $1 and city = $2 and task_id = $3',
      [ctx.userId, ctx.city.id, taskId]
    );
    return buildProgress(ctx.userId, ctx.city);
  });

  // The device's ticks after logging in (the frontend sends them after every login).
  // A union: nothing is un-ticked. Ids that are no longer in city.json (old or renamed
  // tasks still on the device) are skipped, so an old device doesn't make every login fail.
  // Imported ticks have no first_done_at: we don't know when they happened, so no streak day.
  app.post<{ Params: Params }>('/api/cities/:city/todo/import', async (request, reply) => {
    const ctx = await context(request, reply);
    if (!ctx) return reply;

    const body = request.body as { done?: unknown } | null | undefined;
    const list = body && typeof body === 'object' ? body.done : undefined;
    if (!Array.isArray(list) || !list.every((id) => typeof id === 'string')) {
      return fail(reply, 400, 'invalid_request', '"done" must be a list of task ids');
    }
    if (list.length > IMPORT_MAX) {
      return fail(reply, 400, 'invalid_request', `At most ${IMPORT_MAX} task ids`);
    }

    const known = [...new Set(list as string[])].filter((id) => ctx.city.todo.has(id));
    if (known.length > 0) {
      await pool.query(
        `insert into todo_done (user_id, city, task_id, done, first_done_at)
         select $1, $2, task_id, true, null from unnest($3::text[]) as task_id
         on conflict (user_id, city, task_id) do update set done = true`,
        [ctx.userId, ctx.city.id, known]
      );
      await awardBadgeIfComplete(ctx.userId, ctx.city);
    }
    return buildProgress(ctx.userId, ctx.city);
  });
}
