/**
 * Delete Users Script
 * 
 * Utility script to delete users from the database.
 * Use with caution - this will permanently delete user data!
 * 
 * Usage:
 * - Delete specific user: npm run delete-user VIG-2026-002
 * - Delete all users: npm run delete-all-users
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { db } from '../server/db/init';
import { users, savingsAccounts, loans, savingsTransactions, loanPayments } from '../server/db/schema';
import { eq } from 'drizzle-orm';

async function deleteUserByMemberId(memberId: string) {
  console.log(`\n🔍 Looking for user with member ID: ${memberId}...`);
  
  // Find user
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.memberId, memberId))
    .limit(1);
  
  if (userResult.length === 0) {
    console.log(`❌ User with member ID ${memberId} not found.`);
    return;
  }
  
  const user = userResult[0];
  const userId = user.id as string;
  
  console.log(`✅ Found user: ${user.fullName} (${memberId})`);
  console.log(`📧 Email: ${user.email || 'N/A'}`);
  console.log(`🏢 Department: ${user.department}`);
  
  // Delete in transaction to maintain referential integrity
  await db.transaction(async (trx) => {
    // Delete loan payments first (references loans)
    const deletedPayments = await trx
      .delete(loanPayments)
      .where(eq(loanPayments.userId, userId))
      .returning({ id: loanPayments.id });
    console.log(`🗑️  Deleted ${deletedPayments.length} loan payment(s)`);
    
    // Delete loans
    const deletedLoans = await trx
      .delete(loans)
      .where(eq(loans.userId, userId))
      .returning({ id: loans.id });
    console.log(`🗑️  Deleted ${deletedLoans.length} loan(s)`);
    
    // Delete savings transactions
    const deletedTransactions = await trx
      .delete(savingsTransactions)
      .where(eq(savingsTransactions.userId, userId))
      .returning({ id: savingsTransactions.id });
    console.log(`🗑️  Deleted ${deletedTransactions.length} savings transaction(s)`);
    
    // Delete savings accounts
    const deletedAccounts = await trx
      .delete(savingsAccounts)
      .where(eq(savingsAccounts.userId, userId))
      .returning({ id: savingsAccounts.id });
    console.log(`🗑️  Deleted ${deletedAccounts.length} savings account(s)`);
    
    // Finally, delete user
    await trx
      .delete(users)
      .where(eq(users.id, userId));
    console.log(`✅ Deleted user: ${user.fullName} (${memberId})`);
  });
  
  console.log(`\n✨ User ${memberId} and all related data deleted successfully!\n`);
}

async function deleteAllUsers() {
  console.log(`\n⚠️  WARNING: This will delete ALL users and their data!`);
  console.log(`⚠️  This action cannot be undone!\n`);
  
  // Get count of users
  const allUsers = await db.select().from(users);
  console.log(`📊 Found ${allUsers.length} user(s) in the database.`);
  
  if (allUsers.length === 0) {
    console.log(`✅ No users to delete.\n`);
    return;
  }
  
  // Delete all data in transaction
  await db.transaction(async (trx) => {
    // Delete loan payments first
    const deletedPayments = await trx.delete(loanPayments).returning({ id: loanPayments.id });
    console.log(`🗑️  Deleted ${deletedPayments.length} loan payment(s)`);
    
    // Delete loans
    const deletedLoans = await trx.delete(loans).returning({ id: loans.id });
    console.log(`🗑️  Deleted ${deletedLoans.length} loan(s)`);
    
    // Delete savings transactions
    const deletedTransactions = await trx.delete(savingsTransactions).returning({ id: savingsTransactions.id });
    console.log(`🗑️  Deleted ${deletedTransactions.length} savings transaction(s)`);
    
    // Delete savings accounts
    const deletedAccounts = await trx.delete(savingsAccounts).returning({ id: savingsAccounts.id });
    console.log(`🗑️  Deleted ${deletedAccounts.length} savings account(s)`);
    
    // Delete all users
    const deletedUsers = await trx.delete(users).returning({ id: users.id });
    console.log(`🗑️  Deleted ${deletedUsers.length} user(s)`);
  });
  
  console.log(`\n✨ All users and related data deleted successfully!\n`);
}

// Main execution
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
  Delete specific user:  tsx scripts/delete-users.ts VIG-2026-002
  Delete all users:      tsx scripts/delete-users.ts all

Examples:
  tsx scripts/delete-users.ts VIG-2026-002
  tsx scripts/delete-users.ts all
      `);
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();
