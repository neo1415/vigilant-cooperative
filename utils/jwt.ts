/**
 * JWT Utilities
 * 
 * JSON Web Token generation and verification using jose v6.
 * Implements secure token management with:
 * - Access tokens (15-minute expiry)
 * - Refresh tokens (7-day expiry, stored as SHA-256 hash in Redis)
 * - JWT blacklisting for logout
 * 
 * @module utils/jwt
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import crypto from 'crypto';
import { UserId, MemberId } from '../types/branded';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get JWT secret from environment
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable not set');
  }
  if (secret.length < 64) {
    throw new Error('JWT_SECRET must be at least 64 characters');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Get access token TTL from environment (default: 15 minutes)
 */
function getAccessTokenTtl(): number {
  const ttl = process.env.JWT_ACCESS_TTL_SECONDS;
  return ttl ? parseInt(ttl, 10) : 15 * 60; // 15 minutes
}

/**
 * Get refresh token TTL from environment (default: 7 days)
 */
function getRefreshTokenTtl(): number {
  const ttl = process.env.JWT_REFRESH_TTL_SECONDS;
  return ttl ? parseInt(ttl, 10) : 7 * 24 * 60 * 60; // 7 days
}

// ============================================================================
// Types
// ============================================================================

/**
 * JWT payload structure
 */
export interface JwtPayload extends JWTPayload {
  sub: string; // UserId
  member_id: string; // MemberId
  roles: string[];
  jti: string; // JWT ID for blacklisting
}

/**
 * Decoded JWT with payload
 */
export interface DecodedJwt {
  payload: JwtPayload;
  userId: UserId;
  memberId: MemberId;
  roles: string[];
  jti: string;
  exp: number;
  iat: number;
}

// ============================================================================
// Access Token Functions
// ============================================================================

/**
 * Generate access token (JWT)
 * 
 * @param userId - User ID
 * @param memberId - Member ID
 * @param roles - User roles
 * @returns JWT access token
 * 
 * @example
 * ```ts
 * const token = await generateAccessToken(userId, memberId, ['MEMBER']);
 * ```
 */
export async function generateAccessToken(
  userId: UserId,
  memberId: MemberId,
  roles: string[]
): Promise<string> {
  const secret = getJwtSecret();
  const ttl = getAccessTokenTtl();
  const jti = crypto.randomUUID();
  
  const token = await new SignJWT({
    sub: userId,
    member_id: memberId,
    roles,
    jti,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secret);
  
  return token;
}

/**
 * Verify and decode access token
 * 
 * @param token - JWT access token
 * @returns Decoded JWT payload
 * @throws {Error} If token is invalid or expired
 * 
 * @example
 * ```ts
 * try {
 *   const decoded = await verifyAccessToken(token);
 *   console.log(decoded.userId, decoded.roles);
 * } catch (error) {
 *   // Token invalid or expired
 * }
 * ```
 */
export async function verifyAccessToken(token: string): Promise<DecodedJwt> {
  const secret = getJwtSecret();
  
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    
    if (!payload.sub || !payload.member_id || !Array.isArray(payload.roles) || !payload.jti) {
      throw new Error('Invalid JWT payload structure');
    }
    
    return {
      payload: payload as JwtPayload,
      userId: payload.sub as UserId,
      memberId: payload.member_id as MemberId,
      roles: payload.roles as string[],
      jti: payload.jti as string,
      exp: payload.exp as number,
      iat: payload.iat as number,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`JWT verification failed: ${error.message}`);
    }
    throw new Error('JWT verification failed');
  }
}

/**
 * Extract token from Authorization header
 * 
 * @param authHeader - Authorization header value
 * @returns JWT token or null
 * 
 * @example
 * ```ts
 * const token = extractTokenFromHeader(req.headers.authorization);
 * if (token) {
 *   const decoded = await verifyAccessToken(token);
 * }
 * ```
 */
export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1] || null;
}

