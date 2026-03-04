/**
 * Unlock admin account script
 * Removes account lockout and resets failed login attempts
 */

import { db } from '../server/db/init';
import { sql } from 'drizzle-orm';
import { config } from 'dotenv';

config();

async function unlockAdmin() {
  console.log('🔗 Connecting to database...');
  
  try {
    console.log('🔓 Unlocking admin account...');
    
    // Update admin account to remove lockout using raw SQL
    await db.execute(sql`
      UPDATE members
      SET 
        is_locked = false,
        failed_login_attempts = 0,
        locked_until = NULL
      WHERE member_id = 'VIG-2026-001'
    `);
    
    console.log('✅ Admin account unlocked successfully!');
    console.log('\n📋 You can now login with:');
    console.log('Member ID: VIG-2026-001');
    console.log('Password: Admin123!');
    console.log('\n✨ Try logging in again!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error unlocking admin account:', error);
    process.exit(1);
  }
}

unlockAdmin();
