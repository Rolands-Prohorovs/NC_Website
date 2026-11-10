import pg from 'pg';

// One shared pool of connections to PostgreSQL for the whole server.
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
