/**
 * Authentication Service
 * 
 * Handles user authentication, registration, login, logout, and password management.
 * Implements secure authentication with:
 * - bcrypt password hashing with pepper
 * - JWT access tokens (15 minutes)
 * - Refresh tokens (7 days, hashed in Redis)
 * - Account lockout after failed attempts
 * - MFA support (TOTP)
 * 
 * @module services/auth
 */

import { db } from '../server/db/init';
import { users, savingsAccounts } from '../server/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, generateNumericOtp, hashValue, verifyValue } from '../utils/encryption';
import { generateAccessToken, generateRefreshToken, hashRefreshToken, getRefreshTokenTtlSeconds } from '../utils/jwt';
import { generateMemberId, type UserId, type MemberId, toUserId, toMemberId } from '../types/branded';
import { ok, err, type Result } from '../types/result';
import type { RedisClient } from '../server/redis/client';

// ============================================================================
// Types
// ============================================================================

export interface RegisterInput {
  fullName: string;
  employeeId: string;
  phone: string;
  email?: string | undefined;
  department: string;
  dateJoined: Date;
  password: string;
}

export interface RegisterResult {
  userId: UserId;
  memberId: MemberId;
  message: string;
}

export interface LoginInput {
  identifier: string; // member_id or phone
  password: string;
  totpCode?: string | undefined;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: UserId;
    memberId: MemberId;
    fullName: string;
    roles: string[];
    mfaEnabled: boolean;
  };
}

export interface ForgotPasswordInput {
  identifier: string; // member_id or phone
}

export interface ResetPasswordInput {
  identifier: string;
  otp: string;
  newPassword: string;
}

// ============================================================================
// Error Codes
// ============================================================================

export enum AuthErrorCode {
  DUPLICATE_EMPLOYEE_ID = 'DUPLICATE_EMPLOYEE_ID',
  DUPLICATE_PHONE = 'DUPLICATE_PHONE',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  ACCOUNT_NOT_APPROVED = 'ACCOUNT_NOT_APPROVED',
  MFA_REQUIRED = 'MFA_REQUIRED',
  INVALID_MFA_CODE = 'INVALID_MFA_CODE',
  INVALID_OTP = 'INVALID_OTP',
  OTP_EXPIRED = 'OTP_EXPIRED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
}

// ============================================================================
// Service Class
// ============================================================================

export class AuthService {
  constructor(private redis: RedisClient) {}

