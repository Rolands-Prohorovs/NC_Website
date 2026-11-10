import Fastify from 'fastify';
import { pool } from './db.ts';

const app = Fastify({ logger: true });

// Is the server alive, and can it reach the database?
app.get('/api/health', async () => {
  const { rows } = await pool.query('select now() as now');
  return { ok: true, dbTime: rows[0].now };
});

await app.listen({ port: Number(process.env.PORT ?? 3000), host: '127.0.0.1' });
