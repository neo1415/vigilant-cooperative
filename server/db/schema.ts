/**
 * Database schema definitions using Drizzle ORM
 * All monetary values are stored as INTEGER in kobo (1/100 of a Naira)
 * Encrypted fields use BYTEA, hash fields use VARCHAR(64)
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  inet,
  check,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Users table - Member profiles, authentication, encrypted PII
 * Includes field-level encryption for sensitive data
 */
export const users: any = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: varchar('member_id', { length: 20 }).notNull().unique(), // VIG-YYYY-NNN
    
    // Encrypted PII fields (AES-256-GCM stored as BYTEA)
    employeeIdEncrypted: text('employee_id_encrypted').notNull(), // BYTEA as text
    phoneEncrypted: text('phone_encrypted').notNull(), // BYTEA as text
    bvnEncrypted: text('bvn_encrypted'), // BYTEA as text
    salaryReferenceKoboEncrypted: text('salary_reference_kobo_encrypted'), // BYTEA as text
    totpSecretEncrypted: text('totp_secret_encrypted'), // BYTEA as text
    
    // Searchable hash fields (SHA-256)
    employeeIdHash: varchar('employee_id_hash', { length: 64 }).notNull(),
    phoneHash: varchar('phone_hash', { length: 64 }).notNull().unique(),
    bvnHash: varchar('bvn_hash', { length: 64 }),
    
    // Profile information
    fullName: varchar('full_name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    department: varchar('department', { length: 100 }),
    employmentStatus: varchar('employment_status', { length: 20 }).default('ACTIVE'),
    dateJoined: date('date_joined').notNull(),
    
    // Authentication
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    mfaEnabled: boolean('mfa_enabled').default(false),
    failedLoginCount: integer('failed_login_count').default(0),
    lockedUntil: timestamp('locked_until'),
    
    // Approval workflow
    isApproved: boolean('is_approved').default(false),
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at'),
    
    // Monnify reserved account details
    monnifyAccountReference: varchar('monnify_account_reference', { length: 50 }),
    monnifyVirtualAccountNo: varchar('monnify_virtual_account_no', { length: 20 }),
    monnifyBankName: varchar('monnify_bank_name', { length: 100 }),
    monnifyAccountName: varchar('monnify_account_name', { length: 255 }),
    bvnVerified: boolean('bvn_verified').default(false),
    
    // Authorization roles
    roles: text('roles').array().default(sql`ARRAY['MEMBER']::text[]`),
    
    // Optimistic locking and soft delete
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    employeeIdHashIdx: index('users_employee_id_hash_idx').on(table.employeeIdHash),
    phoneHashIdx: index('users_phone_hash_idx').on(table.phoneHash),
    bvnHashIdx: index('users_bvn_hash_idx').on(table.bvnHash),
    memberIdIdx: index('users_member_id_idx').on(table.memberId),
    isApprovedIdx: index('users_is_approved_idx').on(table.isApproved),
    deletedAtIdx: index('users_deleted_at_idx').on(table.deletedAt),
  })
);


/**
 * Savings Accounts table - Normal and Special savings accounts
 * Each member has two accounts: NORMAL (mandatory) and SPECIAL (voluntary)
 */
export const savingsAccounts = pgTable(
  'savings_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    accountType: varchar('account_type', { length: 20 }).notNull(), // NORMAL, SPECIAL
    balanceKobo: integer('balance_kobo').notNull().default(0),
    isLocked: boolean('is_locked').default(false),
    
    // Optimistic locking and soft delete
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    userAccountTypeUnique: unique('savings_accounts_user_account_type_unique').on(
      table.userId,
      table.accountType
    ),
    userIdIdx: index('savings_accounts_user_id_idx').on(table.userId),
    userAccountTypeIdx: index('savings_accounts_user_account_type_idx').on(
      table.userId,
      table.accountType
    ),
    balanceCheck: check('savings_accounts_balance_check', sql`${table.balanceKobo} >= 0`),
  })
);

