# Vercel Deployment Guide

## Architecture

This is a monolithic Next.js application with a hybrid backend approach:

### Development Mode
- Fastify backend runs on port 3001
- Next.js frontend runs on port 3000
- Next.js proxies `/api/v1/*` requests to Fastify via `next.config.ts` rewrites

### Production Mode (Vercel)
- Next.js API routes handle backend requests directly
- No Fastify server (serverless environment)
- Database and Redis connections initialized per-request

## Current Status

### ✅ Implemented Next.js API Routes

#### Auth Routes
- `/api/v1/auth/login` - User authentication
- `/api/v1/auth/register` - User registration
- `/api/v1/auth/logout` - User logout
- `/api/v1/auth/forgot-password` - Request password reset
- `/api/v1/auth/reset-password` - Reset password with OTP

#### Member Routes
- `/api/v1/members/me` - Get/update user profile

#### Notification Routes
- `/api/v1/notifications` - Get user notifications
- `/api/v1/notifications/[id]/read` - Mark notification as read
- `/api/v1/notifications/read-all` - Mark all notifications as read

#### Savings Routes
- `/api/v1/savings/accounts` - Get savings accounts
- `/api/v1/savings/transactions` - Get transaction history

#### Loan Routes
- `/api/v1/loans` - Get user loans

### ⚠️ Still Using Fastify (Development Only)
All other routes in `server/routes/` are only available in development mode. You'll need to create Next.js API routes for any endpoints you use in production.

## Creating New API Routes

When you encounter a missing endpoint in production, create a Next.js API route:

1. Create file: `app/api/v1/[endpoint]/route.ts`
2. Copy logic from corresponding Fastify route in `server/routes/`
3. Replace Fastify-specific code:
   - `fastify.authenticate` → Manual JWT verification with `verifyAccessToken()`
   - `request.user` → Extract from decoded JWT
   - `reply.send()` → `NextResponse.json()`
   - `fastify.log` → `console.log/error`

### Example Template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/server/db/init';
import { successResponse, errorResponse, ErrorCode } from '@/utils/api-response';
import { verifyAccessToken } from '@/utils/jwt';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        errorResponse(ErrorCode.UNAUTHORIZED, 'Missing authorization', requestId),
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = await verifyAccessToken(token);
    const userId = decoded.userId;

    // Your logic here
    
    return NextResponse.json(successResponse({ data: 'result' }, requestId));
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.INTERNAL_ERROR, 'Operation failed', requestId),
      { status: 500 }
    );
  }
}
```

## Deployment Checklist

Before deploying to Vercel:

1. ✅ Remove `api/index.ts` (serverless function approach)
2. ✅ Remove `vercel.json` (not needed for Next.js API routes)
3. ✅ Create Next.js API routes for all production endpoints
4. ✅ Set environment variables in Vercel dashboard
5. ✅ Test authentication flow
6. ✅ Verify database connections work in serverless environment

## Environment Variables

Ensure these are set in Vercel:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string  
- `JWT_SECRET` - JWT signing secret (64+ characters)
- All other variables from `.env.example`

## Known Issues

### 508 Loop Detected (FIXED)
- **Cause**: `next.config.ts` rewrite creating infinite loop in production
- **Fix**: Rewrites only active in development mode

### 500 Internal Server Error (FIXED)
- **Cause**: Fastify serverless function failing due to missing initialization
- **Fix**: Use Next.js API routes instead of Fastify serverless function

## Next Steps

As you use the application in production, you'll encounter missing endpoints. For each one:

1. Check the browser console/network tab for the failing endpoint
2. Find the corresponding Fastify route in `server/routes/`
3. Create a Next.js API route following the template above
4. Deploy and test

## Migration Progress

Track which Fastify routes have been migrated to Next.js API routes:

### Auth Routes (`server/routes/auth.ts`)
- [x] POST `/api/v1/auth/login`
- [x] POST `/api/v1/auth/register`
- [ ] POST `/api/v1/auth/refresh`
- [x] POST `/api/v1/auth/logout`
- [x] POST `/api/v1/auth/forgot-password`
- [x] POST `/api/v1/auth/reset-password`

### Notification Routes (`server/routes/notifications.ts`)
- [x] GET `/api/v1/notifications`
- [x] PATCH `/api/v1/notifications/:id/read`
- [x] PATCH `/api/v1/notifications/read-all`

### Savings Routes (`server/routes/savings.ts`)
- [x] GET `/api/v1/savings/accounts`
- [x] GET `/api/v1/savings/transactions`
- [ ] POST `/api/v1/savings/withdraw`
- [ ] POST `/api/v1/savings/deposit`
- [ ] POST `/api/v1/savings/credit`

### Member Routes (`server/routes/members.ts`)
- [x] GET `/api/v1/members/me`
- [x] PATCH `/api/v1/members/me`
- [ ] GET `/api/v1/members/:id`
- [ ] PATCH `/api/v1/members/:id`
- [ ] PATCH `/api/v1/members/:id/approve`
- [ ] GET `/api/v1/members/pending`

### Loan Routes (`server/routes/loans.ts`)
- [x] GET `/api/v1/loans`
- [ ] GET `/api/v1/loans/eligibility`
- [ ] POST `/api/v1/loans/apply`
- [ ] GET `/api/v1/loans/:id`
- [ ] PATCH `/api/v1/loans/:id/approve`
- [ ] PATCH `/api/v1/loans/:id/disburse`
- [ ] POST `/api/v1/loans/:id/repay`

### Ledger Routes (`server/routes/ledger.ts`)
- [ ] All endpoints need migration

### Payroll Routes (`server/routes/payroll.ts`)
- [ ] All endpoints need migration

### Admin Routes
- [ ] All endpoints need migration
