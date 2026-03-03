# Database Setup Guide

This guide walks you through setting up the complete database schema for the Vigilant Cooperative Platform.

## Prerequisites

- PostgreSQL 16+ installed and running
- Node.js 24.x LTS
- npm or yarn package manager

## Quick Start

If you have PostgreSQL running locally, follow these steps:

### 1. Create Database

```bash
# Using psql
createdb vigilant_cooperative

# Or using SQL
psql -U postgres -c "CREATE DATABASE vigilant_cooperative;"
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/vigilant_cooperative
FIELD_ENCRYPTION_KEY=<generate 64 hex chars>
BCRYPT_PEPPER=<generate random string>
HASH_SALT=<generate random string>
ADMIN_PASSWORD=<secure password>
```

**Generate secure keys:**

```bash
# Field encryption key (64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Bcrypt pepper (32+ chars)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Hash salt (32+ chars)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Complete Setup

```bash
npm run db:setup
```

This command runs:
1. `db:generate` - Generates migration files from schema
2. `db:migrate` - Applies migrations and triggers
3. `db:seed` - Seeds initial data

## Step-by-Step Setup

If you prefer to run each step individually:

### Step 1: Generate Migrations

```bash
npm run db:generate
```

This creates migration files in `drizzle/migrations/` based on the schema definitions in `server/db/schema.ts`.

**Output:**
```
16 tables
audit_log 11 columns 5 indexes 1 fks
chart_of_accounts 8 columns 2 indexes 0 fks
...
[✓] Your SQL migration file ➜ drizzle/migrations/0000_*.sql
```

### Step 2: Apply Migrations

```bash
npm run db:migrate
```

This applies:
- All table definitions with columns, indexes, constraints
- Database triggers (double-entry, updated_at, chain_hash)
- Partial unique constraints

**Output:**
```
Connecting to database...
Running Drizzle migrations...
✓ Drizzle migrations completed

Applying database triggers...
✓ Database triggers applied

✓ All migrations completed successfully!
```

### Step 3: Seed Initial Data

```bash
npm run db:seed
```

This seeds:
- **Chart of Accounts** (11 standard accounts)
- **Config Settings** (9 business rules)
- **Admin User** (VIG-2026-001)

**Output:**
```
Starting database seed...

Seeding chart of accounts...
✓ Seeded 11 chart of accounts entries

Seeding config settings...
✓ Seeded 9 config settings

Seeding admin user...
✓ Seeded admin user
  Member ID: VIG-2026-001
  Email: admin@vigilant.coop
  Password: Admin123!
  ⚠️  CHANGE PASSWORD IMMEDIATELY IN PRODUCTION!

✓ Database seed completed successfully!
```

## Verification

After setup, verify the database:

### Check Tables

```bash
psql $DATABASE_URL -c "\dt"
```

Expected output: 16 tables

### Check Triggers

```bash
psql $DATABASE_URL -c "\df"
```

Expected functions:
- `check_ledger_balance()`
- `update_updated_at()`
- `compute_chain_hash()`

### Check Seed Data

```bash
# Chart of accounts
psql $DATABASE_URL -c "SELECT account_code, account_name, account_type FROM chart_of_accounts ORDER BY account_code;"

# Config settings
psql $DATABASE_URL -c "SELECT key, value, value_type FROM config_settings ORDER BY key;"

# Admin user
psql $DATABASE_URL -c "SELECT member_id, full_name, email, roles FROM users;"
```

### Test Database Connection

```bash
# Using Drizzle Studio (visual database browser)
npm run db:studio
```

This opens a web interface at `https://local.drizzle.studio` to browse your database.

## Database Schema Overview

### 16 Tables Created

**Member Management:**
- `users` - Member profiles, authentication, encrypted PII
- `member_exits` - Exit workflow tracking

**Savings Management:**
- `savings_accounts` - Normal and Special savings accounts
- `transactions` - All savings transactions (append-only)

**Loan Management:**
- `loans` - Loan applications and status
- `loan_guarantors` - Guarantor consent tracking
- `loan_approvals` - Approval workflow history (append-only)
- `loan_repayments` - Repayment records (append-only)

**Accounting:**
- `vouchers` - Journal voucher headers
- `ledger_entries` - Double-entry ledger (append-only, immutable)
- `chart_of_accounts` - Account code definitions