/**
 * Transactions table - Append-only transaction log for savings
 * Records all credits and debits to savings accounts
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    accountId: uuid('account_id').notNull().references(() => savingsAccounts.id),
    direction: varchar('direction', { length: 10 }).notNull(), // CREDIT, DEBIT
    amountKobo: integer('amount_kobo').notNull(),
    balanceAfterKobo: integer('balance_after_kobo').notNull(),
    reference: varchar('reference', { length: 50 }).notNull().unique(),
    type: varchar('type', { length: 50 }).notNull(),
    description: text('description'),
    metadata: jsonb('metadata'),
    
    // Append-only: no updated_at
    createdAt: timestamp('created_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'), // Rare, audit purposes only
  },
  (table) => ({
    userIdCreatedAtIdx: index('transactions_user_id_created_at_idx').on(
      table.userId,
      sql`${table.createdAt} DESC`
    ),
    accountIdCreatedAtIdx: index('transactions_account_id_created_at_idx').on(
      table.accountId,
      sql`${table.createdAt} DESC`
    ),
    referenceIdx: index('transactions_reference_idx').on(table.reference),
    directionCheck: check('transactions_direction_check', sql`${table.direction} IN ('CREDIT', 'DEBIT')`),
    amountCheck: check('transactions_amount_check', sql`${table.amountKobo} > 0`),
  })
);

/**
 * Loans table - Loan applications and tracking
 * Status flow: SUBMITTED → GUARANTOR_CONSENT → PRESIDENT_REVIEW → COMMITTEE_REVIEW → TREASURER_REVIEW → DISBURSED → ACTIVE → COMPLETED
 */
export const loans = pgTable(
  'loans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    loanReference: varchar('loan_reference', { length: 20 }).notNull().unique(), // LN-YYYY-NNNNN
    applicantId: uuid('applicant_id').notNull().references(() => users.id),
    loanType: varchar('loan_type', { length: 20 }).notNull(), // SHORT_TERM, LONG_TERM
    
    // Monetary fields in kobo
    principalKobo: integer('principal_kobo').notNull(),
    interestRateBps: integer('interest_rate_bps').notNull(), // Basis points (500 = 5%)
    interestKobo: integer('interest_kobo').notNull(),
    totalRepayableKobo: integer('total_repayable_kobo').notNull(),
    monthlyInstallmentKobo: integer('monthly_installment_kobo').notNull(),
    outstandingKobo: integer('outstanding_kobo').notNull(),
    
    repaymentMonths: integer('repayment_months').notNull(),
    purpose: varchar('purpose', { length: 100 }).notNull(),
    purposeDetail: text('purpose_detail'),
    
    // Status and workflow
    status: varchar('status', { length: 30 }).notNull().default('SUBMITTED'),
    submittedAt: timestamp('submitted_at').defaultNow().notNull(),
    disbursedAt: timestamp('disbursed_at'),
    completedAt: timestamp('completed_at'),
    rejectedAt: timestamp('rejected_at'),
    rejectionReason: text('rejection_reason'),
    rejectedBy: uuid('rejected_by').references(() => users.id),
    
    // Optimistic locking and soft delete
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    loanReferenceIdx: index('loans_loan_reference_idx').on(table.loanReference),
    applicantIdStatusIdx: index('loans_applicant_id_status_idx').on(table.applicantId, table.status),
    statusIdx: index('loans_status_idx').on(table.status),
    statusSubmittedAtIdx: index('loans_status_submitted_at_idx').on(
      table.status,
      sql`${table.submittedAt} DESC`
    ),
    statusCheck: check(
      'loans_status_check',
      sql`${table.status} IN ('SUBMITTED', 'GUARANTOR_CONSENT', 'PRESIDENT_REVIEW', 'COMMITTEE_REVIEW', 'TREASURER_REVIEW', 'DISBURSED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CANCELLED')`
    ),
    loanTypeCheck: check('loans_loan_type_check', sql`${table.loanType} IN ('SHORT_TERM', 'LONG_TERM')`),
  })
);

/**
 * Loan Guarantors table - Guarantor consent tracking
 * Each loan requires guarantor consent before approval
 */
export const loanGuarantors = pgTable(
  'loan_guarantors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    loanId: uuid('loan_id').notNull().references(() => loans.id),
    guarantorId: uuid('guarantor_id').notNull().references(() => users.id),
    status: varchar('status', { length: 20 }).notNull().default('PENDING'), // PENDING, CONSENTED, DECLINED
    consentedAt: timestamp('consented_at'),
    declinedAt: timestamp('declined_at'),
    declineReason: text('decline_reason'),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    loanGuarantorUnique: unique('loan_guarantors_loan_guarantor_unique').on(
      table.loanId,
      table.guarantorId
    ),
    loanIdIdx: index('loan_guarantors_loan_id_idx').on(table.loanId),
    guarantorIdIdx: index('loan_guarantors_guarantor_id_idx').on(table.guarantorId),
    guarantorIdStatusIdx: index('loan_guarantors_guarantor_id_status_idx').on(
      table.guarantorId,
      table.status
    ),
    statusCheck: check(
      'loan_guarantors_status_check',
      sql`${table.status} IN ('PENDING', 'CONSENTED', 'DECLINED')`
    ),
  })
);

