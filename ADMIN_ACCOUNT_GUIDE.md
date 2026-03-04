# Admin Account & Member Approval Guide

## Admin Account Credentials

The database seed script has already created an admin account for you:

```
Member ID: VIG-2026-001
Email: admin@vigilant.coop
Password: Admin123!
```

This account has ALL roles:
- MEMBER
- ADMIN
- TREASURER
- SECRETARY
- PRESIDENT
- COMMITTEE

## How to Approve New Member Registrations

### Step 1: Login as Admin
1. Go to http://localhost:3000/login
2. Enter Member ID: `VIG-2026-001`
3. Enter Password: `Admin123!`
4. Click "Sign In"

### Step 2: Access Member Approval Page
After logging in, navigate to:
```
http://localhost:3000/admin/members/pending
```

This page shows all pending member registrations.

### Step 3: Approve Members
- Click the "Approve" button next to each pending member
- The member will receive an SMS notification (if SMS is configured)
- The member can now login immediately

## What's Already Implemented

According to the task list, these are COMPLETE:

✅ Task 12.1 - Member service layer (approveMember function)
✅ Task 12.2 - Member API endpoints (PATCH /api/v1/members/:id/approve)
✅ Task 12.3 - Member profile page
✅ Task 12.4 - Admin member approval page

## What's NOT Yet Implemented

According to the task list (Task 21), these are PENDING:

❌ Task 21.1 - Dashboard layout with sidebar navigation
❌ Task 21.2 - Dashboard home page with financial summary
❌ Task 21.3 - MoneyDisplay component
❌ Task 21.4 - Financial card components

## Current Situation

### What Works:
1. ✅ Landing page (localhost:3000)
2. ✅ Login page (localhost:3000/login)
3. ✅ Registration page (localhost:3000/register)
4. ✅ Backend API (localhost:3001) - **NOW RUNNING**
5. ✅ API proxy (frontend → backend)
6. ✅ Authentication flow (login, register, approve)
7. ✅ Admin approval page (localhost:3000/admin/members/pending)
8. ✅ Loan pages (localhost:3000/loans/*)
9. ✅ Savings pages (localhost:3000/savings/*)
10. ✅ Member profile (localhost:3000/members/profile)

### What Doesn't Work Yet:
1. ❌ Dashboard home page (localhost:3000/dashboard) - **JUST FIXED**
2. ❌ Sidebar navigation - Not implemented yet (Task 21.1)
3. ❌ Financial summary cards - Not implemented yet (Task 21.2)

## Next Steps

### Option 1: Use What's Working
You can now:
1. Login as admin
2. Approve member registrations at `/admin/members/pending`
3. Access loans at `/loans`
4. Access savings at `/savings`
5. Access profile at `/members/profile`

### Option 2: Implement Dashboard (Task 21)
If you want the full dashboard experience with sidebar navigation and financial summary, you need to implement Task 21 from the main spec.

## Testing the Flow

### Test Member Registration & Approval:
1. Go to http://localhost:3000/register
2. Fill out the registration form
3. Submit (you'll see "awaiting approval" message)
4. Login as admin (VIG-2026-001)
5. Go to http://localhost:3000/admin/members/pending
6. Approve the new member
7. Logout and login as the new member

### Test Loan Application:
1. Login as an approved member
2. Go to http://localhost:3000/loans
3. Check eligibility
4. Apply for a loan
5. View loan status

## Troubleshooting

### "Backend not running" error:
Run both servers:
```bash
npm run dev:all
```

Or run them separately:
```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev
```

### "404 on /dashboard" error:
This is now fixed! The dashboard page exists at `/dashboard` and will redirect to login if not authenticated.

### "Can't approve members" error:
Make sure you're logged in as the admin account (VIG-2026-001) and navigate to `/admin/members/pending`.

## Security Note

⚠️ **IMPORTANT**: Change the admin password immediately in production!

The default password `Admin123!` is only for development. In production:
1. Set a strong password via `ADMIN_PASSWORD` environment variable
2. Or change it through the UI after first login
3. Enable MFA for the admin account
