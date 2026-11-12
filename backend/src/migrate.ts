import { readdir, readFile } from 'node:fs/promises';
import { pool } from './db.ts';

// Runs every .sql file in backend/migrations once, in name order.
const dir = new URL('../migrations/', import.meta.url);

await pool.query(`
  create table if not exists schema_migrations (
    name       text primary key,
    applied_at timestamptz not null default now()
  )`);

const { rows } = await pool.query('select name from schema_migrations');
const applied = new Set(rows.map((row) => row.name));
const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();

for (const file of files) {
  if (applied.has(file)) continue;
  const sql = await readFile(new URL(file, dir), 'utf8');
  const client = await pool.connect();
  try {
    // All or nothing: a broken migration leaves the database unchanged.
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into schema_migrations (name) values ($1)', [file]);
    await client.query('commit');
    console.log('applied', file);
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

console.log('database is up to date');
await pool.end();