/**
 * Loan Approvals table - Append-only approval workflow history
 * Records each approval stage with approver details
 */
export const loanApprovals = pgTable(
  'loan_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    loanId: uuid('loan_id').notNull().references(() => loans.id),
    approverId: uuid('approver_id').notNull().references(() => users.id),
    approverRole: varchar('approver_role', { length: 20 }).notNull(), // PRESIDENT, COMMITTEE, TREASURER
    action: varchar('action', { length: 20 }).notNull(), // APPROVED, REJECTED, AMOUNT_OVERRIDE
    previousAmountKobo: integer('previous_amount_kobo'),
    newAmountKobo: integer('new_amount_kobo'),
    comments: text('comments'),
    
    // Append-only: no updated_at
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    loanIdIdx: index('loan_approvals_loan_id_idx').on(table.loanId),
    loanIdCreatedAtIdx: index('loan_approvals_loan_id_created_at_idx').on(
      table.loanId,
      sql`${table.createdAt} DESC`
    ),
    approverIdIdx: index('loan_approvals_approver_id_idx').on(table.approverId),
    actionCheck: check(
      'loan_approvals_action_check',
      sql`${table.action} IN ('APPROVED', 'REJECTED', 'AMOUNT_OVERRIDE')`
    ),
  })
);

/**
 * Loan Repayments table - Append-only repayment records
 * Records all loan repayments from various sources
 */
export const loanRepayments = pgTable(
  'loan_repayments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    loanId: uuid('loan_id').notNull().references(() => loans.id),
    amountKobo: integer('amount_kobo').notNull(),
    paymentDate: date('payment_date').notNull(),
    paymentReference: varchar('payment_reference', { length: 50 }).notNull(),
    paymentMethod: varchar('payment_method', { length: 50 }).notNull(), // PAYROLL_DEDUCTION, MANUAL, BANK_TRANSFER
    recordedBy: uuid('recorded_by').notNull().references(() => users.id),
    
    // Append-only: no updated_at
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    loanIdIdx: index('loan_repayments_loan_id_idx').on(table.loanId),
    loanIdPaymentDateIdx: index('loan_repayments_loan_id_payment_date_idx').on(
      table.loanId,
      sql`${table.paymentDate} DESC`
    ),
    paymentReferenceIdx: index('loan_repayments_payment_reference_idx').on(table.paymentReference),
    amountCheck: check('loan_repayments_amount_check', sql`${table.amountKobo} > 0`),
  })
);

/**
 * Vouchers table - Journal voucher headers for accounting
 * Each voucher groups related ledger entries
 */
export const vouchers = pgTable(
  'vouchers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    voucherNumber: varchar('voucher_number', { length: 20 }).notNull().unique(), // VCH-YYYY-NNNNN
    voucherType: varchar('voucher_type', { length: 50 }).notNull(), // LOAN_DISBURSEMENT, SAVINGS_WITHDRAWAL, etc.
    amountKobo: integer('amount_kobo').notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).notNull().default('DRAFT'), // DRAFT, POSTED, REVERSED
    createdBy: uuid('created_by').notNull().references(() => users.id),
    postedAt: timestamp('posted_at'),
    reversedAt: timestamp('reversed_at'),
    documentUrl: text('document_url'), // Link to supporting document in R2
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    voucherNumberIdx: index('vouchers_voucher_number_idx').on(table.voucherNumber),
    statusIdx: index('vouchers_status_idx').on(table.status),
    createdAtIdx: index('vouchers_created_at_idx').on(sql`${table.createdAt} DESC`),
    statusCheck: check('vouchers_status_check', sql`${table.status} IN ('DRAFT', 'POSTED', 'REVERSED')`),
  })
);

