/**
 * Database migration runner
 * Applies schema migrations and triggers to the database
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  console.log('Connecting to database...');
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);
  
  try {
    console.log('Running Drizzle migrations...');
    await migrate(db, { migrationsFolder: './drizzle/migrations' });
    console.log('✓ Drizzle migrations completed');
    
    console.log('\nApplying database triggers...');
    const triggersSQL = fs.readFileSync(
      path.join(__dirname, 'triggers.sql'),
      'utf-8'
    );
    
    await pool.query(triggersSQL);
    console.log('✓ Database triggers applied');
    
    console.log('\n✓ All migrations completed successfully!');
  } catch (error) {
    console.error('✗ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { runMigrations };
