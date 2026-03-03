# Integration Tests for Savings Concurrency

This document explains how to run the integration tests for the savings service concurrency features.

## Overview

The integration tests in `savings.service.integration.test.ts` verify that:

1. **Concurrent withdrawal attempts are properly serialized** using distributed locks
2. **Concurrent deposits and withdrawals** maintain balance consistency
3. **Optimistic locking** detects and prevents version conflicts
4. **Distributed locks** work correctly (acquire, release, timeout, TTL)
5. **No race conditions** occur in balance updates under high concurrency

These tests validate **Requirements 1 (Financial Integrity)** and **8 (Development Standards)** from the spec.

## Prerequisites

### 1. PostgreSQL Database

You need a running PostgreSQL 16+ instance with a test database:

```bash
# Create test database
createdb vigilant_test

# Or using psql
psql -U postgres -c "CREATE DATABASE vigilant_test;"
```

### 2. Redis Server

You need a running Redis 7+ instance:

```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or install locally
# macOS: brew install redis && brew services start redis
# Ubuntu: sudo apt install redis-server && sudo systemctl start redis
# Windows: Use WSL or Docker
```

### 3. Database Schema

Migrate the database schema before running tests:

```bash
cd vigilant-cooperative
npm run db:migrate
```

## Running the Tests

### Option 1: With Running Services

If you have PostgreSQL and Redis running:

```bash
# Set environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vigilant_test"
export REDIS_URL="redis://localhost:6379"

# Run integration tests
npm test -- savings.service.integration.test.ts --run
```

### Option 2: Skip Integration Tests

If you don't have the services running, skip the tests:

```bash
# Set skip flag
export SKIP_INTEGRATION_TESTS=true

# Run tests (will be skipped)
npm test -- savings.service.integration.test.ts --run
```

### Option 3: Run All Tests Except Integration

```bash
# Run all unit tests (excludes integration tests by default)
npm test -- --run
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/vigilant_test` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `REDIS_PASSWORD` | (none) | Redis password if required |
| `SKIP_INTEGRATION_TESTS` | `false` | Set to `true` to skip integration tests |

## Test Coverage

### Concurrent Withdrawal Attempts (3 tests)

- ✅ Serializes concurrent withdrawal attempts using distributed locks
- ✅ Prevents concurrent withdrawals from causing negative balance
- ✅ Handles lock timeout when lock cannot be acquired

### Concurrent Deposit and Withdrawal (2 tests)

- ✅ Handles concurrent deposits and withdrawals correctly
- ✅ Maintains balance consistency with mixed operations

### Optimistic Locking (2 tests)

- ✅ Detects version conflicts with optimistic locking
- ✅ Handles version conflicts in concurrent updates

### Distributed Lock Behavior (4 tests)

- ✅ Acquires and releases distributed locks correctly
- ✅ Prevents acquiring same lock twice
- ✅ Auto-releases lock after TTL expires
- ✅ Does not release lock with wrong token

### Race Condition Prevention (3 tests)

- ✅ Prevents lost updates with high concurrency (50 operations)
- ✅ Maintains consistency with rapid sequential operations (100 operations)
- ✅ Prevents double-spending with concurrent withdrawals

## Troubleshooting

### Connection Refused Errors

```
Error: connect ECONNREFUSED 127.0.0.1:5432
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:** Ensure PostgreSQL and Redis are running:

```bash
# Check PostgreSQL
psql -U postgres -c "SELECT version();"

# Check Redis
redis-cli ping
# Should return: PONG
```

### Database Schema Errors

```
Error: relation "users" does not exist
```

**Solution:** Run database migrations:

```bash
npm run db:migrate
```

### Test Timeout Errors

```
Error: Test timeout of 5000ms exceeded
```

**Solution:** Increase test timeout or check if services are slow:

```bash
# Check database performance
psql -U postgres vigilant_test -c "SELECT pg_database_size('vigilant_test');"

# Check Redis performance
redis-cli --latency
```

## CI/CD Integration

For CI/CD pipelines, use Docker Compose to spin up test services:

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: vigilant_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

Run tests in CI:

```bash
# Start services
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be ready
sleep 5

# Run migrations
npm run db:migrate

# Run integration tests
npm test -- savings.service.integration.test.ts --run

# Cleanup
docker-compose -f docker-compose.test.yml down
```

## Performance Benchmarks

Expected test execution times:

| Test Suite | Operations | Expected Duration |
|------------|-----------|-------------------|
| Concurrent Withdrawals | 5-10 concurrent | < 2 seconds |
| Deposit/Withdrawal Mix | 5 concurrent | < 1 second |
| Optimistic Locking | 10 concurrent | < 1 second |
| Distributed Locks | 4 sequential | < 3 seconds |
| Race Prevention | 50-100 concurrent | < 5 seconds |

**Total Suite Duration:** < 15 seconds

## Best Practices

1. **Isolate test data:** Each test uses unique test users and accounts
2. **Clean up after tests:** `afterAll` hook removes all test data
3. **Reset state:** `beforeEach` hook resets account balance and clears locks
4. **Use transactions:** All database operations use proper transactions
5. **Test real concurrency:** Use `Promise.all()` to simulate true concurrent operations
6. **Verify final state:** Always check final balance and version after concurrent operations

## Related Files

- `savings.service.integration.test.ts` - Integration test suite
- `savings.service.test.ts` - Unit test suite
- `server/middleware/distributed-lock.ts` - Distributed lock implementation
- `server/redis/client.ts` - Redis client wrapper
- `server/db/schema.ts` - Database schema with optimistic locking

## Support

If you encounter issues running these tests:

1. Check that all prerequisites are installed and running
2. Verify environment variables are set correctly
3. Ensure database schema is up to date
4. Check the troubleshooting section above
5. Set `SKIP_INTEGRATION_TESTS=true` to skip these tests temporarily
