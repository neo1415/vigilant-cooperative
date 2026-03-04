/**
 * Standalone Delete User Script
 * Directly connects to Supabase without importing server modules
 */

import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { users, savingsAccounts, loans, transactions, loanRepayments } from '../server/db/schema';

// Load environment variables FIRST
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment variables');
  process.exit(1);
}

console.log('🔗 Connecting to database...');
console.log(`📍 URL: ${DATABASE_URL.substring(0, 30)}...`);

// Create database connection
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL
});

const db = drizzle(pool);

async function deleteUserByMemberId(memberId: string) {
  console.log(`\n🔍 Looking for user with member ID: ${memberId}...`);
  
  try {
    // Find user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.memberId, memberId))
      .limit(1);
    
    if (userResult.length === 0) {
      console.log(`❌ User with member ID ${memberId} not found.`);
      await pool.end();
      return;
    }
    
    const user = userResult[0];
    if (!user) {
      console.log(`❌ User with member ID ${memberId} not found.`);
      await pool.end();
      return;
    }
    
    const userId = user.id as string;
    
    console.log(`✅ Found user: ${user.fullName} (${memberId})`);
    console.log(`📧 Email: ${user.email || 'N/A'}`);
    console.log(`🏢 Department: ${user.department}`);
    console.log(`\n🗑️  Deleting user and all related data...`);
    
    // Just delete the user - let database cascades handle the rest
    // Or delete in correct order
    await db.transaction(async (trx) => {
      // Get user's loans first
      const userLoans = await trx
        .select({ id: loans.id })
        .from(loans)
        .where(eq(loans.applicantId, userId));
      
      const loanIds = userLoans.map(l => l.id);
      
      // Delete loan repayments for user's loans
      if (loanIds.length > 0) {
        for (const loanId of loanIds) {
          await trx
            .delete(loanRepayments)
            .where(eq(loanRepayments.loanId, loanId));
        }
        console.log(`   ✓ Deleted loan repayments for ${loanIds.length} loan(s)`);
      }
      
      // Delete loans
      const deletedLoans = await trx
        .delete(loans)
        .where(eq(loans.applicantId, userId))
        .returning({ id: loans.id });
      console.log(`   ✓ Deleted ${deletedLoans.length} loan(s)`);
      
      // Delete transactions
      const deletedTransactions = await trx
        .delete(transactions)
        .where(eq(transactions.userId, userId))
        .returning({ id: transactions.id });
      console.log(`   ✓ Deleted ${deletedTransactions.length} transaction(s)`);
      
      // Delete savings accounts
      const deletedAccounts = await trx
        .delete(savingsAccounts)
        .where(eq(savingsAccounts.userId, userId))
        .returning({ id: savingsAccounts.id });
      console.log(`   ✓ Deleted ${deletedAccounts.length} savings account(s)`);
      
      // Delete user
      await trx
        .delete(users)
        .where(eq(users.id, userId));
      console.log(`   ✓ Deleted user: ${user.fullName} (${memberId})`);
    });
    
    console.log(`\n✨ User ${memberId} and all related data deleted successfully!\n`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function deleteAllUsers() {
  console.log(`\n⚠️  WARNING: This will delete ALL users and their data!`);
  
  try {
    // Get count
    const allUsers = await db.select().from(users);
    console.log(`📊 Found ${allUsers.length} user(s) in the database.`);
    
    if (allUsers.length === 0) {
      console.log(`✅ No users to delete.\n`);
      await pool.end();
      return;
    }
    
    console.log(`\n🗑️  Deleting all users and related data...`);
    
    // Delete all in transaction
    await db.transaction(async (trx) => {
      const deletedPayments = await trx.delete(loanRepayments).returning({ id: loanRepayments.id });
      console.log(`   ✓ Deleted ${deletedPayments.length} loan repayment(s)`);
      
      const deletedLoans = await trx.delete(loans).returning({ id: loans.id });
      console.log(`   ✓ Deleted ${deletedLoans.length} loan(s)`);
      
      const deletedTransactions = await trx.delete(transactions).returning({ id: transactions.id });
      console.log(`   ✓ Deleted ${deletedTransactions.length} transaction(s)`);
      
      const deletedAccounts = await trx.delete(savingsAccounts).returning({ id: savingsAccounts.id });
      console.log(`   ✓ Deleted ${deletedAccounts.length} savings account(s)`);
      
      const deletedUsers = await trx.delete(users).returning({ id: users.id });
      console.log(`   ✓ Deleted ${deletedUsers.length} user(s)`);
    });
    
    console.log(`\n✨ All users and related data deleted successfully!\n`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Main
const args = process.argv.slice(2);
const command = args[0];

(async () => {
  try {
    if (command === 'all') {
      await deleteAllUsers();
    } else if (command) {
      await deleteUserByMemberId(command);
    } else {
      console.log(`
Usage:
  tsx scripts/delete-user-standalone.ts VIG-2026-002
  tsx scripts/delete-user-standalone.ts all
      `);
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
})();
