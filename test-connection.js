require('dotenv').config();
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.bedosbbmtkaariiajejd:%23mmRimkt-a%3F%249u%26@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';

console.log('Testing Supabase connection (transaction pooler)...');

const client = new Client({ connectionString });

client.connect()
  .then(() => {
    console.log('✓ Connected to Supabase!');
    return client.query('SELECT version()');
  })
  .then(res => {
    console.log('✓ PostgreSQL version:', res.rows[0].version.substring(0, 50) + '...');
    return client.query('SELECT current_database()');
  })
  .then(res => {
    console.log('✓ Current database:', res.rows[0].current_database);
    client.end();
    process.exit(0);
  })
  .catch(err => {
    console.error('✗ Connection failed:', err.message);
    process.exit(1);
  });
