# Vercel Deployment Guide

## The Problem

Your app has two parts:
1. **Frontend** (Next.js) - Deployed to Vercel ✅
2. **Backend** (Fastify) - NOT deployed ❌

In development, both run locally:
- Frontend: `localhost:3000`
- Backend: `localhost:3001`

But Vercel only deploys the Next.js frontend. When you try to login in production, the frontend tries to call `/api/v1/auth/login`, which Next.js rewrites to your backend URL. Since there's no backend deployed, you get a 404 error.

## The Solution

You need to deploy your Fastify backend separately and configure Vercel to point to it.

### Option 1: Deploy Backend to Railway (Recommended - Free Tier Available)

1. **Create a Railway account**: https://railway.app/

2. **Create a new project** and select "Deploy from GitHub repo"

3. **Configure the backend**:
   - Root Directory: `vigilant-cooperative`
   - Build Command: `npm install`
   - Start Command: `npm run start:backend`
   
4. **Add environment variables** in Railway:
   ```
   DATABASE_URL=your_postgres_url
   REDIS_URL=your_redis_url
   JWT_SECRET=your_jwt_secret_min_64_chars
   NODE_ENV=production
   PORT=3001
   ```

5. **Get your Railway backend URL** (e.g., `https://your-app.up.railway.app`)

6. **Configure Vercel**:
   - Go to your Vercel project settings
   - Add environment variable:
     ```
     BACKEND_URL=https://your-app.up.railway.app
     ```
   - Redeploy

### Option 2: Deploy Backend to Render (Free Tier Available)

1. **Create a Render account**: https://render.com/

2. **Create a new Web Service**

3. **Configure**:
   - Build Command: `cd vigilant-cooperative && npm install`
   - Start Command: `cd vigilant-cooperative && npm run start:backend`

4. **Add environment variables** (same as Railway)

5. **Get your Render URL** and add to Vercel as `BACKEND_URL`

### Option 3: Use Vercel for Everything (Requires Rewrite)

Convert your Fastify backend to Next.js API routes. This is more work but keeps everything in one place.

**Pros**:
- Single deployment
- No separate backend to manage

**Cons**:
- Requires rewriting all backend routes
- Vercel serverless functions have limitations (10s timeout, no WebSockets, etc.)
- Redis/PostgreSQL need external hosting anyway

## Quick Fix for Testing

If you just want to test the frontend without backend functionality:

1. Comment out the API calls in your frontend
2. Use mock data
3. Deploy to Vercel

But for a real deployment, you need Option 1 or 2.

## Recommended Architecture

```
┌─────────────────┐
│   Vercel        │
│   (Frontend)    │
│   Next.js       │
└────────┬────────┘
         │
         │ BACKEND_URL
         │
┌────────▼────────┐
│   Railway       │
│   (Backend)     │
│   Fastify       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼───┐
│ Neon │  │Redis │
│  DB  │  │Cloud │
└──────┘  └──────┘
```

## Environment Variables Needed

### Vercel (Frontend)
```
BACKEND_URL=https://your-backend.railway.app
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Railway/Render (Backend)
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your_secret_min_64_characters
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-app.vercel.app
```

## Testing the Deployment

1. Deploy backend to Railway/Render
2. Test backend directly: `curl https://your-backend.railway.app/health`
3. Add `BACKEND_URL` to Vercel
4. Redeploy Vercel
5. Test login on your Vercel URL

## Cost Estimate

- **Vercel**: Free (Hobby plan)
- **Railway**: Free tier (500 hours/month)
- **Neon (PostgreSQL)**: Free tier (0.5GB storage)
- **Redis Cloud**: Free tier (30MB)

**Total**: $0/month for development/testing

## Need Help?

If you want me to help you set this up, let me know which option you prefer (Railway or Render) and I can guide you through it step by step.
