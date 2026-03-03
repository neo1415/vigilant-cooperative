# Database Schema Documentation

This directory contains the complete database schema for the Vigilant Cooperative Platform.

## Overview

The database uses PostgreSQL 16+ with Drizzle ORM for type-safe database access. The schema implements:

- **16 tables** for complete cooperative management
- **Field-level encryption** for sensitive PII (AES-256-GCM)
- **Optimistic locking** with version columns
- **Soft deletes** with deleted_at timestamps
- **Append-only tables** for audit trail (transactions, ledger_entries, audit_log)
- **Double-entry bookkeeping** enforced by database triggers
- **Tamper-evident audit log** with chain hashing

## Files

- `schema.ts` - Complete Drizzle ORM schema definitions
- `init.ts` - Database connection initialization
- `migrate.ts` - Migration runner script
- `seed.ts` - Seed data script (chart of accounts, config, admin user)
- `triggers.sql` - Database triggers and constraints

## Tables

### Member Management
- **users** - Member profiles, authentication, encrypted PII
- **member_exits** - Exit workflow tracking

### Savings Management
- **savings_accounts** - Normal and Special savings accounts
- **transactions** - All savings transactions (append-only)

### Loan Management
- **loans** - Loan applications and status
- **loan_guarantors** - Guarantor consent tracking
- **loan_approvals** - Approval workflow history (append-only)
- **loan_repayments** - Repayment records (append-only)

### Accounting
- **vouchers** - Journal voucher headers
- **ledger_entries** - Double-entry ledger (append-only, immutable)
- **chart_of_accounts** - Account code definitions

### Payroll
- **payroll_imports** - Monthly payroll file imports
- **payroll_deductions** - Individual member deductions

### System
- **audit_log** - Complete audit trail with chain hashing (append-only, immutable)
- **config_settings** - Business rule configuration
- **notifications** - SMS/Email delivery tracking

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file with:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/vigilant_db
FIELD_ENCRYPTION_KEY=<64 hex chars>
BCRYPT_PEPPER=<32+ random chars>
HASH_SALT=<32+ random chars>
ADMIN_PASSWORD=<secure password>
```

### 3. Generate Migrations

```bash
npm run db:generate
```

This creates migration files in `drizzle/migrations/` based on the schema.

### 4. Run Migrations

```bash
npm run db:migrate
```

This applies:
- All table definitions
- Indexes and constraints
- Database triggers (double-entry, updated_at, chain_hash)

### 5. Seed Initial Data

```bash
npm run db:seed
```

This seeds:
- Chart of accounts (11 standard accounts)
- Config settings (9 business rules)
- Admin user (VIG-2026-001)

### 6. Complete Setup (All Steps)

```bash
npm run db:setup
```

This runs generate → migrate → seed in sequence.

## Database Triggers

### 1. Double-Entry Bookkeeping Enforcement

**Trigger:** `enforce_ledger_balance`  
**Function:** `check_ledger_balance()`  
**Purpose:** Ensures debits = credits for every voucher

```sql
-- Fires after INSERT on ledger_entries
-- Deferred to end of transaction
-- Raises exception if unbalanced
```

### 2. Automatic Updated_At Timestamp

**Trigger:** `update_*_updated_at`  
**Function:** `update_updated_at()`  
**Purpose:** Automatically updates updated_at on row modification

Applied to: users, savings_accounts, loans, loan_guarantors, vouchers, chart_of_accounts, payroll_imports, member_exits, config_settings, notifications

### 3. Audit Log Chain Hash

**Trigger:** `compute_audit_chain_hash`  
**Function:** `compute_chain_hash()`  
**Purpose:** Computes SHA-256 chain hash for tamper detection

```sql
chain_hash = SHA-256(previous_hash + created_at + new_value)
```

## Key Design Principles

### 1. All Money is Integers (Kobo)

Every monetary value is stored as INTEGER in kobo (1/100 Naira). No floating point.

```typescript
// ✓ Correct
const amountKobo = 500000; // ₦5,000.00