  /**
   * Register a new member
   */
  async register(input: RegisterInput): Promise<Result<RegisterResult, AuthErrorCode>> {
    // Check for duplicate employee_id (would need to decrypt all to check - use hash instead)
    // For now, we'll let the database unique constraint handle this
    
    // Check for duplicate phone (use hash)
    const { hashForLookup } = await import('../utils/encryption');
    const phoneHash = hashForLookup(input.phone);
    
    const existingPhone = await db
      .select()
      .from(users)
      .where(eq(users.phoneHash, phoneHash))
      .limit(1);
    
    if (existingPhone.length > 0) {
      return err(AuthErrorCode.DUPLICATE_PHONE);
    }
    
    // Hash password
    const passwordHash = await hashPassword(input.password);
    
    // Encrypt sensitive fields
    const { encrypt } = await import('../utils/encryption');
    const employeeIdEncrypted = encrypt(input.employeeId);
    const employeeIdHash = hashForLookup(input.employeeId);
    const phoneEncrypted = encrypt(input.phone);
    
    // Generate member ID
    const year = new Date().getFullYear();
    // Get next sequence number from database
    const lastMembers = await db
      .select({ memberId: users.memberId })
      .from(users)
      .orderBy(users.createdAt)
      .limit(1);
    
    let sequence = 1;
    if (lastMembers.length > 0 && lastMembers[0]) {
      const memberIdValue = lastMembers[0].memberId;
      if (typeof memberIdValue === 'string') {
        const parts = (memberIdValue as string).split('-');
        if (parts.length === 3) {
          const lastSeq = parseInt(parts[2]!, 10);
          if (!isNaN(lastSeq)) {
            sequence = lastSeq + 1;
          }
        }
      }
    }
    
    const memberId = generateMemberId(year, sequence);
    
    try {
      // Create user and savings accounts in transaction
      const result = await db.transaction(async (trx) => {
        // Insert user
        const insertedUsers = await trx
          .insert(users)
          .values({
            memberId,
            employeeIdEncrypted,
            employeeIdHash,
            fullName: input.fullName,
            phoneEncrypted,
            phoneHash,
            email: input.email,
            passwordHash,
            department: input.department,
            dateJoined: input.dateJoined,
            isApproved: false,
            roles: ['MEMBER'],
          } as any)
          .returning({ id: users.id });
        
        const user = insertedUsers[0];
        if (!user || !user.id) {
          throw new Error('Failed to create user');
        }
        
        // Create Normal Savings account
        await trx.insert(savingsAccounts).values({
          userId: user.id,
          accountType: 'NORMAL',
          balanceKobo: 0,
        } as any);
        
        // Create Special Savings account
        await trx.insert(savingsAccounts).values({
          userId: user.id,
          accountType: 'SPECIAL',
          balanceKobo: 0,
        } as any);
        
        return { userId: toUserId(user.id), memberId: toMemberId(memberId) };
      });
      
      // TODO: Send SMS notification
      // TODO: Notify SECRETARY and TREASURER users
      // TODO: Create audit log entry
      
      return ok({
        userId: result.userId,
        memberId: result.memberId,
        message: 'Registration successful. Awaiting approval.',
      });
    } catch (error: any) {
      if (error.code === '23505') {
        // Unique constraint violation
        if (error.constraint?.includes('employee_id')) {
          return err(AuthErrorCode.DUPLICATE_EMPLOYEE_ID);
        }
        if (error.constraint?.includes('phone')) {
          return err(AuthErrorCode.DUPLICATE_PHONE);
        }
      }
      throw error;
    }
  }

  /**
   * Login with credentials
   */
  async login(input: LoginInput): Promise<Result<LoginResult, AuthErrorCode>> {
    // Find user by member_id or phone
    const { hashForLookup } = await import('../utils/encryption');
    
    let users_result;
    if (input.identifier.startsWith('VIG-')) {
      // Member ID
      users_result = await db
        .select()
        .from(users)
        .where(eq(users.memberId, input.identifier))
        .limit(1);
    } else {
      // Phone
      const phoneHash = hashForLookup(input.identifier);
      users_result = await db
        .select()
        .from(users)
        .where(eq(users.phoneHash, phoneHash))
        .limit(1);
    }
    
    const user = users_result[0];
    
    if (!user) {
      return err(AuthErrorCode.INVALID_CREDENTIALS);
    }
    
    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return err(AuthErrorCode.ACCOUNT_LOCKED);
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(input.password, user.passwordHash as string);
    
    if (!isValidPassword) {
      // Increment failed login count
      const newFailedCount = ((user.failedLoginCount as number) || 0) + 1;
      const updates: any = { failedLoginCount: newFailedCount };
      
      // Lock account after 5 failed attempts
      if (newFailedCount >= 5) {
        updates.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      }
      
      await db.update(users).set(updates).where(eq(users.id, user.id as string));
      
      return err(AuthErrorCode.INVALID_CREDENTIALS);
    }
    
    // Check if approved
    if (!user.isApproved) {
      return err(AuthErrorCode.ACCOUNT_NOT_APPROVED);
    }
    
    // Check MFA
    if (user.mfaEnabled) {
      if (!input.totpCode) {
        return err(AuthErrorCode.MFA_REQUIRED);
      }
      
      // Verify TOTP code
      const { decrypt, verifyTotpCode } = await import('../utils/encryption');
      if (!user.totpSecretEncrypted) {
        return err(AuthErrorCode.INVALID_MFA_CODE);
      }
      // Convert text back to Buffer (stored as base64 or hex in database)
      const totpSecretBuffer = Buffer.from(user.totpSecretEncrypted as string, 'base64');
      const totpSecret = decrypt(totpSecretBuffer);
      const isValidTotp = verifyTotpCode(totpSecret, input.totpCode);
      
      if (!isValidTotp) {
        return err(AuthErrorCode.INVALID_MFA_CODE);
      }
      
      // TODO: Check for TOTP replay in Redis
    }
    
    // Reset failed login count
    await db
      .update(users)
      .set({ failedLoginCount: 0, lockedUntil: null })
      .where(eq(users.id, user.id as string));
    
    // Generate tokens
    const userId = toUserId(user.id as string);
    const memberId = toMemberId(user.memberId as string);
    const accessToken = await generateAccessToken(userId, memberId, user.roles as string[]);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);
    