/**
 * Ledger Entries table - Append-only, immutable double-entry ledger
 * Every financial event produces balanced debit and credit entries
 */
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    voucherId: uuid('voucher_id').notNull().references(() => vouchers.id),
    accountCode: varchar('account_code', { length: 10 }).notNull(),
    entryType: varchar('entry_type', { length: 10 }).notNull(), // DEBIT, CREDIT
    amountKobo: integer('amount_kobo').notNull(),
    description: text('description'),
    
    // Append-only, immutable: no updated_at, no deleted_at
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    voucherIdIdx: index('ledger_entries_voucher_id_idx').on(table.voucherId),
    accountCodeIdx: index('ledger_entries_account_code_idx').on(table.accountCode),
    accountCodeCreatedAtIdx: index('ledger_entries_account_code_created_at_idx').on(
      table.accountCode,
      sql`${table.createdAt} DESC`
    ),
    entryTypeCheck: check('ledger_entries_entry_type_check', sql`${table.entryType} IN ('DEBIT', 'CREDIT')`),
    amountCheck: check('ledger_entries_amount_check', sql`${table.amountKobo} > 0`),
  })
);

/**
 * Chart of Accounts table - Account code definitions
 * Standard cooperative account structure
 */
export const chartOfAccounts = pgTable(
  'chart_of_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountCode: varchar('account_code', { length: 10 }).notNull().unique(),
    accountName: varchar('account_name', { length: 100 }).notNull(),
    accountType: varchar('account_type', { length: 20 }).notNull(), // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    parentCode: varchar('parent_code', { length: 10 }),
    isActive: boolean('is_active').default(true).notNull(),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    accountCodeIdx: index('chart_of_accounts_account_code_idx').on(table.accountCode),
    accountTypeIdx: index('chart_of_accounts_account_type_idx').on(table.accountType),
    accountTypeCheck: check(
      'chart_of_accounts_account_type_check',
      sql`${table.accountType} IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')`
    ),
  })
);

/**
 * Payroll Imports table - Monthly payroll file imports
 * Tracks CSV uploads and processing status
 */
export const payrollImports = pgTable(
  'payroll_imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    importReference: varchar('import_reference', { length: 20 }).notNull().unique(), // PAY-YYYY-MM
    periodMonth: integer('period_month').notNull(),
    periodYear: integer('period_year').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('UPLOADED'), // UPLOADED, PARSING, PARSED, CONFIRMED, FAILED
    fileUrl: text('file_url').notNull(), // CSV file in R2
    totalMembers: integer('total_members'),
    totalAmountKobo: integer('total_amount_kobo'),
    parsedAt: timestamp('parsed_at'),
    confirmedAt: timestamp('confirmed_at'),
    uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
    confirmedBy: uuid('confirmed_by').references(() => users.id),
    errorLog: jsonb('error_log'), // Parsing errors and discrepancies
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    importReferenceIdx: index('payroll_imports_import_reference_idx').on(table.importReference),
    periodYearMonthIdx: index('payroll_imports_period_year_month_idx').on(
      table.periodYear,
      table.periodMonth
    ),
    statusIdx: index('payroll_imports_status_idx').on(table.status),
    statusCheck: check(
      'payroll_imports_status_check',
      sql`${table.status} IN ('UPLOADED', 'PARSING', 'PARSED', 'CONFIRMED', 'FAILED')`
    ),
  })
);

/**
 * Payroll Deductions table - Individual member deductions
 * Links to payroll imports and tracks deduction breakdown
 */
export const payrollDeductions = pgTable(
  'payroll_deductions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    importId: uuid('import_id').notNull().references(() => payrollImports.id),
    userId: uuid('user_id').notNull().references(() => users.id),
    normalSavingsKobo: integer('normal_savings_kobo').notNull().default(0),
    specialSavingsKobo: integer('special_savings_kobo').notNull().default(0),
    loanRepaymentKobo: integer('loan_repayment_kobo').notNull().default(0),
    loanId: uuid('loan_id').references(() => loans.id),
    otherDeductionsKobo: integer('other_deductions_kobo').notNull().default(0),
    otherDescription: text('other_description'),
    totalDeductionKobo: integer('total_deduction_kobo').notNull(),
    discrepancyFlag: boolean('discrepancy_flag').default(false),
    discrepancyReason: text('discrepancy_reason'),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    importIdIdx: index('payroll_deductions_import_id_idx').on(table.importId),
    userIdIdx: index('payroll_deductions_user_id_idx').on(table.userId),
    importIdUserIdIdx: index('payroll_deductions_import_id_user_id_idx').on(
      table.importId,
      table.userId
    ),
  })
);

/**
 * Member Exits table - Exit workflow tracking
 * Manages member departure and final settlement
 */
