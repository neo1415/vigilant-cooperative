import type { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import type { RedisClient } from '../redis/client';

/**
 * Idempotency middleware with Redis backing
 * Ensures financial mutations are safe to retry
 */
export function createIdempotencyMiddleware(redis: RedisClient) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Only apply to mutating methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return;
    }

    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;

    // Require idempotency key for financial endpoints
    const isFinancialEndpoint =
      request.url.includes('/loans') ||
      request.url.includes('/savings') ||
      request.url.includes('/payroll') ||
      request.url.includes('/disburse') ||
      request.url.includes('/withdraw');

    if (isFinancialEndpoint && !idempotencyKey) {
      return reply.code(400).send({
        success: false,
        error: {
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'Idempotency-Key header is required for financial operations',
        },
      });
    }

    if (!idempotencyKey) {
      return; // Non-financial endpoints can proceed without idempotency key
    }

    // Compute hash of idempotency key + user ID + endpoint
    const userId = (request as any).user?.id || 'anonymous';
    const hash = createHash('sha256')
      .update(`${idempotencyKey}:${userId}:${request.method}:${request.url}`)
      .digest('hex');

    const redisKey = `idempotency:${hash}`;

    // Check if request was already processed
    const cached = await redis.get(redisKey);

    if (cached) {
      const data = JSON.parse(cached);

      if (data.status === 'COMPLETED') {
        // Return cached response
        return reply
          .code(data.statusCode || 200)
          .header('Idempotency-Replayed', 'true')
          .send(data.response);
      }

      if (data.status === 'PROCESSING') {
        // Request is currently being processed
        return reply.code(409).send({
          success: false,
          error: {
            code: 'REQUEST_IN_FLIGHT',
            message: 'This request is currently being processed',
          },
        });
      }
    }

    // Mark as processing
    await redis.set(
      redisKey,
      JSON.stringify({
        status: 'PROCESSING',
        created_at: new Date().toISOString(),
      }),
      86400 // 24 hour TTL
    );

    // Store idempotency info in request for later use
    (request as any).idempotency = {
      key: idempotencyKey,
      hash,
      redisKey,
    };
  };
}

/**
 * Hook to cache successful responses
 */
export function createIdempotencyResponseHook(redis: RedisClient) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const idempotency = (request as any).idempotency;

    if (!idempotency) {
      return;
    }

    const { redisKey } = idempotency;

    // Only cache successful responses (2xx status codes)
    if (reply.statusCode >= 200 && reply.statusCode < 300) {
      // Cache the response
      await redis.set(
        redisKey,
        JSON.stringify({
          status: 'COMPLETED',
          statusCode: reply.statusCode,
          response: (reply as any).payload || {},
          completed_at: new Date().toISOString(),
        }),
        86400 // 24 hour TTL
      );
    } else {
      // Delete the processing marker to allow retry
      await redis.del(redisKey);
    }
  };
}
