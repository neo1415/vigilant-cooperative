# Supabase Manual Setup Guide

Since direct PostgreSQL connection is blocked by your network/firewall, we'll use Supabase's SQL Editor instead.

## Step 1: Open Supabase SQL Editor

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project: `vigilant-cooperative`
3. Click on "SQL Editor" in the left sidebar

## Step 2: Run Migrations

Copy and paste the contents of these files into the SQL Editor and run them **in this order**:

### File 1: Main Schema (Tables and Indexes)
**Location**: `drizzle/migrations/0000_parched_grandmaster.sql`

1. Open the file in your editor
2. Copy ALL the contents
3. Paste into Supabase SQL Editor
4. Click "Run" button
5. Wait for success message

### File 2: Triggers and Constraints
**Location**: `server/db/triggers.sql`

1. Open the file in your editor
2. Copy ALL the contents
3. Paste into Supabase SQL Editor
4. Click "Run" button
5. Wait for success message

## Step 3: Verify Tables Were Created

In Supabase SQL Editor, run this query:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see 16 tables:
- audit_log
- chart_of_accounts
- config_settings
- ledger_entries
- loan_approvals
- loan_guarantors
- loan_repayments
- loans
- member_exits
- notifications
- payroll_deductions
- payroll_imports
- savings_accounts
- transactions
- users
- vouchers

## Step 4: Run Seed Data

After migrations are complete, run the seed script locally:

```bash
npm run db:seed
```

This will:
- Create 11 chart of accounts entries
- Create 9 config settings
- Create admin user (VIG-2026-001)

## Troubleshooting

### If migrations fail:

1. Check the error message in Supabase SQL Editor
2. Most common issues:
   - Extension not enabled: Run `CREATE EXTENSION IF NOT EXISTS pgcrypto;` first
   - Table already exists: Drop tables and try again
   - Syntax error: Make sure you copied the entire file

### If seed fails:

Make sure the `.env` file has the correct DATABASE_URL with URL-encoded password.

## Next Steps

Once migrations and seed are complete:
1. Start the backend: `npm run dev:backend`
2. Start the frontend: `npm run dev`
3. Test login at http://localhost:3000/login

## Alternative: Use Supabase Studio

You can also view your tables in Supabase Studio:
1. Go to "Table Editor" in Supabase dashboard
2. You should see all 16 tables listed
3. Click any table to view its structure and data
