import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { pool } from './db.ts';

// Rules from API.md "Accounts". The frontend checks the same ones, but only for convenience:
// the server is the one that decides.
const NICKNAME_RE = /^[A-Za-z0-9_-]{3,20}$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72; // bcrypt ignores everything after 72 bytes

const SESSION_COOKIE = 'session';
const SESSION_DAYS = 30;

type UserRow = { id: string; nickname: string; created_at: Date };

// What the frontend is allowed to see (API.md "User"). Never the id or the password hash.
const publicUser = (user: UserRow) => ({
  nickname: user.nickname,
  createdAt: user.created_at.toISOString(),
});

// Every error has the same shape: { error: { code, message } } (API.md "Basics").
const fail = (reply: FastifyReply, status: number, code: string, message: string) =>
  reply.code(status).send({ error: { code, message } });

// Only a hash of the session token is stored, so a leaked database can't be used to log in.
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

async function startSession(reply: FastifyReply, userId: string) {
  const token = randomBytes(32).toString('base64url');
  await pool.query(
    `insert into sessions (token_hash, user_id, expires_at)
     values ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token), userId, SESSION_DAYS]
  );
  reply.setCookie(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true, // JavaScript in the browser can't read it
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // HTTPS only on the real site
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

/** The logged-in user of this request, or null. Other routes will use this too. */
export async function currentUser(request: FastifyRequest): Promise<UserRow | null> {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  const { rows } = await pool.query<UserRow>(
    `select u.id, u.nickname, u.created_at
     from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)]
  );
  return rows[0] ?? null;
}

// A real bcrypt hash of a random password. Login compares against it when the nickname
// doesn't exist, so an unknown nickname takes as long as a wrong password and can't be
// guessed from the response time.
const DUMMY_HASH = bcrypt.hashSync(randomBytes(16).toString('hex'), 12);

// Rate limit (API.md "Accounts"): 10 tries per 15 minutes per IP + nickname.
// Kept in memory: it resets when the server restarts, which is fine for one server.
const LIMIT_TRIES = 10;
const LIMIT_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

/** Counts one try; true if this IP + nickname has used up its tries for now. */
function tooManyAttempts(request: FastifyRequest, nickname: unknown): boolean {
  const key = `${request.ip}|${String(nickname ?? '').toLowerCase()}`;
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT_TRIES;
}

// Forget old entries so the map doesn't grow forever. unref(): don't keep the process alive.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) if (entry.resetAt <= now) attempts.delete(key);
}, LIMIT_WINDOW_MS).unref();

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', async (request, reply) => {
    const { nickname, password } = (request.body ?? {}) as Record<string, unknown>;

    if (tooManyAttempts(request, nickname)) {
      return fail(reply, 429, 'too_many_attempts', 'Too many tries, wait 15 minutes');
    }
    if (typeof nickname !== 'string' || !NICKNAME_RE.test(nickname)) {
      return fail(reply, 400, 'invalid_nickname', '3 to 20 characters: a-z A-Z 0-9 _ -');
    }
    if (
      typeof password !== 'string' ||
      password.length < PASSWORD_MIN ||
      Buffer.byteLength(password) > PASSWORD_MAX_BYTES
    ) {
      return fail(reply, 400, 'weak_password', 'At least 8 characters, at most 72 bytes');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let user: UserRow;
    try {
      const { rows } = await pool.query<UserRow>(
        `insert into users (nickname, password_hash) values ($1, $2)
         returning id, nickname, created_at`,
        [nickname, passwordHash]
      );
      user = rows[0];
    } catch (err) {
      // 23505 = unique violation: the index on lower(nickname) refused a duplicate.
      if ((err as { code?: string }).code === '23505') {
        return fail(reply, 409, 'nickname_taken', 'This nickname is already in use');
      }
      throw err;
    }

    await startSession(reply, user.id);
    return reply.code(201).send(publicUser(user));
  });

  app.get('/api/me', async (request, reply) => {
    const user = await currentUser(request);
    if (!user) return fail(reply, 401, 'not_logged_in', 'No valid session');
    return publicUser(user);
  });

  app.post('/api/auth/login', async (request, reply) => {
    const { nickname, password } = (request.body ?? {}) as Record<string, unknown>;

    if (tooManyAttempts(request, nickname)) {
      return fail(reply, 429, 'too_many_attempts', 'Too many tries, wait 15 minutes');
    }
    if (typeof nickname !== 'string' || typeof password !== 'string') {
      return fail(reply, 401, 'wrong_credentials', 'Wrong nickname or password');
    }

    const { rows } = await pool.query<UserRow & { password_hash: string }>(
      `select id, nickname, created_at, password_hash from users where lower(nickname) = lower($1)`,
      [nickname]
    );
    const user = rows[0];

    // Always run bcrypt, even for an unknown nickname (see DUMMY_HASH).
    const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !ok) {
      // Same code for an unknown nickname and a wrong password (API.md).
      return fail(reply, 401, 'wrong_credentials', 'Wrong nickname or password');
    }

    await startSession(reply, user.id);
    return publicUser(user);
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      await pool.query('delete from sessions where token_hash = $1', [hashToken(token)]);
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });

  // Deletes the account and everything that belongs to it (sessions go by "on delete cascade").
  app.delete('/api/me', async (request, reply) => {
    const user = await currentUser(request);
    if (!user) return fail(reply, 401, 'not_logged_in', 'No valid session');

    const { password } = (request.body ?? {}) as Record<string, unknown>;
    const { rows } = await pool.query<{ password_hash: string }>(
      'select password_hash from users where id = $1',
      [user.id]
    );
    const ok = typeof password === 'string' && (await bcrypt.compare(password, rows[0].password_hash));
    if (!ok) return fail(reply, 403, 'wrong_credentials', 'Wrong password');

    await pool.query('delete from users where id = $1', [user.id]);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });
}
