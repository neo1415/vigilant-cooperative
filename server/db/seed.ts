/**
 * Database seed script
 * Seeds initial data: chart of accounts, config settings, and admin user
 */

import { db } from './init';
import { chartOfAccounts, configSettings, users, savingsAccounts } from './schema';
import { sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import { hashPassword } from '../../utils/encryption';

/**
 * Seed chart of accounts with standard cooperative accounts
 */
async function seedChartOfAccounts() {
  console.log('Seeding chart of accounts...');
  
  const accounts = [
    // Assets
    { accountCode: '1001', accountName: 'Cash', accountType: 'ASSET', parentCode: null },
    { accountCode: '1002', accountName: 'Bank Account', accountType: 'ASSET', parentCode: null },
    { accountCode: '2001', accountName: 'Loans Receivable', accountType: 'ASSET', parentCode: null },
    
    // Liabilities
    { accountCode: '3001', accountName: 'Member Savings - Normal', accountType: 'LIABILITY', parentCode: null },
    { accountCode: '3002', accountName: 'Member Savings - Special', accountType: 'LIABILITY', parentCode: null },
    
    // Equity
    { accountCode: '4001', accountName: 'Member Equity', accountType: 'EQUITY', parentCode: null },
    { accountCode: '4002', accountName: 'Retained Earnings', accountType: 'EQUITY', parentCode: null },
    
    // Revenue
    { accountCode: '5001', accountName: 'Interest Income', accountType: 'REVENUE', parentCode: null },
    { accountCode: '5002', accountName: 'Other Income', accountType: 'REVENUE', parentCode: null },
    
    // Expenses
    { accountCode: '6001', accountName: 'Administrative Expenses', accountType: 'EXPENSE', parentCode: null },
    { accountCode: '6002', accountName: 'Operating Expenses', accountType: 'EXPENSE', parentCode: null },
  ];
  
  for (const account of accounts) {
    await db.insert(chartOfAccounts).values(account).onConflictDoNothing();
  }
  
  console.log(`✓ Seeded ${accounts.length} chart of accounts entries`);
}

/**
 * Seed config settings with default business rules
 */
async function seedConfigSettings() {
  console.log('Seeding config settings...');
  
  const settings = [
    {
      key: 'loan_to_savings_ratio',
      value: 3.0,
      valueType: 'DECIMAL',
      description: 'Maximum loan amount as multiple of normal savings balance',
      isSystem: true,
    },
    {
      key: 'withdrawal_limit_percentage',
      value: 25,
      valueType: 'INTEGER',
      description: 'Maximum withdrawal as percentage of account balance',
      isSystem: true,
    },
    {
      key: 'minimum_balance_kobo',
      value: 100000, // ₦1,000
      valueType: 'INTEGER',
      description: 'Minimum balance that must remain in normal savings account',
      isSystem: true,
    },
    {
      key: 'short_term_loan_interest_bps',
      value: 500, // 5%
      valueType: 'INTEGER',
      description: 'Interest rate for short-term loans (6 months) in basis points',
      isSystem: false,
    },
    {
      key: 'long_term_loan_interest_bps',
      value: 1000, // 10%
      valueType: 'INTEGER',
      description: 'Interest rate for long-term loans (12 months) in basis points',
      isSystem: false,
    },
    {
      key: 'short_term_loan_months',
      value: 6,
      valueType: 'INTEGER',
      description: 'Repayment period for short-term loans in months',
      isSystem: true,
    },
    {
      key: 'long_term_loan_months',
      value: 12,
      valueType: 'INTEGER',
      description: 'Repayment period for long-term loans in months',
      isSystem: true,
    },
    {
      key: 'max_guarantor_exposure_kobo',
      value: 200000000, // ₦2,000,000
      valueType: 'INTEGER',
      description: 'Maximum total amount a member can guarantee across all loans',
      isSystem: false,
    },
    {
      key: 'required_guarantors',
      value: 2,
      valueType: 'INTEGER',
      description: 'Number of guarantors required for loan application',
      isSystem: true,
    },
  ];
  
  for (const setting of settings) {
    await db.insert(configSettings).values(setting).onConflictDoNothing();
  }
  
  console.log(`✓ Seeded ${settings.length} config settings`);
}

/**
 * Seed initial admin user
 * Note: In production, this should be done via secure process, not seed script
 */
async function seedAdminUser() {
  console.log('Seeding admin user...');
  
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const pepper = process.env.BCRYPT_PEPPER || 'default_pepper_change_in_production';
  const encryptionKey = process.env.FIELD_ENCRYPTION_KEY || 'default_key_change_in_production';
  const hashSalt = process.env.HASH_SALT || 'default_salt_change_in_production';
  
  // Hash password with pepper (using utility function)
  const passwordHash = await hashPassword(adminPassword);
  
  // Encrypt employee ID and phone (simplified for seed - use proper encryption in production)
  const employeeId = 'ADMIN001';
  const phone = '+2348000000000';
  
  const employeeIdHash = crypto.createHash('sha256')
    .update(employeeId + hashSalt)
    .digest('hex');
  
  const phoneHash = crypto.createHash('sha256')
    .update(phone + hashSalt)
    .digest('hex');
  
  // For seed purposes, store as base64 (in production, use proper AES-256-GCM)
  const employeeIdEncrypted = Buffer.from(employeeId).toString('base64');
  const phoneEncrypted = Buffer.from(phone).toString('base64');
  
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
    roles: ['MEMBER', 'ADMIN', 'TREASURER', 'SECRETARY', 'PRESIDENT'],
  };
  
  const insertedUsers: any = await db.insert(users)
    .values(adminUser as any)
    .onConflictDoNothing()
    .returning();
  
  const insertedUser = insertedUsers[0];
  
  if (insertedUser) {
    // Create savings accounts for admin user
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
    ]).onConflictDoNothing();
    
    console.log('✓ Seeded admin user');
    console.log(`  Member ID: ${adminUser.memberId}`);
    console.log(`  Email: ${adminUser.email}`);
    console.log(`  Password: ${adminPassword}`);
    console.log('  ⚠️  CHANGE PASSWORD IMMEDIATELY IN PRODUCTION!');
  } else {
    console.log('✓ Admin user already exists');
  }
}

/**
 * Main seed function
 */
async function seed() {
  try {
    console.log('Starting database seed...\n');
    
    await seedChartOfAccounts();
    await seedConfigSettings();
    await seedAdminUser();
    
    console.log('\n✓ Database seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Database seed failed:', error);
    process.exit(1);
  }
}

// Run seed if called directly
if (require.main === module) {
  seed();
}

export { seed };