// ✗ Wrong
const amountNaira = 5000.00; // Floating point!
```

### 2. Encrypted Fields

Sensitive PII is encrypted at rest using AES-256-GCM:

- employee_id_encrypted
- phone_encrypted
- bvn_encrypted
- salary_reference_kobo_encrypted
- totp_secret_encrypted

Searchable hashes (SHA-256) enable lookups:

- employee_id_hash
- phone_hash
- bvn_hash

### 3. Optimistic Locking

All financially mutable tables have a `version` column:

```sql
UPDATE savings_accounts
SET balance_kobo = balance_kobo - 50000,
    version = version + 1
WHERE id = $1 AND version = $2;
```

If version mismatch, update affects 0 rows → optimistic lock conflict.

### 4. Soft Deletes

Most tables have `deleted_at` timestamp for soft delete:

```sql
-- Soft delete
UPDATE users SET deleted_at = NOW() WHERE id = $1;

-- Query active records
SELECT * FROM users WHERE deleted_at IS NULL;
```

**Exception:** Append-only tables (transactions, ledger_entries, audit_log) have no deleted_at.

### 5. Append-Only Tables

These tables are immutable event logs:

- **transactions** - No updates, no deletes
- **ledger_entries** - No updated_at, no deleted_at
- **audit_log** - No updated_at, no deleted_at
- **loan_approvals** - No updated_at
- **loan_repayments** - No updated_at

## Chart of Accounts

Standard cooperative account structure:

| Code | Name | Type |
|------|------|------|
| 1001 | Cash | ASSET |
| 1002 | Bank Account | ASSET |
| 2001 | Loans Receivable | ASSET |
| 3001 | Member Savings - Normal | LIABILITY |
| 3002 | Member Savings - Special | LIABILITY |
| 4001 | Member Equity | EQUITY |
| 4002 | Retained Earnings | EQUITY |
| 5001 | Interest Income | REVENUE |
| 5002 | Other Income | REVENUE |
| 6001 | Administrative Expenses | EXPENSE |
| 6002 | Operating Expenses | EXPENSE |

## Config Settings

Default business rules:

| Key | Value | Type | Description |
|-----|-------|------|-------------|
| loan_to_savings_ratio | 3.0 | DECIMAL | Max loan as multiple of savings |
| withdrawal_limit_percentage | 25 | INTEGER | Max withdrawal % of balance |
| minimum_balance_kobo | 100000 | INTEGER | Min balance (₦1,000) |
| short_term_loan_interest_bps | 500 | INTEGER | 5% interest rate |
| long_term_loan_interest_bps | 1000 | INTEGER | 10% interest rate |
| short_term_loan_months | 6 | INTEGER | 6-month repayment |
| long_term_loan_months | 12 | INTEGER | 12-month repayment |
| max_guarantor_exposure_kobo | 200000000 | INTEGER | ₦2M max guarantee |
| required_guarantors | 2 | INTEGER | 2 guarantors required |

## Verification

After setup, verify:

```bash
# Check tables exist
psql $DATABASE_URL -c "\dt"

# Check triggers exist
psql $DATABASE_URL -c "\df"

# Check indexes
psql $DATABASE_URL -c "\di"

# Check seed data
psql $DATABASE_URL -c "SELECT * FROM chart_of_accounts;"
psql $DATABASE_URL -c "SELECT * FROM config_settings;"
psql $DATABASE_URL -c "SELECT member_id, full_name, roles FROM users;"
```

## Troubleshooting

### Migration Fails

```bash
# Drop and recreate database
dropdb vigilant_db
createdb vigilant_db

# Re-run setup
npm run db:setup
```

### Trigger Errors

Check PostgreSQL logs:

```bash
tail -f /var/log/postgresql/postgresql-16-main.log
```

### Seed Fails

Ensure environment variables are set:

```bash
echo $DATABASE_URL
echo $FIELD_ENCRYPTION_KEY
```

## Security Notes

⚠️ **IMPORTANT:**

1. **Change admin password immediately** after first login
2. **Rotate encryption keys** every 90 days
3. **Never commit .env files** to source control
4. **Use strong passwords** for database users
5. **Enable SSL/TLS** for database connections in production

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL 16 Documentation](https://www.postgresql.org/docs/16/)
- Design Document: `.kiro/specs/vigilant-cooperative-platform/design.md`
- Requirements: `.kiro/specs/vigilant-cooperative-platform/requirements.md`
