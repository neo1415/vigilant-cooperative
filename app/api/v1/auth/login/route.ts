import { NextRequest, NextResponse } from 'next/server';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import Redis from 'ioredis';
import * as schema from '../../../../../server/db/schema';
import { eq, or } from 'drizzle-orm';
import { verifyPassword, hashForLookup } from '../../../../../utils/encryption';
import { generateAccessToken, generateRefreshToken, hashRefreshToken, getRefreshTokenTtlSeconds, getRefreshTokenKey } from '../../../../../utils/jwt';
import { successResponse, errorResponse, ErrorCode, getHttpStatusCode } from '../../../../../utils/api-response';
import { validateSchema, loginSchema } from '../../../../../utils/validation';
import { toUserId, toMemberId } from '../../../../../types/branded';

// Create database connection for API routes
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

// Create Redis connection for API routes
let redis: Redis | null = null;
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID();

    // Validate input
    const validation = validateSchema(loginSchema, body);
    
    if (!validation.success) {
      const statusCode = getHttpStatusCode(ErrorCode.VALIDATION_ERROR);
      return NextResponse.json(
        errorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Validation failed',
          requestId,
          validation.errors
        ),
        { status: statusCode }
      );
    }

    const { identifier, password } = validation.data;

    // Hash the identifier to search by phoneHash or use memberId directly
    const phoneHash = hashForLookup(identifier);
    
    // Find user by member_id or phone hash
    const user = await db.query.users.findFirst({
      where: or(
        eq(schema.users.memberId, identifier),
        eq(schema.users.phoneHash, phoneHash)
      )
    });

    if (!user) {
      return NextResponse.json(
        errorResponse(
          ErrorCode.INVALID_CREDENTIALS,
          'Invalid credentials',
          requestId
        ),
        { status: 401 }
      );
    }

    // Check if account is locked
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return NextResponse.json(
        errorResponse(
          ErrorCode.ACCOUNT_LOCKED,
          'Account is locked. Please contact support.',
          requestId
        ),
        { status: 403 }
      );
    }

    // Check if member is approved
    if (!user.isApproved) {
      return NextResponse.json(
        errorResponse(
          ErrorCode.MEMBER_NOT_APPROVED,
          'Your membership is pending approval',
          requestId
        ),
        { status: 403 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        errorResponse(
          ErrorCode.INVALID_CREDENTIALS,
          'Invalid credentials',
          requestId
        ),
        { status: 401 }
      );
    }

    // Generate tokens
    const accessToken = await generateAccessToken(
      toUserId(user.id),
      toMemberId(user.memberId),
      user.roles
    );
    
    const refreshToken = generateRefreshToken();

    // Store refresh token in Redis if available
    if (redis) {
      try {
        const refreshTokenHash = hashRefreshToken(refreshToken);
        const refreshTokenKey = getRefreshTokenKey(toUserId(user.id));
        const ttl = getRefreshTokenTtlSeconds();
        await redis.setex(refreshTokenKey, ttl, refreshTokenHash);
      } catch (redisError) {
        console.error('Redis error storing refresh token:', redisError);
        // Continue anyway - access token will still work
      }
    }

    // Update last login timestamp
    await db
      .update(schema.users)
      .set({ updatedAt: new Date() })
      .where(eq(schema.users.id, user.id));

    return NextResponse.json(
      successResponse(
        {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            memberId: user.memberId,
            fullName: user.fullName,
            roles: user.roles,
            mfaEnabled: user.mfaEnabled,
          },
        },
        requestId
      )
    );
  } catch (error) {
    console.error('Login error:', error);
    const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
    return NextResponse.json(
      errorResponse(
        ErrorCode.INTERNAL_ERROR,
        'An error occurred during login',
        requestId
      ),
      { status: 500 }
    );
  }
}