    // Store refresh token in Redis
    const refreshTokenKey = `refresh:${userId}`;
    await this.redis.set(refreshTokenKey, refreshTokenHash, getRefreshTokenTtlSeconds());
    
    // TODO: Create audit log entry
    
    return ok({
      accessToken,
      refreshToken,
      user: {
        id: userId,
        memberId,
        fullName: user.fullName as string,
        roles: user.roles as string[],
        mfaEnabled: user.mfaEnabled as boolean,
      },
    });
  }

  /**
   * Logout (blacklist JWT and delete refresh token)
   */
  async logout(userId: UserId, jti: string, exp: number): Promise<void> {
    // Blacklist JWT
    const ttl = Math.max(0, exp - Math.floor(Date.now() / 1000));
    if (ttl > 0) {
      await this.redis.set(`jwt:blacklist:${jti}`, '1', ttl);
    }
    
    // Delete refresh token
    await this.redis.del(`refresh:${userId}`);
    
    // TODO: Create audit log entry
  }

  /**
   * Request password reset (send OTP)
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<Result<{ message: string }, never>> {
    // Always return success to prevent user enumeration
    
    // Find user
    const { hashForLookup } = await import('../utils/encryption');
    
    let users_result;
    if (input.identifier.startsWith('VIG-')) {
      users_result = await db
        .select()
        .from(users)
        .where(eq(users.memberId, input.identifier))
        .limit(1);
    } else {
      const phoneHash = hashForLookup(input.identifier);
      users_result = await db
        .select()
        .from(users)
        .where(eq(users.phoneHash, phoneHash))
        .limit(1);
    }
    
    const user = users_result[0];
    
    if (user) {
      // Generate OTP
      const otp = generateNumericOtp(6);
      const otpHash = await hashValue(otp);
      
      // Store OTP in Redis (10 minutes)
      const otpKey = `otp:${user.id}`;
      await this.redis.set(otpKey, otpHash, 10 * 60);
      
      // TODO: Send OTP via SMS
      // TODO: Create audit log entry
    }
    
    return ok({ message: 'If the account exists, an OTP has been sent.' });
  }

  /**
   * Reset password with OTP
   */
  async resetPassword(input: ResetPasswordInput): Promise<Result<{ message: string }, AuthErrorCode>> {
    // Find user
    const { hashForLookup } = await import('../utils/encryption');
    
    let users_result;
    if (input.identifier.startsWith('VIG-')) {
      users_result = await db
        .select()
        .from(users)
        .where(eq(users.memberId, input.identifier))
        .limit(1);
    } else {
      const phoneHash = hashForLookup(input.identifier);
      users_result = await db
        .select()
        .from(users)
        .where(eq(users.phoneHash, phoneHash))
        .limit(1);
    }
    
    const user = users_result[0];
    
    if (!user) {
      return err(AuthErrorCode.USER_NOT_FOUND);
    }
    
    // Verify OTP
    const otpKey = `otp:${user.id}`;
    const storedOtpHash = await this.redis.get(otpKey);
    
    if (!storedOtpHash) {
      return err(AuthErrorCode.OTP_EXPIRED);
    }
    
    const isValidOtp = await verifyValue(input.otp, storedOtpHash);
    
    if (!isValidOtp) {
      return err(AuthErrorCode.INVALID_OTP);
    }
    
    // Hash new password
    const newPasswordHash = await hashPassword(input.newPassword);
    
    // Update password
    await db
      .update(users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.id, user.id as string));
    
    // Delete OTP
    await this.redis.del(otpKey);
    
    // Invalidate all refresh tokens
    await this.redis.del(`refresh:${user.id}`);
    
    // TODO: Create audit log entry
    
    return ok({ message: 'Password reset successful.' });
  }
}