/**
 * Get remaining lifetime of a JWT in seconds
 * 
 * @param exp - Expiration timestamp (from JWT payload)
 * @returns Remaining seconds until expiration
 */
export function getRemainingLifetime(exp: number): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, exp - now);
}

// ============================================================================
// Refresh Token Functions
// ============================================================================

/**
 * Generate refresh token (random bytes)
 * 
 * @returns Refresh token (64 random bytes as hex)
 * 
 * @example
 * ```ts
 * const refreshToken = generateRefreshToken();
 * const hash = hashRefreshToken(refreshToken);
 * // Store hash in Redis
 * ```
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Hash refresh token for storage
 * 
 * @param refreshToken - Plain refresh token
 * @returns SHA-256 hash
 * 
 * @example
 * ```ts
 * const hash = hashRefreshToken(refreshToken);
 * await redis.setex(`refresh:${userId}`, ttl, hash);
 * ```
 */
export function hashRefreshToken(refreshToken: string): string {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}

/**
 * Verify refresh token against stored hash
 * 
 * @param refreshToken - Plain refresh token
 * @param storedHash - Stored SHA-256 hash
 * @returns true if token matches
 * 
 * @example
 * ```ts
 * const storedHash = await redis.get(`refresh:${userId}`);
 * if (storedHash && verifyRefreshToken(refreshToken, storedHash)) {
 *   // Token is valid
 * }
 * ```
 */
export function verifyRefreshToken(refreshToken: string, storedHash: string): boolean {
  const hash = hashRefreshToken(refreshToken);
  
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
  } catch {
    // Lengths don't match
    return false;
  }
}

/**
 * Get refresh token TTL in seconds
 */
export function getRefreshTokenTtlSeconds(): number {
  return getRefreshTokenTtl();
}

// ============================================================================
// JWT Blacklist Functions
// ============================================================================

/**
 * Create Redis key for JWT blacklist
 * 
 * @param jti - JWT ID
 * @returns Redis key
 */
export function getBlacklistKey(jti: string): string {
  return `jwt:blacklist:${jti}`;
}

/**
 * Create Redis key for refresh token
 * 
 * @param userId - User ID
 * @returns Redis key
 */
export function getRefreshTokenKey(userId: UserId): string {
  return `refresh:${userId}`;
}

// ============================================================================
// Token Rotation
// ============================================================================

/**
 * Rotate refresh token (generate new token, invalidate old one)
 * 
 * @returns New refresh token
 * 
 * @example
 * ```ts
 * const newRefreshToken = rotateRefreshToken();
 * const newHash = hashRefreshToken(newRefreshToken);
 * // Delete old token from Redis
 * // Store new hash in Redis
 * ```
 */
export function rotateRefreshToken(): string {
  return generateRefreshToken();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a role is present in roles array
 * 
 * @param roles - User roles
 * @param requiredRole - Required role
 * @returns true if role is present
 */
export function hasRole(roles: string[], requiredRole: string): boolean {
  return roles.includes(requiredRole);
}

/**
 * Check if any of the required roles are present
 * 
 * @param roles - User roles
 * @param requiredRoles - Required roles (any)
 * @returns true if any required role is present
 */
export function hasAnyRole(roles: string[], requiredRoles: string[]): boolean {
  return requiredRoles.some((role) => roles.includes(role));
}

/**
 * Check if all required roles are present
 * 
 * @param roles - User roles
 * @param requiredRoles - Required roles (all)
 * @returns true if all required roles are present
 */
export function hasAllRoles(roles: string[], requiredRoles: string[]): boolean {
  return requiredRoles.every((role) => roles.includes(role));
}

/**
 * Mask JWT for logging (show only first 8 characters)
 * 
 * @param token - JWT token
 * @returns Masked token
 * 
 * @example
 * ```ts
 * maskToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')
 * // 'eyJhbGci...'
 * ```
 */
export function maskToken(token: string): string {
  if (token.length <= 8) {
    return token;
  }
  return `${token.substring(0, 8)}...`;
}
