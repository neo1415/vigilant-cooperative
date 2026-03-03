/**
 * Integration Tests for Savings Service Concurrency
 * 
 * Tests cover:
 * - Concurrent withdrawal attempts (should serialize)
 * - Concurrent deposit and withdrawal
 * - Optimistic locking version conflicts
 * - Distributed lock behavior
 * - No race conditions in balance updates
 * 
 * **Validates: Requirements 1 (Financial Integrity), 8 (Development Standards)**
 * 
 * @module services/savings.service.integration.test
 * 
 * ## Running These Tests
 * 
 * These are integration tests that require running PostgreSQL and Redis instances.
 * 
 * ### Prerequisites:
 * 1. PostgreSQL 16+ running on localhost:5432
 * 2. Redis 7+ running on localhost:6379
 * 3. Test database created: `vigilant_test`
 * 4. Database schema migrated: `npm run db:migrate`
 * 
 * ### Environment Variables:
 * ```bash
 * DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vigilant_test
 * REDIS_URL=redis://localhost:6379
 * ```
 * 
 * ### Run Tests:
 * ```bash
 * npm test -- savings.service.integration.test.ts --run
 * ```
 * 
 * ### Skip Integration Tests:
 * Set environment variable: `SKIP_INTEGRATION_TESTS=true`
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { savingsAccounts, users, transactions } from '../server/db/schema';
import { RedisClient } from '../server/redis/client';
import { DistributedLockService } from '../server/middleware/distributed-lock';
import { toKoboAmount } from '../types/branded';

// Skip integration tests if environment variable is set or dependencies not available
const shouldSkip = process.env.SKIP_INTEGRATION_TESTS === 'true';

// ============================================================================
// Test Setup and Teardown
// ============================================================================

let pool: Pool;
let db: ReturnType<typeof drizzle>;
let redis: RedisClient;
let lockService: DistributedLockService;
let testUserId: string;
let testAccountId: string;

beforeAll(async () => {
  if (shouldSkip) {
    console.log('⚠️  Skipping integration tests (SKIP_INTEGRATION_TESTS=true)');
    return;
  }

  try {
    // Initialize database connection
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vigilant_test',
      min: 2,
      max: 10,
      connectionTimeoutMillis: 5000,
    });

    db = drizzle(pool);

    // Initialize Redis client
    redis = new RedisClient({
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    } as any);

    lockService = new DistributedLockService(redis);

    // Wait for connections to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create test user
    const [user] = await db.insert(users).values({
      memberId: 'VIG-2026-TEST',
      employeeIdEncrypted: 'encrypted_emp_id',
      phoneEncrypted: 'encrypted_phone',
      employeeIdHash: 'hash_emp_id',
      phoneHash: 'hash_phone_' + Date.now(),
      fullName: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashed_password',
      dateJoined: new Date('2026-01-01'),
      isApproved: true,
      employmentStatus: 'ACTIVE',
    }).returning();

    testUserId = user.id;

    // Create test savings account
    const [account] = await db.insert(savingsAccounts).values({
      userId: testUserId,
      accountType: 'NORMAL',
      balanceKobo: toKoboAmount(100000), // ₦1,000.00
    }).returning();

    testAccountId = account.id;
  } catch (error) {
    console.error('❌ Failed to initialize integration test environment:', error);
    console.log('💡 Set SKIP_INTEGRATION_TESTS=true to skip these tests');
    throw error;
  }
});

afterAll(async () => {
  if (shouldSkip) return;

  try {
    // Cleanup test data
    if (testUserId) {
      await db.delete(transactions).where(eq(transactions.userId, testUserId));
      await db.delete(savingsAccounts).where(eq(savingsAccounts.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }

    // Close connections
    if (redis) await redis.close();
    if (pool) await pool.end();
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
});

beforeEach(async () => {
  if (shouldSkip) return;

  // Reset account balance before each test
  await db.update(savingsAccounts)
    .set({ balanceKobo: toKoboAmount(100000), version: 1 })
    .where(eq(savingsAccounts.id, testAccountId));

  // Clear any test locks
  await redis.del(`lock:user:${testUserId}:financial`);
});

// ============================================================================
// Test Suite: Concurrent Withdrawal Attempts (Should Serialize)
// ============================================================================

describe.skipIf(shouldSkip)('Savings Concurrency - Concurrent Withdrawal Attempts', () => {
  it('should serialize concurrent withdrawal attempts using distributed locks', async () => {
    const withdrawalAmount = toKoboAmount(10000); // ₦100.00 each
    const concurrentAttempts = 5;

    // Simulate concurrent withdrawal attempts
    const withdrawalPromises = Array.from({ length: concurrentAttempts }, async (_, index) => {
      try {
        return await lockService.withLock(
          `user:${testUserId}:financial`,
          async () => {
            // Simulate withdrawal logic
            const account = await db.select()
              .from(savingsAccounts)
              .where(eq(savingsAccounts.id, testAccountId))
              .limit(1);

            if (account[0].balanceKobo >= withdrawalAmount) {
              const newBalance = account[0].balanceKobo - withdrawalAmount;
              
              await db.update(savingsAccounts)
                .set({ 
                  balanceKobo: newBalance,
                  version: account[0].version + 1,
                })
                .where(and(
                  eq(savingsAccounts.id, testAccountId),
                  eq(savingsAccounts.version, account[0].version)
                ));

              return { success: true, index, newBalance };
            }

            return { success: false, index, reason: 'insufficient_balance' };
          },
          { ttlSeconds: 30, timeoutMs: 10000 }
        );
      } catch (error) {
        return { success: false, index, error: (error as Error).message };
      }
    });

    const results = await Promise.all(withdrawalPromises);

    // Verify all operations completed
    expect(results).toHaveLength(concurrentAttempts);

    // Count successful withdrawals
    const successfulWithdrawals = results.filter(r => r.success).length;

    // Verify final balance
    const [finalAccount] = await db.select()
      .from(savingsAccounts)
      .where(eq(savingsAccounts.id, testAccountId));

    const expectedBalance = 100000 - (successfulWithdrawals * withdrawalAmount);
    expect(finalAccount.balanceKobo).toBe(expectedBalance);

    // Verify no race condition: balance should be consistent
    expect(finalAccount.balanceKobo).toBeGreaterThanOrEqual(0);
  });

  it('should prevent concurrent withdrawals from causing negative balance', async () => {
    // Set initial balance to ₦200.00
    await db.update(savingsAccounts)
      .set({ balanceKobo: toKoboAmount(20000), version: 1 })
      .where(eq(savingsAccounts.id, testAccountId));

    const withdrawalAmount = toKoboAmount(15000); // ₦150.00 each
    const concurrentAttempts = 3; // Total would be ₦450.00 if not serialized

    const withdrawalPromises = Array.from({ length: concurrentAttempts }, async () => {
      try {
        return await lockService.withLock(
          `user:${testUserId}:financial`,
          async () => {
            const account = await db.select()
              .from(savingsAccounts)
              .where(eq(savingsAccounts.id, testAccountId))
              .limit(1);

            if (account[0].balanceKobo >= withdrawalAmount) {
              const newBalance = account[0].balanceKobo - withdrawalAmount;
              
              await db.update(savingsAccounts)
                .set({ 
                  balanceKobo: newBalance,
                  version: account[0].version + 1,
                })
                .where(and(
                  eq(savingsAccounts.id, testAccountId),
                  eq(savingsAccounts.version, account[0].version)
                ));

              return { success: true, newBalance };
            }

            return { success: false, reason: 'insufficient_balance' };
          },
          { ttlSeconds: 30, timeoutMs: 10000 }
        );
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    const results = await Promise.all(withdrawalPromises);

    // Only one withdrawal should succeed (₦150.00), leaving ₦50.00
    const successfulWithdrawals = results.filter(r => r.success).length;
    expect(successfulWithdrawals).toBe(1);

    // Verify final balance is not negative
    const [finalAccount] = await db.select()
      .from(savingsAccounts)
      .where(eq(savingsAccounts.id, testAccountId));

    expect(finalAccount.balanceKobo).toBe(5000); // ₦50.00
    expect(finalAccount.balanceKobo).toBeGreaterThanOrEqual(0);
  });

  it('should handle lock timeout when lock cannot be acquired', async () => {
    // Acquire lock manually
    const lockToken = await lockService.acquire(`user:${testUserId}:financial`, 30);
    expect(lockToken).not.toBeNull();

    try {
      // Try to acquire same lock with short timeout
      await expect(
        lockService.withLock(
          `user:${testUserId}:financial`,
          async () => {
            return { success: true };
          },
          { ttlSeconds: 30, timeoutMs: 100 } // Very short timeout
        )
      ).rejects.toThrow(/Failed to acquire lock/);
    } finally {
      // Release the lock
      if (lockToken) {
        await lockService.release(`user:${testUserId}:financial`, lockToken);
      }
    }
  });
});

// ============================================================================
// Test Suite: Concurrent Deposit and Withdrawal
// ============================================================================

describe.skipIf(shouldSkip)('Savings Concurrency - Concurrent Deposit and Withdrawal', () => {
  it('should handle concurrent deposits and withdrawals correctly', async () => {
    const depositAmount = toKoboAmount(5000); // ₦50.00
    const withdrawalAmount = toKoboAmount(3000); // ₦30.00
    const initialBalance = toKoboAmount(100000); // ₦1,000.00

    // Simulate concurrent deposits and withdrawals
    const operations = [
      // 3 deposits
      ...Array.from({ length: 3 }, () => ({ type: 'deposit', amount: depositAmount })),
      // 2 withdrawals
      ...Array.from({ length: 2 }, () => ({ type: 'withdrawal', amount: withdrawalAmount })),
    ];

    const operationPromises = operations.map(async (op) => {
      try {
        return await lockService.withLock(
          `user:${testUserId}:financial`,
          async () => {
            const account = await db.select()
              .from(savingsAccounts)
              .where(eq(savingsAccounts.id, testAccountId))
              .limit(1);

            let newBalance: number;

            if (op.type === 'deposit') {
              newBalance = account[0].balanceKobo + op.amount;
            } else {
              if (account[0].balanceKobo < op.amount) {
                return { success: false, type: op.type, reason: 'insufficient_balance' };
              }
              newBalance = account[0].balanceKobo - op.amount;
            }

            await db.update(savingsAccounts)
              .set({ 
                balanceKobo: newBalance,
                version: account[0].version + 1,
              })
              .where(and(
                eq(savingsAccounts.id, testAccountId),
                eq(savingsAccounts.version, account[0].version)
              ));

            return { success: true, type: op.type, newBalance };
          },
          { ttlSeconds: 30, timeoutMs: 10000 }
        );
      } catch (error) {
        return { success: false, type: op.type, error: (error as Error).message };
      }
    });

    const results = await Promise.all(operationPromises);

    // Verify all operations completed
    expect(results).toHaveLength(operations.length);

    // Count successful operations
    const successfulDeposits = results.filter(r => r.success && r.type === 'deposit').length;
    const successfulWithdrawals = results.filter(r => r.success && r.type === 'withdrawal').length;

    // Verify final balance
    const [finalAccount] = await db.select()
      .from(savingsAccounts)
      .where(eq(savingsAccounts.id, testAccountId));

    const expectedBalance = initialBalance + (successfulDeposits * depositAmount) - (successfulWithdrawals * withdrawalAmount);
    expect(finalAccount.balanceKobo).toBe(expectedBalance);
  });

  it('should maintain balance consistency with mixed operations', async () => {
    const operations = [
      { type: 'deposit', amount: toKoboAmount(10000) },
      { type: 'withdrawal', amount: toKoboAmount(5000) },
      { type: 'deposit', amount: toKoboAmount(15000) },
      { type: 'withdrawal', amount: toKoboAmount(8000) },
      { type: 'deposit', amount: toKoboAmount(20000) },
    ];

    const operationPromises = operations.map(async (op) => {
      return await lockService.withLock(
        `user:${testUserId}:financial`,
        async () => {
          const account = await db.select()
            .from(savingsAccounts)
            .where(eq(savingsAccounts.id, testAccountId))
            .limit(1);

          let newBalance: number;

          if (op.type === 'deposit') {
            newBalance = account[0].balanceKobo + op.amount;
          } else {
            if (account[0].balanceKobo < op.amount) {
              return { success: false, type: op.type };
            }
            newBalance = account[0].balanceKobo - op.amount;
          }

          await db.update(savingsAccounts)
            .set({ 
              balanceKobo: newBalance,
              version: account[0].version + 1,
            })
            .where(and(
              eq(savingsAccounts.id, testAccountId),
              eq(savingsAccounts.version, account[0].version)
            ));

          return { success: true, type: op.type, newBalance };
        },
        { ttlSeconds: 30, timeoutMs: 10000 }
      );
    });

    const results = await Promise.all(operationPromises);

    // All operations should succeed
    expect(results.every(r => r.success)).toBe(true);

    // Verify final balance
    const [finalAccount] = await db.select()
      .from(savingsAccounts)
      .where(eq(savingsAccounts.id, testAccountId));

    // Initial: 100000, +10000, -5000, +15000, -8000, +20000 = 132000
    expect(finalAccount.balanceKobo).toBe(132000);
  });
});

// ============================================================================
// Test Suite: Optimistic Locking Version Conflicts
// ============================================================================

describe.skipIf(shouldSkip)('Savings Concurrency - Optimistic Locking', () => {
  it('should detect version conflicts with optimistic locking', async () => {
    // Get current account state
    const [account] = await db.select()
      .from(savingsAccounts)
      .where(eq(savingsAccounts.id, testAccountId));

    const currentVersion = account.version;

    // First update succeeds
    const result1 = await db.update(savingsAccounts)
      .set({ 
        balanceKobo: account.balanceKobo - 1000,
        version: currentVersion + 1,
      })
      .where(and(
        eq(savingsAccounts.id, testAccountId),
        eq(savingsAccounts.version, currentVersion)
      ))
      .returning();

    expect(result1).toHaveLength(1);
    expect(result1[0].version).toBe(currentVersion + 1);

    // Second update with stale version fails
    const result2 = await db.update(savingsAccounts)
      .set({ 
        balanceKobo: account.balanceKobo - 2000,
        version: currentVersion + 1, // Using stale version
      })
      .where(and(
        eq(savingsAccounts.id, testAccountId),
        eq(savingsAccounts.version, currentVersion) // Stale version check
      ))
      .returning();

    // Update should affect 0 rows (version mismatch)
    expect(result2).toHaveLength(0);

    // Verify version was incremented only once
    const [finalAccount] = await db.select()
      .from(savingsAccounts)
      .where(eq(savingsAccounts.id, testAccountId));

    expect(finalAccount.version).toBe(currentVersion + 1);
  });

  it('should handle version conflicts in concurrent updates', async () => {
    const concurrentUpdates = 10;

    const updatePromises = Array.from({ length: concurrentUpdates }, async () => {
      try {
        // Read current state
        const [account] = await db.select()
          .from(savingsAccounts)
          .where(eq(savingsAccounts.id, testAccountId));

        // Try to update with version check
        const result = await db.update(savingsAccounts)
          .set({ 
            balanceKobo: account.balanceKobo - 100,
            version: account.version + 1,
          })
          .where(and(
            eq(savingsAccounts.id, testAccountId),
            eq(savingsAccounts.version, account.version)
          ))
          .returning();

        return { success: result.length > 0, updated: result.length };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    const results = await Promise.all(updatePromises);

    // Some updates should fail due to version conflicts
    const successfulUpdates = results.filter(r => r.success).length;
    const failedUpdates = results.filter(r => !r.success).length;

    expect(successfulUpdates).toBeGreaterThan(0);
    expect(failedUpdates).toBeGreaterThan(0);
    expect(successfulUpdates + failedUpdates).toBe(concurrentUpdates);

    // Verify version was incremented correctly
    const [finalAccount] = await db.select()
      .from(savingsAccounts)
      .where(eq(savingsAccounts.id, testAccountId));

    // Version should be incremented by number of successful updates
    expect(finalAccount.version).toBe(1 + successfulUpdates);
  });
});

// ============================================================================
// Test Suite: Distributed Lock Behavior
// ============================================================================

describe.skipIf(shouldSkip)('Savings Concurrency - Distributed Lock Behavior', () => {
  it('should acquire and release distributed locks correctly', async () => {
    const lockKey = `user:${testUserId}:financial`;

    // Acquire lock
    const token = await lockService.acquire(lockKey, 30);
    expect(token).not.toBeNull();

    // Verify lock exists in Redis
    const lockExists = await redis.exists(`lock:${lockKey}`);
    expect(lockExists).toBe(true);

    // Release lock
    const released = await lockService.release(lockKey, token!);
    expect(released).toBe(true);

    // Verify lock is removed
    const lockExistsAfter = await redis.exists(`lock:${lockKey}`);
    expect(lockExistsAfter).toBe(false);
  });

  it('should prevent acquiring same lock twice', async () => {
    const lockKey = `user:${testUserId}:financial`;

    // Acquire lock
    const token1 = await lockService.acquire(lockKey, 30);
    expect(token1).not.toBeNull();

    // Try to acquire same lock
    const token2 = await lockService.acquire(lockKey, 30);
    expect(token2).toBeNull();

    // Release lock
    await lockService.release(lockKey, token1!);
  });

  it('should auto-release lock after TTL expires', async () => {
    const lockKey = `user:${testUserId}:financial`;

    // Acquire lock with short TTL
    const token = await lockService.acquire(lockKey, 1); // 1 second
    expect(token).not.toBeNull();

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Lock should be released
    const lockExists = await redis.exists(`lock:${lockKey}`);
    expect(lockExists).toBe(false);

    // Should be able to acquire lock again
    const token2 = await lockService.acquire(lockKey, 30);
    expect(token2).not.toBeNull();

    // Cleanup
    await lockService.release(lockKey, token2!);
  });

  it('should not release lock with wrong token', async () => {
    const lockKey = `user:${testUserId}:financial`;

    // Acquire lock
    const token = await lockService.acquire(lockKey, 30);
    expect(token).not.toBeNull();

    // Try to release with wrong token
    const released = await lockService.release(lockKey, 'wrong-token');
    expect(released).toBe(false);

    // Lock should still exist
    const lockExists = await redis.exists(`lock:${lockKey}`);
    expect(lockExists).toBe(true);

    // Cleanup with correct token
    await lockService.release(lockKey, token!);
  });
});

// ============================================================================
// Test Suite: No Race Conditions in Balance Updates
// ============================================================================

describe.skipIf(shouldSkip)('Savings Concurrency - Race Condition Prevention', () => {
  it('should prevent lost updates with high concurrency', async () => {
    const initialBalance = toKoboAmount(100000);
    const incrementAmount = toKoboAmount(100);
    const concurrentOperations = 50;

    // Reset balance
    await db.update(savingsAccounts)
      .set({ balanceKobo: initialBalance, version: 1 })
      .where(eq(savingsAccounts.id, testAccountId));

    // Perform concurrent increments
    const incrementPromises = Array.from({ length: concurrentOperations }, async () => {
      return await lockService.withLock(
        `user:${testUserId}:financial`,
        async () => {
          const [account] = await db.select()
            .from(savingsAccounts)
            .where(eq(savingsAccounts.id, testAccountId));

          const newBalance = account.balanceKobo + incrementAmount;

          await db.update(savingsAccounts)
            .set({ 
              balanceKobo: newBalance,
              version: account.version + 1,
            })
            .where(and(
              eq(savingsAccounts.id, testAccountId),
              eq(savingsAccounts.version, account.version)
            ));

          return { success: true };
        },
        { ttlSeconds: 30, timeoutMs: 30000 }
      );
    });

    await Promise.all(incrementPromises);

    // Verify final balance
    const [finalAccount] = await db.select()
      .from(savingsAccounts)
      .where(eq(savingsAccounts.id, testAccountId));

    const expectedBalance = initialBalance + (concurrentOperations * incrementAmount);
    expect(finalAccount.balanceKobo).toBe(expectedBalance);
  });

  it('should maintain consistency with rapid sequential operations', async () => {
    const operations = 100;
    const operationAmount = toKoboAmount(10);

    for (let i = 0; i < operations; i++) {
      await lockService.withLock(
        `user:${testUserId}:financial`,
        async () => {
          const [account] = await db.select()
            .from(savingsAccounts)
            .where(eq(savingsAccounts.id, testAccountId));

          const newBalance = account.balanceKobo + operationAmount;

          await db.update(savingsAccounts)
            .set({ 
              balanceKobo: newBalance,
              version: account.version + 1,
            })
            .where(and(
              eq(savingsAccounts.id, testAccountId),
              eq(savingsAccounts.version, account.version)
            ));
        },
        { ttlSeconds: 30, timeoutMs: 5000 }
      );
    }

    // Verify final balance
    const [finalAccount] = await db.select()
      .from(savingsAccounts)
      .where(eq(savingsAccounts.id, testAccountId));

    // Should have incremented by operations * operationAmount
    expect(finalAccount.balanceKobo).toBeGreaterThan(100000);
  });

  it('should prevent double-spending with concurrent withdrawals', async () => {
    // Set balance to exactly ₦100.00
    await db.update(savingsAccounts)
      .set({ balanceKobo: toKoboAmount(10000), version: 1 })
      .where(eq(savingsAccounts.id, testAccountId));

    const withdrawalAmount = toKoboAmount(10000); // Entire balance
    const concurrentAttempts = 5;

    const withdrawalPromises = Array.from({ length: concurrentAttempts }, async () => {
      try {
        return await lockService.withLock(
          `user:${testUserId}:financial`,
          async () => {
            const [account] = await db.select()
              .from(savingsAccounts)
              .where(eq(savingsAccounts.id, testAccountId));

            if (account.balanceKobo >= withdrawalAmount) {
              const newBalance = account.balanceKobo - withdrawalAmount;

              await db.update(savingsAccounts)
                .set({ 
                  balanceKobo: newBalance,
                  version: account.version + 1,
                })
                .where(and(
                  eq(savingsAccounts.id, testAccountId),
                  eq(savingsAccounts.version, account.version)
                ));

              return { success: true };
            }

            return { success: false, reason: 'insufficient_balance' };
          },
          { ttlSeconds: 30, timeoutMs: 10000 }
        );
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    const results = await Promise.all(withdrawalPromises);

    // Only one withdrawal should succeed
    const successfulWithdrawals = results.filter(r => r.success).length;
    expect(successfulWithdrawals).toBe(1);

    // Final balance should be 0
    const [finalAccount] = await db.select()
      .from(savingsAccounts)
      .where(eq(savingsAccounts.id, testAccountId));

    expect(finalAccount.balanceKobo).toBe(0);
  });
});
