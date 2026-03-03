CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(50) NOT NULL,
	"resource_type" varchar(50),
	"resource_id" uuid,
	"previous_value" jsonb,
	"new_value" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"chain_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chart_of_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_code" varchar(10) NOT NULL,
	"account_name" varchar(100) NOT NULL,
	"account_type" varchar(20) NOT NULL,
	"parent_code" varchar(10),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chart_of_accounts_account_code_unique" UNIQUE("account_code"),
	CONSTRAINT "chart_of_accounts_account_type_check" CHECK ("chart_of_accounts"."account_type" IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "config_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"value_type" varchar(20) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "config_settings_key_unique" UNIQUE("key"),
	CONSTRAINT "config_settings_value_type_check" CHECK ("config_settings"."value_type" IN ('INTEGER', 'DECIMAL', 'BOOLEAN', 'STRING', 'JSON'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_id" uuid NOT NULL,
	"account_code" varchar(10) NOT NULL,
	"entry_type" varchar(10) NOT NULL,
	"amount_kobo" integer NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_entry_type_check" CHECK ("ledger_entries"."entry_type" IN ('DEBIT', 'CREDIT')),
	CONSTRAINT "ledger_entries_amount_check" CHECK ("ledger_entries"."amount_kobo" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loan_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"approver_id" uuid NOT NULL,
	"approver_role" varchar(20) NOT NULL,
	"action" varchar(20) NOT NULL,
	"previous_amount_kobo" integer,
	"new_amount_kobo" integer,
	"comments" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loan_approvals_action_check" CHECK ("loan_approvals"."action" IN ('APPROVED', 'REJECTED', 'AMOUNT_OVERRIDE'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loan_guarantors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"guarantor_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"consented_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loan_guarantors_loan_guarantor_unique" UNIQUE("loan_id","guarantor_id"),
	CONSTRAINT "loan_guarantors_status_check" CHECK ("loan_guarantors"."status" IN ('PENDING', 'CONSENTED', 'DECLINED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loan_repayments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"amount_kobo" integer NOT NULL,
	"payment_date" date NOT NULL,
	"payment_reference" varchar(50) NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loan_repayments_amount_check" CHECK ("loan_repayments"."amount_kobo" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_reference" varchar(20) NOT NULL,
	"applicant_id" uuid NOT NULL,
	"loan_type" varchar(20) NOT NULL,
	"principal_kobo" integer NOT NULL,
	"interest_rate_bps" integer NOT NULL,
	"interest_kobo" integer NOT NULL,
	"total_repayable_kobo" integer NOT NULL,
	"monthly_installment_kobo" integer NOT NULL,
	"outstanding_kobo" integer NOT NULL,
	"repayment_months" integer NOT NULL,
	"purpose" varchar(100) NOT NULL,
	"purpose_detail" text,
	"status" varchar(30) DEFAULT 'SUBMITTED' NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"disbursed_at" timestamp,
	"completed_at" timestamp,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"rejected_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "loans_loan_reference_unique" UNIQUE("loan_reference"),
	CONSTRAINT "loans_status_check" CHECK ("loans"."status" IN ('SUBMITTED', 'GUARANTOR_CONSENT', 'PRESIDENT_REVIEW', 'COMMITTEE_REVIEW', 'TREASURER_REVIEW', 'DISBURSED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'CANCELLED')),
	CONSTRAINT "loans_loan_type_check" CHECK ("loans"."loan_type" IN ('SHORT_TERM', 'LONG_TERM'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member_exits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exit_reference" varchar(20) NOT NULL,
	"status" varchar(30) DEFAULT 'INITIATED' NOT NULL,
	"normal_savings_balance_kobo" integer NOT NULL,
	"special_savings_balance_kobo" integer NOT NULL,
	"outstanding_loans_kobo" integer NOT NULL,
	"guarantor_exposure_kobo" integer NOT NULL,
	"final_payout_kobo" integer NOT NULL,
	"settlement_pdf_url" text,
	"initiated_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"disbursed_at" timestamp,
	"approved_by" uuid,
	"disbursed_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "member_exits_exit_reference_unique" UNIQUE("exit_reference"),
	CONSTRAINT "member_exits_status_check" CHECK ("member_exits"."status" IN ('INITIATED', 'CALCULATED', 'TREASURER_REVIEW', 'APPROVED', 'DISBURSED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"channel" varchar(20) NOT NULL,
	"subject" varchar(255),
	"body" text NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_status_check" CHECK ("notifications"."status" IN ('PENDING', 'SENT', 'FAILED', 'DELIVERED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_deductions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"normal_savings_kobo" integer DEFAULT 0 NOT NULL,
	"special_savings_kobo" integer DEFAULT 0 NOT NULL,
	"loan_repayment_kobo" integer DEFAULT 0 NOT NULL,
	"loan_id" uuid,
	"other_deductions_kobo" integer DEFAULT 0 NOT NULL,
	"other_description" text,
	"total_deduction_kobo" integer NOT NULL,
	"discrepancy_flag" boolean DEFAULT false,
	"discrepancy_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_reference" varchar(20) NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"status" varchar(20) DEFAULT 'UPLOADED' NOT NULL,
	"file_url" text NOT NULL,
	"total_members" integer,
	"total_amount_kobo" integer,
	"parsed_at" timestamp,
	"confirmed_at" timestamp,
	"uploaded_by" uuid NOT NULL,
	"confirmed_by" uuid,
	"error_log" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_imports_import_reference_unique" UNIQUE("import_reference"),
	CONSTRAINT "payroll_imports_status_check" CHECK ("payroll_imports"."status" IN ('UPLOADED', 'PARSING', 'PARSED', 'CONFIRMED', 'FAILED'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "savings_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_type" varchar(20) NOT NULL,
	"balance_kobo" integer DEFAULT 0 NOT NULL,
	"is_locked" boolean DEFAULT false,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "savings_accounts_user_account_type_unique" UNIQUE("user_id","account_type"),
	CONSTRAINT "savings_accounts_balance_check" CHECK ("savings_accounts"."balance_kobo" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"direction" varchar(10) NOT NULL,
	"amount_kobo" integer NOT NULL,
	"balance_after_kobo" integer NOT NULL,
	"reference" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "transactions_reference_unique" UNIQUE("reference"),
	CONSTRAINT "transactions_direction_check" CHECK ("transactions"."direction" IN ('CREDIT', 'DEBIT')),
	CONSTRAINT "transactions_amount_check" CHECK ("transactions"."amount_kobo" > 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" varchar(20) NOT NULL,
	"employee_id_encrypted" text NOT NULL,
	"phone_encrypted" text NOT NULL,
	"bvn_encrypted" text,
	"salary_reference_kobo_encrypted" text,
	"totp_secret_encrypted" text,
	"employee_id_hash" varchar(64) NOT NULL,
	"phone_hash" varchar(64) NOT NULL,
	"bvn_hash" varchar(64),
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255),
	"department" varchar(100),
	"employment_status" varchar(20) DEFAULT 'ACTIVE',
	"date_joined" date NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"mfa_enabled" boolean DEFAULT false,
	"failed_login_count" integer DEFAULT 0,
	"locked_until" timestamp,
	"is_approved" boolean DEFAULT false,
	"approved_by" uuid,
	"approved_at" timestamp,
	"monnify_account_reference" varchar(50),
	"monnify_virtual_account_no" varchar(20),
	"monnify_bank_name" varchar(100),
	"monnify_account_name" varchar(255),
	"bvn_verified" boolean DEFAULT false,
	"roles" text[] DEFAULT ARRAY['MEMBER']::text[],
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_member_id_unique" UNIQUE("member_id"),
	CONSTRAINT "users_phone_hash_unique" UNIQUE("phone_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_number" varchar(20) NOT NULL,
	"voucher_type" varchar(50) NOT NULL,
	"amount_kobo" integer NOT NULL,
	"description" text,
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid NOT NULL,
	"posted_at" timestamp,
	"reversed_at" timestamp,
	"document_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "vouchers_voucher_number_unique" UNIQUE("voucher_number"),
	CONSTRAINT "vouchers_status_check" CHECK ("vouchers"."status" IN ('DRAFT', 'POSTED', 'REVERSED'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "config_settings" ADD CONSTRAINT "config_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_voucher_id_vouchers_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."vouchers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loan_approvals" ADD CONSTRAINT "loan_approvals_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loan_approvals" ADD CONSTRAINT "loan_approvals_approver_id_users_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loan_guarantors" ADD CONSTRAINT "loan_guarantors_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loan_guarantors" ADD CONSTRAINT "loan_guarantors_guarantor_id_users_id_fk" FOREIGN KEY ("guarantor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loans" ADD CONSTRAINT "loans_applicant_id_users_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loans" ADD CONSTRAINT "loans_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_exits" ADD CONSTRAINT "member_exits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_exits" ADD CONSTRAINT "member_exits_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "member_exits" ADD CONSTRAINT "member_exits_disbursed_by_users_id_fk" FOREIGN KEY ("disbursed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_import_id_payroll_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."payroll_imports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_deductions" ADD CONSTRAINT "payroll_deductions_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_imports" ADD CONSTRAINT "payroll_imports_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_imports" ADD CONSTRAINT "payroll_imports_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_savings_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."savings_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_user_id_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_resource_type_idx" ON "audit_log" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_resource_id_idx" ON "audit_log" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chart_of_accounts_account_code_idx" ON "chart_of_accounts" USING btree ("account_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chart_of_accounts_account_type_idx" ON "chart_of_accounts" USING btree ("account_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "config_settings_key_idx" ON "config_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_voucher_id_idx" ON "ledger_entries" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_account_code_idx" ON "ledger_entries" USING btree ("account_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_account_code_created_at_idx" ON "ledger_entries" USING btree ("account_code","created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loan_approvals_loan_id_idx" ON "loan_approvals" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loan_approvals_loan_id_created_at_idx" ON "loan_approvals" USING btree ("loan_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loan_approvals_approver_id_idx" ON "loan_approvals" USING btree ("approver_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loan_guarantors_loan_id_idx" ON "loan_guarantors" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loan_guarantors_guarantor_id_idx" ON "loan_guarantors" USING btree ("guarantor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loan_guarantors_guarantor_id_status_idx" ON "loan_guarantors" USING btree ("guarantor_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loan_repayments_loan_id_idx" ON "loan_repayments" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loan_repayments_loan_id_payment_date_idx" ON "loan_repayments" USING btree ("loan_id","payment_date" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loan_repayments_payment_reference_idx" ON "loan_repayments" USING btree ("payment_reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loans_loan_reference_idx" ON "loans" USING btree ("loan_reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loans_applicant_id_status_idx" ON "loans" USING btree ("applicant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loans_status_idx" ON "loans" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loans_status_submitted_at_idx" ON "loans" USING btree ("status","submitted_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_exits_user_id_idx" ON "member_exits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_exits_status_idx" ON "member_exits" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_exits_exit_reference_idx" ON "member_exits" USING btree ("exit_reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications" USING btree ("created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_deductions_import_id_idx" ON "payroll_deductions" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_deductions_user_id_idx" ON "payroll_deductions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_deductions_import_id_user_id_idx" ON "payroll_deductions" USING btree ("import_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_imports_import_reference_idx" ON "payroll_imports" USING btree ("import_reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_imports_period_year_month_idx" ON "payroll_imports" USING btree ("period_year","period_month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_imports_status_idx" ON "payroll_imports" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "savings_accounts_user_id_idx" ON "savings_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "savings_accounts_user_account_type_idx" ON "savings_accounts" USING btree ("user_id","account_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_user_id_created_at_idx" ON "transactions" USING btree ("user_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_account_id_created_at_idx" ON "transactions" USING btree ("account_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_reference_idx" ON "transactions" USING btree ("reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_employee_id_hash_idx" ON "users" USING btree ("employee_id_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_phone_hash_idx" ON "users" USING btree ("phone_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_bvn_hash_idx" ON "users" USING btree ("bvn_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_member_id_idx" ON "users" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_is_approved_idx" ON "users" USING btree ("is_approved");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vouchers_voucher_number_idx" ON "vouchers" USING btree ("voucher_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vouchers_status_idx" ON "vouchers" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vouchers_created_at_idx" ON "vouchers" USING btree ("created_at" DESC);