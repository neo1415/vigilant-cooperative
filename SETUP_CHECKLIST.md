# Setup Checklist

Use this checklist to verify your development environment is ready.

## External Services

- [ ] PostgreSQL 16+ installed and running
  ```bash
  psql --version
  pg_isready
  ```

- [ ] Redis 7+ installed and running
  ```bash
  redis-cli ping
  # Should return: PONG
  ```

- [ ] Database created
  ```bash
  psql -U postgres -c "\l" | grep vigilant_cooperative
  ```

## Project Setup

- [ ] Dependencies installed
  ```bash
  ls node_modules | wc -l
  # Should show many packages
  ```

- [ ] `.env` file created from `.env.example`
  ```bash
  test -f .env && echo "✓ .env exists" || echo "✗ .env missing"
  ```

- [ ] Environment variables configured
  - [ ] `DATABASE_URL` set to your PostgreSQL connection string
  - [ ] `REDIS_URL` set (default: redis://localhost:6379)
  - [ ] `FIELD_ENCRYPTION_KEY` generated (64 hex chars)
  - [ ] `BCRYPT_PEPPER` generated
  - [ ] `HASH_SALT` generated
  - [ ] `JWT_SECRET` generated
  - [ ] `ADMIN_PASSWORD` set

## Database Setup

- [ ] Migrations generated
  ```bash
  ls drizzle/migrations/*.sql
  ```

- [ ] Migrations applied
  ```bash
  psql $DATABASE_URL -c "\dt" | grep users
  # Should show users table
  ```

- [ ] Triggers created
  ```bash
  psql $DATABASE_URL -c "\df" | grep check_ledger_balance
  # Should show trigger functions
  ```

- [ ] Seed data loaded
  ```bash
  psql $DATABASE_URL -c "SELECT COUNT(*) FROM chart_of_accounts;"
  # Should return 11
  
  psql $DATABASE_URL -c "SELECT COUNT(*) FROM config_settings;"
  # Should return 9
  
  psql $DATABASE_URL -c "SELECT member_id FROM users WHERE email='admin@vigilant.coop';"
  # Should return VIG-2026-001
  ```

## Application Running

- [ ] Backend server starts without errors
  ```bash
  # In one terminal:
  npm run dev:backend
  # Should see: Server listening on http://localhost:3001
  ```

- [ ] Frontend server starts without errors
  ```bash
  # In another terminal:
  npm run dev
  # Should see: Local: http://localhost:3000
  ```

- [ ] Backend health check passes
  ```bash
  curl http://localhost:3001/health
  # Should return: {"status":"ok",...}
  ```

- [ ] Frontend loads in browser
  - Open http://localhost:3000
  - Should see landing page with animations

## Authentication Testing

- [ ] Login page loads
  - Open http://localhost:3000/login
  - Should see login form

- [ ] Register page loads
  - Open http://localhost:3000/register
  - Should see registration form

- [ ] Backend login endpoint works
  ```bash
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@vigilant.coop","password":"Admin123!"}'
  # Should return access token
  ```

- [ ] Can login via frontend
  - Go to http://localhost:3000/login
  - Enter: admin@vigilant.coop / Admin123!
  - Should redirect (or show success)

## Code Quality

- [ ] TypeScript compiles without errors
  ```bash
  npx tsc --noEmit
  # Should complete with no errors
  ```

- [ ] ESLint passes
  ```bash
  npm run lint
  # Should show no errors
  ```

- [ ] Tests run (when implemented)
  ```bash
  npm test
  # Should pass all tests
  ```

## Optional Services (Not Required Yet)

- [ ] Monnify API keys (for payment integration)
- [ ] Termii API key (for SMS notifications)
- [ ] Resend API key (for email notifications)
- [ ] Cloudflare R2 credentials (for document storage)

## Ready to Continue?

If all checkboxes above are checked, you're ready to continue with:
- ✅ Tasks 1-10: Complete
- 🔜 Tasks 11-14: Member Management, Savings, Loans, etc.

## Troubleshooting

If any checks fail, see:
- [QUICKSTART.md](./QUICKSTART.md) - Fast setup guide
- [DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md) - Detailed setup guide
- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - Database-specific guide
