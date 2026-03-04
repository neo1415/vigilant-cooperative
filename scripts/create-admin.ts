/**
 * Create Admin User Script
 * Creates or recreates the admin user with known credentials
 */

import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { users, savingsAccounts } from '../server/db/schema';
import * as crypto from 'crypto';

// Load environment variables FIRST before importing utils
dotenv.config();

// Now import utils that depend on env vars
import { hashPassword } from '../utils/encryption';

const DATABASE_URL = process.env.DATABASE_URL;
const HASH_SALT = process.env.HASH_SALT || 'default_salt_change_in_production';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

console.log('🔗 Connecting to database...');

// Create database connection
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : undefined,
});

const db = drizzle(pool);

async function createAdminUser() {
  try {
    const adminPassword = 'Admin123!';
    const employeeId = 'ADMIN001';
    const phone = '+2348000000000';
    
    console.log('\n📝 Creating admin user...');
    console.log('   Member ID: VIG-2026-001');
    console.log('   Password: Admin123!');
    
    // Hash password using the same method as auth service (with pepper)
    const passwordHash = await hashPassword(adminPassword);
    
    // Create hashes for lookups
    const employeeIdHash = crypto.createHash('sha256')
      .update(employeeId + HASH_SALT)
      .digest('hex');
    
    const phoneHash = crypto.createHash('sha256')
      .update(phone + HASH_SALT)
      .digest('hex');
    
    // Simple encryption (base64) for seed purposes
    const employeeIdEncrypted = Buffer.from(employeeId).toString('base64');
    const phoneEncrypted = Buffer.from(phone).toString('base64');
    
    // Check if admin already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.memberId, 'VIG-2026-001'))
      .limit(1);
    
    if (existing.length > 0) {
      console.log('\n⚠️  Admin user already exists!');
      console.log('   Updating password...');
      
      // Update password
      await db
        .update(users)
        .set({
          passwordHash,
          isApproved: true,
          approvedAt: new Date(),
          roles: ['MEMBER', 'ADMIN', 'TREASURER', 'SECRETARY', 'PRESIDENT', 'COMMITTEE'],
        })
        .where(eq(users.memberId, 'VIG-2026-001'));
      
      console.log('✅ Admin user password updated!');
    } else {
      // Create new admin user
      const adminUser = {
        memberId: 'VIG-2026-001',
        employeeIdEncrypted,
        phoneEncrypted,
        employeeIdHash,
        phoneHash,
        fullName: 'System Administrator',
        email: 'admin@vigilant.coop',
        department: 'IT',
        employmentStatus: 'ACTIVE',
        dateJoined: new Date('2026-01-01'),
        passwordHash,
        isApproved: true,
        approvedAt: new Date(),
        roles: ['MEMBER', 'ADMIN', 'TREASURER', 'SECRETARY', 'PRESIDENT', 'COMMITTEE'],
      };
      
      const insertedUsers = await db
        .insert(users)
        .values(adminUser as any)
        .returning();
      
      const insertedUser = (insertedUsers as any[])[0] as typeof users.$inferSelect | undefined;
      
      if (insertedUser) {
        // Create savings accounts
        await db.insert(savingsAccounts).values([
          {
            userId: insertedUser.id,
            accountType: 'NORMAL',
            balanceKobo: 0,
          },
          {
            userId: insertedUser.id,
            accountType: 'SPECIAL',
            balanceKobo: 0,
          },
        ]);
        
        console.log('✅ Admin user created successfully!');
      }
    }
    
    console.log('\n📋 Login Credentials:');
    console.log('   URL: http://localhost:3000/login');
    console.log('   Member ID: VIG-2026-001');
    console.log('   Password: Admin123!');
    console.log('\n✨ You can now login with these credentials!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run
(async () => {
  try {
    await createAdminUser();
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
})();
