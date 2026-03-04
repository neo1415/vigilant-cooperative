# Debugging Authentication Issues

## Current Status

You've successfully:
✅ Created admin account (VIG-2026-001 / Admin123!)
✅ Unlocked the account
✅ Fixed password hashing to match auth service
✅ Got past "invalid credentials" error
✅ Got past "account locked" error
✅ Logged in successfully

But now experiencing:
❌ 401 Unauthorized errors when accessing dashboard
❌ `savings.find is not a function` error (FIXED in dashboard/page.tsx)

## Root Cause Analysis

The 401 errors suggest the JWT token isn't being sent with API requests. Possible causes:

1. **Token not stored in localStorage** - Login page might not be calling `setToken()`
2. **Token stored but not sent** - API client might not be reading from localStorage
3. **Token format issue** - Backend might not be recognizing the token format
4. **CORS issue** - Browser might be blocking the Authorization header

## Debugging Steps

### Step 1: Check if Token is Stored

1. Open browser Developer Tools (F12)
2. Go to **Application** tab
3. Expand **Local Storage** in the left sidebar
4. Click on `http://localhost:3000`
5. Look for `auth_token` key

**Expected**: You should see a JWT token (long string starting with `eyJ...`)
**If missing**: The login page isn't storing the token correctly

### Step 2: Check if Token is Being Sent

1. Open browser Developer Tools (F12)
2. Go to **Network** tab
3. Refresh the dashboard page
4. Click on one of the failed API requests (the ones showing 401)
5. Click on **Headers** tab
6. Scroll down to **Request Headers**
7. Look for `Authorization: Bearer eyJ...`

**Expected**: You should see the Authorization header with your token
**If missing**: The API client isn't reading the token from localStorage

### Step 3: Check Token Expiration

If the token exists but requests still fail:

1. Copy the token from localStorage
2. Go to https://jwt.io
3. Paste the token in the "Encoded" section
4. Check the `exp` field in the decoded payload
5. Compare with current time (exp is in seconds since epoch)

**Expected**: `exp` should be in the future
**If expired**: You need to login again

### Step 4: Check Backend is Running

1. Open a new terminal
2. Run: `curl http://localhost:3001/api/v1/health` (or visit in browser)

**Expected**: You should get a response
**If connection refused**: Backend server isn't running

## Quick Fixes

### Fix 1: Ensure Backend is Running

```bash
cd vigilant-cooperative
npm run dev:backend
```

Keep this terminal open. In another terminal:

```bash
cd vigilant-cooperative
npm run dev:frontend
```

### Fix 2: Clear Browser Data and Re-login

1. Open Developer Tools (F12)
2. Go to Application tab
3. Click "Clear site data" button
4. Refresh the page
5. Login again with VIG-2026-001 / Admin123!

### Fix 3: Check if Database is Running

The backend needs PostgreSQL. If using Docker:

```bash
cd vigilant-cooperative
docker-compose up -d
```

## Manual Test

You can test the full flow manually:

```bash
cd vigilant-cooperative
npx tsx scripts/test-login.ts
```

This will:
1. Login with admin credentials
2. Get a token
3. Fetch savings accounts
4. Fetch loans

If this works, the backend is fine and the issue is in the frontend.

## Common Issues

### Issue: "Invalid credentials" even with correct password

**Cause**: Password hashing mismatch
**Fix**: Run `npx tsx scripts/create-admin.ts` to recreate admin with correct hash

### Issue: "Account is locked"

**Cause**: Too many failed login attempts
**Fix**: Run `npx tsx scripts/unlock-admin.ts` (requires database running)

### Issue: 401 Unauthorized after successful login

**Cause**: Token not being sent with requests
**Fix**: Check Steps 1 and 2 above

### Issue: `savings.find is not a function`

**Cause**: API response structure mismatch (FIXED)
**Fix**: Already fixed in dashboard/page.tsx

## Next Steps

1. Follow the debugging steps above
2. Report what you find:
   - Is `auth_token` in localStorage?
   - Is `Authorization` header being sent?
   - Is the backend running?
3. Based on findings, we can apply the appropriate fix

## Contact Points

If you're still stuck, provide:
- Screenshot of localStorage (Application tab)
- Screenshot of failed request headers (Network tab)
- Output of `npm run dev` command
- Any error messages in browser console
