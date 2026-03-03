-- Delete All Users Script
-- WARNING: This will delete ALL users and their data!
-- This action cannot be undone!
-- Run this in your PostgreSQL client or pgAdmin

-- Start transaction
BEGIN;

-- Show count before deletion
SELECT COUNT(*) as total_users FROM users;

-- Delete all loan payments
DELETE FROM loan_payments;

-- Delete all loans
DELETE FROM loans;

-- Delete all savings transactions
DELETE FROM savings_transactions;

-- Delete all savings accounts
DELETE FROM savings_accounts;

-- Delete all users
DELETE FROM users;

-- Commit the transaction
COMMIT;

-- Verify deletion
SELECT COUNT(*) as remaining_users FROM users;
SELECT COUNT(*) as remaining_savings_accounts FROM savings_accounts;
SELECT COUNT(*) as remaining_loans FROM loans;
