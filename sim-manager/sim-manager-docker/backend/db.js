const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'sim_db',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'sim_manager',
  user:     process.env.DB_USER     || 'sim_user',
  password: process.env.DB_PASSWORD || 'sim_pass_2025',
});

pool.on('connect', () => console.log('✅ PostgreSQL connecté'));
pool.on('error',  (e) => console.error('❌ PostgreSQL erreur:', e.message));

module.exports = pool;
