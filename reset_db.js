const { Client } = require('pg');

async function resetDatabase() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = 'cryptogadai'
        AND pid <> pg_backend_pid();
    `);
    console.log('Terminated existing connections');

    await client.query('DROP DATABASE IF EXISTS cryptogadai;');
    console.log('Dropped database cryptogadai');

    await client.query('CREATE DATABASE cryptogadai;');
    console.log('Created database cryptogadai');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

resetDatabase();
