# Quick Start Guide

Get the Vigilant Cooperative Platform running in 5 minutes.

## Prerequisites

- Node.js 24.x
- PostgreSQL 16+ running
- Redis 7+ running

## Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Create Environment File
```bash
cp .env.example .env
```

### 3. Generate Secure Keys

Run these commands and paste the output into your `.env` file:

```bash
# Generate all keys at once
echo "FIELD_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
echo "BCRYPT_PEPPER=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
echo "HASH_SALT=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
```

### 4. Update Database URL in `.env`
```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/vigilant_cooperative
```

### 5. Create Database
```bash
createdb vigilant_cooperative
```

### 6. Run Migrations
```bash
npm run db:setup
```

### 7. Start Servers

**Option A: Two Terminals (Recommended)**
```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev
```

**Option B: Single Terminal (requires concurrently)**
```bash
npm install -D concurrently
npm run dev:all
```

## Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## Default Admin Credentials

- **Email**: admin@vigilant.coop
- **Password**: Admin123! (or whatever you set in ADMIN_PASSWORD)

## Verify Setup

Test the backend:
```bash
curl http://localhost:3001/health
```

Test authentication:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vigilant.coop","password":"Admin123!"}'
```

## Troubleshooting

**PostgreSQL not running?**
```bash
# macOS
brew services start postgresql@16

# Ubuntu/Debian
sudo systemctl start postgresql
```

**Redis not running?**
```bash
# macOS
brew services start redis

# Ubuntu/Debian
sudo systemctl start redis-server
```

**Need detailed setup instructions?**
See [DEVELOPMENT_SETUP.md](./DEVELOPMENT_SETUP.md)

## Next Steps

1. ✅ Landing page at http://localhost:3000
2. ✅ Login at http://localhost:3000/login
3. 🔜 Continue building features (tasks 11-14)
