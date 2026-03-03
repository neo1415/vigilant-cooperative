// Use Supabase REST API to run migrations (bypasses PostgreSQL port blocking)
const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://bedosbbmtkaariiajejd.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlZG9zYmJtdGthYXJpaWFqZWpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjUyNTU3OSwiZXhwIjoyMDg4MTAxNTc5fQ.FdNRhD-vtB9w_y2KSVFT03Y_A-MRkt4p2zMDbebDg2U';

async function runSQL(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    
    const options = {
      hostname: 'bedosbbmtkaariiajejd.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🚀 Running migrations via Supabase REST API...\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'drizzle/migrations/0000_parched_grandmaster.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Running schema migration...');
    await runSQL(migrationSQL);
    console.log('✓ Schema migration complete\n');

    // Read triggers file
    const triggersPath = path.join(__dirname, 'server/db/triggers.sql');
    const triggersSQL = fs.readFileSync(triggersPath, 'utf8');
    
    console.log('📄 Running triggers...');
    await runSQL(triggersSQL);
    console.log('✓ Triggers complete\n');

    console.log('✅ All migrations completed successfully!');
    console.log('\nNext step: Run `npm run db:seed` to add initial data');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

main();