export const memberExits = pgTable(
  'member_exits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    exitReference: varchar('exit_reference', { length: 20 }).notNull().unique(), // EXIT-YYYY-NNN
    status: varchar('status', { length: 30 }).notNull().default('INITIATED'), // INITIATED, CALCULATED, TREASURER_REVIEW, APPROVED, DISBURSED
    normalSavingsBalanceKobo: integer('normal_savings_balance_kobo').notNull(),
    specialSavingsBalanceKobo: integer('special_savings_balance_kobo').notNull(),
    outstandingLoansKobo: integer('outstanding_loans_kobo').notNull(),
    guarantorExposureKobo: integer('guarantor_exposure_kobo').notNull(),
    finalPayoutKobo: integer('final_payout_kobo').notNull(),
    settlementPdfUrl: text('settlement_pdf_url'),
    initiatedAt: timestamp('initiated_at').defaultNow().notNull(),
    approvedAt: timestamp('approved_at'),
    disbursedAt: timestamp('disbursed_at'),
    approvedBy: uuid('approved_by').references(() => users.id),
    disbursedBy: uuid('disbursed_by').references(() => users.id),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('member_exits_user_id_idx').on(table.userId),
    statusIdx: index('member_exits_status_idx').on(table.status),
    exitReferenceIdx: index('member_exits_exit_reference_idx').on(table.exitReference),
    statusCheck: check(
      'member_exits_status_check',
      sql`${table.status} IN ('INITIATED', 'CALCULATED', 'TREASURER_REVIEW', 'APPROVED', 'DISBURSED')`
    ),
  })
);

/**
 * Audit Log table - Append-only, immutable, tamper-evident audit trail
 * Records all system operations with chain hashing for integrity
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id), // Nullable for system actions
    action: varchar('action', { length: 50 }).notNull(),
    resourceType: varchar('resource_type', { length: 50 }),
    resourceId: uuid('resource_id'),
    previousValue: jsonb('previous_value'),
    newValue: jsonb('new_value'),
    ipAddress: varchar('ip_address', { length: 45 }), // IPv6 support
    userAgent: text('user_agent'),
    chainHash: varchar('chain_hash', { length: 64 }), // SHA-256 for tamper detection
    
    // Append-only, immutable: no updated_at, no deleted_at
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('audit_log_user_id_idx').on(table.userId),
    resourceTypeIdx: index('audit_log_resource_type_idx').on(table.resourceType),
    resourceIdIdx: index('audit_log_resource_id_idx').on(table.resourceId),
    actionIdx: index('audit_log_action_idx').on(table.action),
    createdAtIdx: index('audit_log_created_at_idx').on(sql`${table.createdAt} DESC`),
  })
);

/**
 * Config Settings table - Business rule configuration
 * Stores configurable parameters for the system
 */
export const configSettings = pgTable(
  'config_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 100 }).notNull().unique(),
    value: jsonb('value').notNull(),
    valueType: varchar('value_type', { length: 20 }).notNull(), // INTEGER, DECIMAL, BOOLEAN, STRING, JSON
    description: text('description'),
    isSystem: boolean('is_system').default(false).notNull(), // System configs cannot be deleted
    updatedBy: uuid('updated_by').references(() => users.id),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    keyIdx: index('config_settings_key_idx').on(table.key),
    valueTypeCheck: check(
      'config_settings_value_type_check',
      sql`${table.valueType} IN ('INTEGER', 'DECIMAL', 'BOOLEAN', 'STRING', 'JSON')`
    ),
  })
);

/**
 * Notifications table - SMS/Email delivery tracking
 * Tracks notification status and delivery
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    type: varchar('type', { length: 50 }).notNull(), // SMS, EMAIL, IN_APP
    channel: varchar('channel', { length: 20 }).notNull(), // TERMII, RESEND, SYSTEM
    subject: varchar('subject', { length: 255 }),
    body: text('body').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('PENDING'), // PENDING, SENT, FAILED, DELIVERED
    sentAt: timestamp('sent_at'),
    deliveredAt: timestamp('delivered_at'),
    failedAt: timestamp('failed_at'),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0).notNull(),
    metadata: jsonb('metadata'), // Template variables, tracking info
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('notifications_user_id_idx').on(table.userId),
    statusIdx: index('notifications_status_idx').on(table.status),
    typeIdx: index('notifications_type_idx').on(table.type),
    createdAtIdx: index('notifications_created_at_idx').on(sql`${table.createdAt} DESC`),
    statusCheck: check(
      'notifications_status_check',
      sql`${table.status} IN ('PENDING', 'SENT', 'FAILED', 'DELIVERED')`
    ),
  })
);