**Payroll:**
- `payroll_imports` - Monthly payroll file imports
- `payroll_deductions` - Individual member deductions

**System:**
- `audit_log` - Complete audit trail with chain hashing (append-only, immutable)
- `config_settings` - Business rule configuration
- `notifications` - SMS/Email delivery tracking

### Key Features

✓ **Field-level encryption** for sensitive PII (AES-256-GCM)  
✓ **Optimistic locking** with version columns  
✓ **Soft deletes** with deleted_at timestamps  
✓ **Append-only tables** for audit trail  
✓ **Double-entry bookkeeping** enforced by triggers  
✓ **Tamper-evident audit log** with chain hashing  
✓ **All money as integers** (kobo, not floating point)

## Troubleshooting

### Error: "database does not exist"

Create the database first:

```bash
createdb vigilant_cooperative
```

### Error: "permission denied"

Grant permissions to your PostgreSQL user:

```bash
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE vigilant_cooperative TO your_user;"
```

### Error: "relation already exists"

Drop and recreate the database:

```bash
dropdb vigilant_cooperative
createdb vigilant_cooperative
npm run db:setup
```

### Error: "pgcrypto extension not found"

Install PostgreSQL contrib package:

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-contrib

# macOS (Homebrew)
brew install postgresql@16

# Then enable in database
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

### Migration Fails

Check PostgreSQL logs:

```bash
# Ubuntu/Debian
tail -f /var/log/postgresql/postgresql-16-main.log

# macOS (Homebrew)
tail -f /usr/local/var/log/postgres.log
```

### Seed Fails

Ensure all environment variables are set:

```bash
echo $DATABASE_URL
echo $FIELD_ENCRYPTION_KEY
echo $BCRYPT_PEPPER
echo $HASH_SALT
echo $ADMIN_PASSWORD
```

## Production Deployment

### 1. Use Managed PostgreSQL

Recommended providers:
- **Neon** - Serverless PostgreSQL with branching
- **Supabase** - PostgreSQL with built-in auth and storage
- **Railway** - Simple PostgreSQL deployment
- **AWS RDS** - Enterprise-grade managed PostgreSQL

### 2. Secure Environment Variables

Never commit `.env` files. Use:
- **Vercel** - Environment variables in project settings
- **Railway** - Environment variables in service settings
- **AWS Secrets Manager** - For AWS deployments
- **HashiCorp Vault** - For enterprise deployments

### 3. Enable SSL/TLS

Update `DATABASE_URL` to use SSL:

```env
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

### 4. Rotate Keys Regularly

Schedule key rotation:
- **JWT_SECRET** - Every 90 days
- **FIELD_ENCRYPTION_KEY** - Annually
- **BCRYPT_PEPPER** - Every 90 days
- **Database password** - Every 90 days

### 5. Backup Strategy

Set up automated backups:
- **Daily backups** with 30-day retention
- **Point-in-time recovery** enabled
- **Test restore** monthly

### 6. Monitoring

Monitor database health:
- Connection pool usage
- Query performance (slow query log)
- Disk space usage
- Replication lag (if using read replicas)

## Security Checklist

Before going to production:

- [ ] Change admin password from default
- [ ] Generate strong encryption keys (not defaults)
- [ ] Enable SSL/TLS for database connections
- [ ] Set up database backups
- [ ] Configure firewall rules (restrict database access)
- [ ] Enable audit logging
- [ ] Set up monitoring and alerts
- [ ] Test disaster recovery procedure
- [ ] Document key rotation process
- [ ] Review and update .gitignore (ensure .env is excluded)

## Next Steps

After database setup:

1. **Test the schema** - Run integration tests
2. **Implement services** - Build business logic layer
3. **Create API endpoints** - Expose functionality via REST API
4. **Build frontend** - Connect UI to backend
5. **Deploy** - Push to production

## Support

For issues or questions:

- Check `server/db/README.md` for detailed schema documentation
- Review design document: `.kiro/specs/vigilant-cooperative-platform/design.md`
- Review requirements: `.kiro/specs/vigilant-cooperative-platform/requirements.md`

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL 16 Documentation](https://www.postgresql.org/docs/16/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
