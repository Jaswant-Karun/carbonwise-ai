const { Pool } = require('pg');
require('dotenv').config();

const buildPoolConfig = () => {
  const connectionString = (process.env.DATABASE_URL || '').trim();

  if (!connectionString) {
    throw new Error('DATABASE_URL is missing in .env');
  }

  try {
    const parsed = new URL(connectionString);

    return {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 5432,
      database: parsed.pathname.replace(/^\//, ''),
      user: decodeURIComponent(parsed.username || ''),
      password: decodeURIComponent(parsed.password || ''),

      // SSL required for Render PostgreSQL
      ssl:
        process.env.PG_SSL === 'true'
          ? { rejectUnauthorized: false }
          : false,
    };
  } catch (error) {
    console.warn(
      '⚠️ Failed to parse DATABASE_URL, trying raw connection string.'
    );

    return {
      connectionString,
      ssl:
        process.env.PG_SSL === 'true'
          ? { rejectUnauthorized: false }
          : false,
    };
  }
};

const pool = new Pool(buildPoolConfig());

pool.connect()
  .then(() => {
    console.log('✅ PostgreSQL connected successfully!');
  })
  .catch((err) => {
    console.error('❌ Database connection error', err);
  });

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};