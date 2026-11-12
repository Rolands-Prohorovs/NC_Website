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

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', async (request, reply) => {
    const { nickname, password } = (request.body ?? {}) as Record<string, unknown>;

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
}