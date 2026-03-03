/**
 * Simple Delete User Script using raw SQL
 */

import * as dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function deleteUser(memberId: string) {
  const client = await pool.connect();
  
  try {
    console.log(`\n🔍 Looking for user: ${memberId}...`);
    
    // Find user
    const userResult = await client.query(
      'SELECT id, member_id, full_name, email, department FROM users WHERE member_id = $1',
      [memberId]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`❌ User not found`);
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`✅ Found: ${user.full_name} (${user.email || 'no email'})`);
    console.log(`🗑️  Deleting...`);
    
    await client.query('BEGIN');
    
    // Delete in order
    await client.query('DELETE FROM loan_repayments WHERE loan_id IN (SELECT id FROM loans WHERE applicant_id = $1)', [user.id]);
    await client.query('DELETE FROM loans WHERE applicant_id = $1', [user.id]);
    await client.query('DELETE FROM transactions WHERE user_id = $1', [user.id]);
    await client.query('DELETE FROM savings_accounts WHERE user_id = $1', [user.id]);
    await client.query('DELETE FROM users WHERE id = $1', [user.id]);
    
    await client.query('COMMIT');
    
    console.log(`✨ Deleted successfully!\n`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

const memberId = process.argv[2];
if (!memberId) {
  console.log('Usage: npx tsx scripts/delete-user-simple.ts VIG-2026-002');
  process.exit(1);
}

deleteUser(memberId);
