/**
 * Bug Condition Exploration Tests
 * Authentication and Dashboard Routing Fix
 * 
 * CRITICAL: These tests are EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bugs exist. They will pass after fixes are implemented.
 * 
 * DO NOT attempt to fix the code when these tests fail - that's expected behavior.
 * 
 * @module bugfix-exploration.test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';

describe('Bug Condition Exploration Tests', () => {
  describe('1.1 API Proxy Failure', () => {
    it('should demonstrate API request to /api/v1/auth/login returns 404', async () => {
      // **Validates: Requirements 2.4, 2.5**
      // This test demonstrates that POST requests to /api/v1/auth/login fail with 404
      // because Next.js doesn't proxy the request to the backend on port 3001
      
      const response = await fetch('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      });

      // EXPECTED OUTCOME ON UNFIXED CODE: 404 (confirms bug exists)
      // EXPECTED OUTCOME ON FIXED CODE: 200 or 401 (confirms proxy works)
      expect(response.status).not.toBe(404);
    }, 10000);
  });

  describe('1.2 Dashboard Route Missing', () => {
    it('should demonstrate navigation to /dashboard returns 404', async () => {
      // **Validates: Requirements 2.2, 2.8**
      // This test demonstrates that navigating to /dashboard returns 404
      // because the dashboard home page doesn't exist
      
      const response = await fetch('http://localhost:3000/dashboard');

      // EXPECTED OUTCOME ON UNFIXED CODE: 404 (confirms bug exists)
      // EXPECTED OUTCOME ON FIXED CODE: 200 or redirect (confirms dashboard exists)
      expect(response.status).not.toBe(404);
    }, 10000);
  });

  describe('1.3 Auth Protection Missing', () => {
    it('should demonstrate unauthenticated access to /dashboard/loans loads page', async () => {
      // **Validates: Requirements 2.1, 2.3**
      // This test demonstrates that accessing /dashboard/loans without authentication
      // loads the page instead of redirecting to login
      
      const response = await fetch('http://localhost:3000/dashboard/loans', {
        redirect: 'manual', // Don't follow redirects automatically
      });

      // EXPECTED OUTCOME ON UNFIXED CODE: 200 (page loads, confirms no auth protection)
      // EXPECTED OUTCOME ON FIXED CODE: 307/308 redirect to /login (confirms auth protection works)
      
      // On unfixed code, we expect the page to load (200)
      // On fixed code, we expect a redirect (3xx status)
      expect(response.status).toBeGreaterThanOrEqual(300);
      expect(response.status).toBeLessThan(400);
    }, 10000);
  });

  describe('1.4 Navbar Doesn\'t Check Auth', () => {
    it('should demonstrate navbar Member Portal button navigates without auth check', async () => {
      // **Validates: Requirements 2.1, 2.2**
      // This test demonstrates that the navbar's Member Portal button
      // doesn't check authentication state before navigating
      
      // Fetch the landing page and check if navbar has proper auth checking
      const response = await fetch('http://localhost:3000/');
      const html = await response.text();

      // Check if the navbar has a direct link to /dashboard (unfixed)
      // or if it has client-side auth checking logic (fixed)
      
      // EXPECTED OUTCOME ON UNFIXED CODE: Direct link to /dashboard exists
      // EXPECTED OUTCOME ON FIXED CODE: Button with onClick handler for auth check
      
      // On unfixed code, we expect to find a direct link to /dashboard
      // On fixed code, we expect NOT to find a direct link (should be a button with onClick)
      const hasDirectDashboardLink = html.includes('href="/dashboard"');
      
      // This test expects the fix to be in place (no direct link)
      expect(hasDirectDashboardLink).toBe(false);
    }, 10000);
  });

  describe('1.5 Dev Workflow Only Starts Frontend', () => {
    let devProcess: ChildProcess | null = null;

    afterAll(() => {
      // Clean up: kill the dev process if it's still running
      if (devProcess) {
        devProcess.kill('SIGTERM');
        // Also kill any child processes
        if (devProcess.pid) {
          try {
            process.kill(-devProcess.pid, 'SIGTERM');
          } catch (e) {
            // Process might already be dead
          }
        }
      }
    });

    it('should demonstrate backend is not running on port 3001 after npm run dev', async () => {
      // **Validates: Requirements 2.6**
      // This test demonstrates that running npm run dev only starts the frontend
      // and the backend on port 3001 is not running
      
      // Try to connect to the backend directly
      try {
        const response = await fetch('http://localhost:3001/api/v1/health', {
          signal: AbortSignal.timeout(5000),
        });

        // EXPECTED OUTCOME ON UNFIXED CODE: Connection fails (backend not running)
        // EXPECTED OUTCOME ON FIXED CODE: Backend responds (confirms both servers start)
        
        // If we get here, the backend is running (fixed code)
        expect(response.status).toBeDefined();
      } catch (error) {
        // EXPECTED OUTCOME ON UNFIXED CODE: This catch block executes
        // EXPECTED OUTCOME ON FIXED CODE: This catch block does NOT execute
        
        // On unfixed code, we expect the connection to fail
        // On fixed code, we expect the backend to respond
        // This test expects the fix to be in place (backend running)
        expect(error).toBeUndefined();
      }
    }, 15000);
  });
});
