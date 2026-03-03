-- Database triggers and constraints for Vigilant Cooperative Platform
-- These triggers enforce business rules and maintain data integrity

-- ============================================================================
-- 1. Double-Entry Bookkeeping Enforcement Trigger
-- ============================================================================
-- Ensures that for every voucher, the sum of debits equals the sum of credits

CREATE OR REPLACE FUNCTION check_ledger_balance()
RETURNS TRIGGER AS $$
DECLARE
  debit_total  BIGINT;
  credit_total BIGINT;
BEGIN
  -- Calculate total debits and credits for the voucher
  SELECT 
    COALESCE(SUM(CASE WHEN entry_type = 'DEBIT'  THEN amount_kobo ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_kobo ELSE 0 END), 0)
  INTO debit_total, credit_total
  FROM ledger_entries
  WHERE voucher_id = NEW.voucher_id;
  
  -- Raise exception if debits don't equal credits
  IF debit_total != credit_total THEN
    RAISE EXCEPTION 'Unbalanced ledger entry for voucher %. Debits: %, Credits: %', 
      NEW.voucher_id, debit_total, credit_total;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create constraint trigger (deferred to end of transaction)
DROP TRIGGER IF EXISTS enforce_ledger_balance ON ledger_entries;
CREATE CONSTRAINT TRIGGER enforce_ledger_balance
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION check_ledger_balance();

-- ============================================================================
-- 2. Automatic Updated_At Timestamp Trigger
-- ============================================================================
-- Updates the updated_at column whenever a row is modified

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_savings_accounts_updated_at ON savings_accounts;
CREATE TRIGGER update_savings_accounts_updated_at
  BEFORE UPDATE ON savings_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_loans_updated_at ON loans;
CREATE TRIGGER update_loans_updated_at
  BEFORE UPDATE ON loans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_loan_guarantors_updated_at ON loan_guarantors;
CREATE TRIGGER update_loan_guarantors_updated_at
  BEFORE UPDATE ON loan_guarantors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_vouchers_updated_at ON vouchers;
CREATE TRIGGER update_vouchers_updated_at
  BEFORE UPDATE ON vouchers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_chart_of_accounts_updated_at ON chart_of_accounts;
CREATE TRIGGER update_chart_of_accounts_updated_at
  BEFORE UPDATE ON chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_payroll_imports_updated_at ON payroll_imports;
CREATE TRIGGER update_payroll_imports_updated_at
  BEFORE UPDATE ON payroll_imports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_member_exits_updated_at ON member_exits;
CREATE TRIGGER update_member_exits_updated_at
  BEFORE UPDATE ON member_exits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_config_settings_updated_at ON config_settings;
CREATE TRIGGER update_config_settings_updated_at
  BEFORE UPDATE ON config_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications;
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 3. Audit Log Chain Hash Trigger
-- ============================================================================
-- Computes chain hash for tamper detection in audit log

CREATE OR REPLACE FUNCTION compute_chain_hash()
RETURNS TRIGGER AS $$
DECLARE
  previous_hash VARCHAR(64);
  hash_input TEXT;
BEGIN
  -- Get the most recent chain hash
  SELECT chain_hash INTO previous_hash
  FROM audit_log
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Use genesis hash if this is the first record
  IF previous_hash IS NULL THEN
    previous_hash := 'GENESIS_HASH_VIGILANT_COOPERATIVE_2026';
  END IF;
  
  -- Compute hash input: previous_hash + created_at + new_value
  hash_input := previous_hash || 
                COALESCE(NEW.created_at::TEXT, '') || 
                COALESCE(NEW.new_value::TEXT, '');
  
  -- Compute SHA-256 hash (requires pgcrypto extension)
  NEW.chain_hash := encode(digest(hash_input, 'sha256'), 'hex');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit log
DROP TRIGGER IF EXISTS compute_audit_chain_hash ON audit_log;
CREATE TRIGGER compute_audit_chain_hash
  BEFORE INSERT ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION compute_chain_hash();

-- ============================================================================
-- 4. Enable pgcrypto extension for hashing
-- ============================================================================
-- Required for SHA-256 hashing in chain_hash computation

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 5. Additional Constraints
-- ============================================================================

-- Partial unique constraint: Only one CONFIRMED import per period
CREATE UNIQUE INDEX IF NOT EXISTS payroll_imports_period_confirmed_unique
  ON payroll_imports (period_month, period_year)
  WHERE status = 'CONFIRMED';

-- Ensure loan status transitions are valid (enforced at application layer)
-- Ensure guarantor consent before loan approval (enforced at application layer)

-- ============================================================================
-- End of triggers and constraints
-- ============================================================================
