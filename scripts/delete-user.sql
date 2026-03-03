-- Delete User Script
-- This will delete the user VIG-2026-002 and all related data
-- Run this in your PostgreSQL client or pgAdmin

-- Start transaction
BEGIN;

-- Get the user ID first (for reference)
SELECT id, member_id, full_name, email, department 
FROM users 
WHERE member_id = 'VIG-2026-002';

-- Delete loan payments (references loans)
DELETE FROM loan_payments 
WHERE user_id IN (SELECT id FROM users WHERE member_id = 'VIG-2026-002');

-- Delete loans
DELETE FROM loans 
WHERE user_id IN (SELECT id FROM users WHERE member_id = 'VIG-2026-002');

-- Delete savings transactions
DELETE FROM savings_transactions 
WHERE user_id IN (SELECT id FROM users WHERE member_id = 'VIG-2026-002');

-- Delete savings accounts
DELETE FROM savings_accounts 
WHERE user_id IN (SELECT id FROM users WHERE member_id = 'VIG-2026-002');

-- Delete the user
DELETE FROM users 
WHERE member_id = 'VIG-2026-002';

-- Commit the transaction
COMMIT;

-- Verify deletion
SELECT COUNT(*) as remaining_users FROM users WHERE member_id = 'VIG-2026-002';
