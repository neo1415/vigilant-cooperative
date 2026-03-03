import type { FastifyRequest, FastifyReply } from 'fastify';
import { jwtVerify } from 'jose';
import type { RedisClient } from '../redis/client';

/**
 * JWT payload structure
 */
export interface JWTPayload {
  sub: string; // userId
  member_id: string;
  roles: string[];
  jti: string; // JWT ID for blacklisting
  iat: number;
  exp: number;
}

/**
 * Authenticated user attached to request
 */
export interface AuthenticatedUser {
  id: string;
  memberId: string;
  roles: string[];
  jti: string;
}

/**
 * Authentication middleware with JWT verification
 * Uses jose v6 for secure JWT operations
 */
export function createAuthenticationMiddleware(jwtSecret: string, redis: RedisClient) {
  const secret = new TextEncoder().encode(jwtSecret);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    try {
      // Verify JWT signature and expiration
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ['HS256'],
      });

      const jwtPayload = payload as unknown as JWTPayload;

      // Check if token is blacklisted (logged out)
      const isBlacklisted = await redis.exists(`jwt:blacklist:${jwtPayload.jti}`);
      if (isBlacklisted) {
        return reply.code(401).send({
          success: false,
          error: {
            code: 'TOKEN_REVOKED',
            message: 'This token has been revoked',
          },
        });
      }

      // Attach user to request
      (request as any).user = {
        id: jwtPayload.sub,
        memberId: jwtPayload.member_id,
        roles: jwtPayload.roles,
        jti: jwtPayload.jti,
      } as AuthenticatedUser;
    } catch (error) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token',
        },
      });
    }
  };
}

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't require it
 */
export function createOptionalAuthenticationMiddleware(jwtSecret: string, redis: RedisClient) {
  const secret = new TextEncoder().encode(jwtSecret);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return; // No token, continue without user
    }

    const token = authHeader.substring(7);

    try {
      const { payload } = await jwtVerify(token, secret, {
        algorithms: ['HS256'],
      });

      const jwtPayload = payload as unknown as JWTPayload;

      const isBlacklisted = await redis.exists(`jwt:blacklist:${jwtPayload.jti}`);
      if (!isBlacklisted) {
        (request as any).user = {
          id: jwtPayload.sub,
          memberId: jwtPayload.member_id,
          roles: jwtPayload.roles,
          jti: jwtPayload.jti,
        } as AuthenticatedUser;
      }
    } catch (error) {
      // Invalid token, continue without user
      return;
    }
  };
}
