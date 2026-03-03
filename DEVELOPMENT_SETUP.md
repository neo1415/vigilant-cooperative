# Development Setup Guide

This guide walks you through setting up your local development environment to run the Vigilant Cooperative Platform.

## Prerequisites

Before you begin, install these on your machine:

- **Node.js 24.x LTS** - [Download](https://nodejs.org/)
- **PostgreSQL 16+** - [Download](https://www.postgresql.org/download/)
- **Redis 7+** - [Download](https://redis.io/download/)
- **Git** - [Download](https://git-scm.com/)

## Step 1: Install PostgreSQL

### macOS (Homebrew)
```bash
brew install postgresql@16
brew services start postgresql@16
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Windows
Download and install from [PostgreSQL Downloads](https://www.postgresql.org/download/windows/)

### Verify Installation
```bash
psql --version
# Should output: psql (PostgreSQL) 16.x
```

## Step 2: Install Redis

### macOS (Homebrew)
```bash
brew install redis
brew services start redis
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Windows
Download from [Redis Windows](https://github.com/microsoftarchive/redis/releases) or use WSL2

### Verify Installation
```bash
redis-cli ping
# Should output: PONG
```

## Step 3: Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE vigilant_cooperative;

# Create user (optional, for better security)
CREATE USER vigilant_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE vigilant_cooperative TO vigilant_user;

# Exit psql
\q
```

## Step 4: Clone and Install Dependencies

```bash
cd vigilant-cooperative
npm install
```

## Step 5: Configure Environment Variables

Create `.env` file from the example:

```bash
cp .env.example .env
```

Now edit `.env` and update these critical values:

### Database Configuration
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/vigilant_cooperative
```

### Redis Configuration
```env
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
```

### Generate Encryption Keys

Run these commands to generate secure keys:

```bash
# Field encryption key (64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Bcrypt pepper (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Hash salt (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# JWT secret (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output and paste into your `.env`:

```env
FIELD_ENCRYPTION_KEY=<paste 64 hex chars here>
BCRYPT_PEPPER=<paste base64 string here>
HASH_SALT=<paste base64 string here>
JWT_SECRET=<paste base64 string here>
```

### Admin Password
```env
ADMIN_PASSWORD=YourSecurePassword123!
```

### Application URLs
```env
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3001
```

## Step 6: Run Database Migrations

This creates all tables, triggers, and seeds initial data:

```bash
npm run db:setup
```

You should see:
```
✓ Drizzle migrations completed
✓ Database triggers applied
✓ All migrations completed successfully!
✓ Seeded 11 chart of accounts entries
✓ Seeded 9 config settings
✓ Seeded admin user
  Member ID: VIG-2026-001
  Email: admin@vigilant.coop
```

## Step 7: Verify Database Setup

```bash
# Check tables were created
psql $DATABASE_URL -c "\dt"

# Check admin user was created
psql $DATABASE_URL -c "SELECT member_id, full_name, email, roles FROM users;"
```

## Step 8: Start Development Servers

You need to run TWO servers in separate terminals:

### Terminal 1: Start Backend (Fastify)
```bash
cd vigilant-cooperative
tsx server/index.ts
```

You should see:
```
Server listening on http://localhost:3001
✓ PostgreSQL connected
✓ Redis connected
✓ BullMQ queues initialized
```

### Terminal 2: Start Frontend (Next.js)
```bash
cd vigilant-cooperative
npm run dev
```

You should see:
```
▲ Next.js 16.1.6
- Local:        http://localhost:3000
```

## Step 9: Test the Application

### Test Landing Page
Open browser: http://localhost:3000

You should see the landing page with:
- Animated hero section
- Trust marquee
- Features grid
- Theme toggle working

### Test Backend Health
```bash
curl http://localhost:3001/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2026-03-02T..."
}
```

### Test Authentication Endpoints

Register a new user:
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "fullName": "Test User",
    "employeeId": "EMP001",
    "phone": "+2348012345678",
    "department": "Engineering"
  }'
```

Login:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@vigilant.coop",
    "password": "Admin123!"
  }'
```

## Step 10: Test Frontend Authentication

1. Go to http://localhost:3000/login
2. Enter credentials:
   - Email: `admin@vigilant.coop`
   - Password: `Admin123!` (or whatever you set in ADMIN_PASSWORD)
3. Click "Sign In"
4. You should be redirected to the dashboard (when implemented)

## Troubleshooting

### PostgreSQL Connection Error

**Error:** `ECONNREFUSED` or `connection refused`

**Solution:**
```bash
# Check if PostgreSQL is running
pg_isready

# If not running, start it
# macOS
brew services start postgresql@16

# Ubuntu/Debian
sudo systemctl start postgresql
```

### Redis Connection Error

**Error:** `ECONNREFUSED` on port 6379

**Solution:**
```bash
# Check if Redis is running
redis-cli ping

# If not running, start it
# macOS
brew services start redis

# Ubuntu/Debian
sudo systemctl start redis-server
```

### Database Migration Fails

**Error:** `relation already exists`

**Solution:** Drop and recreate database
```bash
dropdb vigilant_cooperative
createdb vigilant_cooperative
npm run db:setup
```

### Environment Variables Not Loaded

**Error:** `JWT_SECRET is required`

**Solution:** Make sure `.env` file exists and has all required variables
```bash
# Check if .env exists
ls -la .env

# Verify it has content
cat .env | grep JWT_SECRET
```

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:** Kill the process using that port
```bash
# Find process on port 3000
lsof -ti:3000

# Kill it
kill -9 $(lsof -ti:3000)

# Or use a different port
PORT=3002 npm run dev
```

### TypeScript Compilation Errors

**Solution:** Rebuild TypeScript
```bash
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

## Development Workflow

### Daily Startup
```bash
# Terminal 1: Backend
cd vigilant-cooperative
tsx server/index.ts

# Terminal 2: Frontend
cd vigilant-cooperative
npm run dev
```

### Running Tests
```bash
npm test
```

### Checking Code Quality
```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Format
npx prettier --write .
```

### Database Management

View database in browser:
```bash
npm run db:studio
```

Reset database:
```bash
dropdb vigilant_cooperative
createdb vigilant_cooperative
npm run db:setup
```

## Optional: Docker Setup

If you prefer Docker for PostgreSQL and Redis:

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: vigilant_cooperative
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

Start services:
```bash
docker-compose up -d
```

Update `.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vigilant_cooperative
REDIS_URL=redis://localhost:6379
```

## Next Steps

After setup is complete:

1. ✅ Landing page is live at http://localhost:3000
2. ✅ Backend API is running at http://localhost:3001
3. ✅ Database is set up with admin user
4. ✅ Authentication endpoints are working
5. 🔜 Continue with tasks 11-14 (Member Management, Savings, etc.)

## External Services (For Later)

These services are configured in `.env.example` but not required for local development:

- **Monnify** - Payment gateway (sandbox mode available)
- **Termii** - SMS notifications (get API key from termii.com)
- **Resend** - Email notifications (get API key from resend.com)
- **Cloudflare R2** - Document storage (S3-compatible)

You can add these later when implementing those features.

## Support

If you encounter issues:

1. Check this guide's Troubleshooting section
2. Review `DATABASE_SETUP.md` for database-specific issues
3. Check server logs in the terminal
4. Verify all environment variables are set correctly

## Security Reminders

- ⚠️ Never commit `.env` file to git
- ⚠️ Change default admin password immediately
- ⚠️ Use strong encryption keys in production
- ⚠️ Enable SSL/TLS for production databases
- ⚠️ Rotate secrets regularly (every 90 days)
