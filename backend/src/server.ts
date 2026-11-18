import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { pool } from './db.ts';
import { authRoutes } from './auth.ts';
import { initContent } from './content.ts';
import { progressRoutes } from './progress.ts';

// Task definitions from src/content/; throws (server doesn't start) if a file is broken.
await initContent();

const app = Fastify({ logger: true });

await app.register(cookie);
await app.register(authRoutes);
await app.register(progressRoutes);

// Is the server alive, and can it reach the database?
app.get('/api/health', async () => {
  const { rows } = await pool.query('select now() as now');
  return { ok: true, dbTime: rows[0].now };
});

await app.listen({ port: Number(process.env.PORT ?? 3000), host: '127.0.0.1' });