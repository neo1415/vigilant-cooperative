/**
 * Member Service Layer
 * Handles member profile management, approval workflow, and member queries
 */

import { db } from '../server/db/init';
import { users, auditLog } from '../server/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import type { Result } from '../types/result';
import { ok, err } from '../types/result';

/**
 * Member profile data structure
 */
export interface MemberProfile {
  id: string;
  memberId: string;
  fullName: string;
  email: string | null;
  department: string | null;
  employmentStatus: string | null;
  dateJoined: Date;
  isApproved: boolean;
  roles: string[];
  mfaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Update profile data structure
 */
export interface UpdateProfileData {
  email?: string;
  department?: string;
}

/**
 * Member error codes
 */
export type MemberErrorCode = 
  | 'MEMBER_NOT_FOUND'
  | 'DATABASE_ERROR'
  | 'OPTIMISTIC_LOCK_CONFLICT'
  | 'VALIDATION_ERROR'
  | 'UPDATE_FAILED'
  | 'SERVICE_BUSY'
  | 'ALREADY_APPROVED';

/**
 * Member service error structure
 */
export interface MemberServiceError {
  code: MemberErrorCode;
  message: string;
  details?: Record<string, unknown> | string;
}

/**
 * Get member profile by user ID
 */
export async function getMemberProfile(userId: string): Promise<Result<MemberProfile, MemberServiceError>> {
  try {
    const [user] = await db
      .select({
        id: users.id,
        memberId: users.memberId,
        fullName: users.fullName,
        email: users.email,
        department: users.department,
        employmentStatus: users.employmentStatus,
        dateJoined: users.dateJoined,
        isApproved: users.isApproved,
        roles: users.roles,
        mfaEnabled: users.mfaEnabled,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      return err({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member not found',
      });
    }

    return ok(user as MemberProfile);
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: 'Failed to retrieve member profile',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Update member profile with version check (optimistic locking)
 */
export async function updateMemberProfile(
  userId: string,
  data: UpdateProfileData,
  currentVersion: number,
  updatedBy: string
): Promise<Result<MemberProfile, MemberServiceError>> {
  try {
    // Start transaction
    return await db.transaction(async (trx) => {
      // Get current user with pessimistic lock
      const [currentUser] = await trx
        .select()
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .for('update', { noWait: true });

      if (!currentUser) {
        return err({
          code: 'MEMBER_NOT_FOUND',
          message: 'Member not found',
        });
      }

      // Check version for optimistic locking
      if (currentUser.version !== currentVersion) {
        return err({
          code: 'OPTIMISTIC_LOCK_CONFLICT',
          message: 'Profile was modified by another request. Please refresh and try again.',
          details: {
            expectedVersion: currentVersion,
            actualVersion: currentUser.version,
          },
        });
      }

      // Update profile
      const [updatedUser] = await trx
        .update(users)
        .set({
          ...data,
          version: currentUser.version + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(users.id, userId), eq(users.version, currentVersion)))
        .returning({
          id: users.id,
          memberId: users.memberId,
          fullName: users.fullName,
          email: users.email,
          department: users.department,
          employmentStatus: users.employmentStatus,
          dateJoined: users.dateJoined,
          isApproved: users.isApproved,
          roles: users.roles,
          mfaEnabled: users.mfaEnabled,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        });

      if (!updatedUser) {
        return err({
          code: 'UPDATE_FAILED',
          message: 'Failed to update profile',
        });
      }

      // Create audit log entry
      await trx.insert(auditLog).values({
        userId: updatedBy,
        action: 'MEMBER_PROFILE_UPDATED',
        resourceType: 'USER',
        resourceId: userId,
        previousValue: {
          email: currentUser.email,
          department: currentUser.department,
        },
        newValue: data,
        createdAt: new Date(),
      });

      return ok(updatedUser as MemberProfile);
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '55P03') {
      // Lock not available
      return err({
        code: 'SERVICE_BUSY',
        message: 'Profile is being updated by another request. Please try again.',
      });
    }

    return err({
      code: 'DATABASE_ERROR',
      message: 'Failed to update member profile',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Approve member registration (admin only)
 */
export async function approveMember(
  memberId: string,
  approvedBy: string
): Promise<Result<{ memberId: string; approvedAt: Date }, MemberServiceError>> {
  try {
    return await db.transaction(async (trx) => {
      // Get member with pessimistic lock
      const [member] = await trx
        .select()
        .from(users)
        .where(and(eq(users.id, memberId), isNull(users.deletedAt)))
        .for('update', { noWait: true });

      if (!member) {
        return err({
          code: 'MEMBER_NOT_FOUND',
          message: 'Member not found',
        });
      }

      // Check if already approved
      if (member.isApproved) {
        return err({
          code: 'ALREADY_APPROVED',
          message: 'Member is already approved',
        });
      }

      const approvedAt = new Date();

      // Approve member
      await trx
        .update(users)
        .set({
          isApproved: true,
          approvedBy,
          approvedAt,
          version: member.version + 1,
          updatedAt: approvedAt,
        })
        .where(eq(users.id, memberId));

      // Create audit log entry
      await trx.insert(auditLog).values({
        userId: approvedBy,
        action: 'MEMBER_APPROVED',
        resourceType: 'USER',
        resourceId: memberId,
        previousValue: { isApproved: false },
        newValue: { isApproved: true, approvedBy, approvedAt },
        createdAt: approvedAt,
      });

      return ok({
        memberId: member.memberId,
        approvedAt,
      });
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '55P03') {
      return err({
        code: 'SERVICE_BUSY',
        message: 'Member approval is being processed. Please try again.',
      });
    }

    return err({
      code: 'DATABASE_ERROR',
      message: 'Failed to approve member',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * List pending member registrations
 */
export async function listPendingMembers(): Promise<
  Result<
    Array<{
      id: string;
      memberId: string;
      fullName: string;
      email: string | null;
      department: string | null;
      dateJoined: Date;
      createdAt: Date;
    }>,
    MemberServiceError
  >
> {
  try {
    const pendingMembers = await db
      .select({
        id: users.id,
        memberId: users.memberId,
        fullName: users.fullName,
        email: users.email,
        department: users.department,
        dateJoined: users.dateJoined,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.isApproved, false), isNull(users.deletedAt)))
      .orderBy(desc(users.createdAt));

    return ok(pendingMembers);
  } catch (error) {
    return err({
      code: 'DATABASE_ERROR',
      message: 'Failed to retrieve pending members',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
