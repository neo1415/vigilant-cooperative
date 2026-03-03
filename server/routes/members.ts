/**
 * Member Routes
 * 
 * Handles member management endpoints:
 * - GET /members/me - Get own profile
 * - PATCH /members/me - Update own profile
 * - GET /members/:id - Get member profile (officers only)
 * - PATCH /members/:id - Update member (admin only)
 * - PATCH /members/:id/approve - Approve registration (admin only)
 * - GET /members/pending - List pending registrations (admin only)
 * 
 * @module routes/members
 */

import type { FastifyInstance } from 'fastify';
import {
  getMemberProfile,
  updateMemberProfile,
  approveMember,
  listPendingMembers,
} from '../../services/member.service';
import { db } from '../db/init';
import { users, savingsAccounts, loans } from '../db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import {
  successResponse,
  errorResponse,
  ErrorCode,
  getHttpStatusCode,
} from '../../utils/api-response';
import type { AuthenticatedUser } from '../middleware/authentication';
import { requireRole, ROLES } from '../middleware/authorization';
import { z } from 'zod';

// Validation schemas
const updateProfileSchema = z.object({
  email: z.string().email().optional(),
  department: z.string().min(1).max(100).optional(),
});

const updateMemberSchema = z.object({
  email: z.string().email().optional(),
  department: z.string().min(1).max(100).optional(),
  employmentStatus: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});

/**
 * Register member routes
 */
export async function memberRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/v1/members/me
   * Get own profile with savings and loans summary
   */
  fastify.get(
    '/api/v1/members/me',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = (request as any).user as AuthenticatedUser;

      // Get member profile
      const profileResult = await getMemberProfile(user.id);

      if (!profileResult.success) {
        const statusCode = getHttpStatusCode(
          profileResult.error.code as ErrorCode
        );
        return reply.code(statusCode).send(
          errorResponse(
            profileResult.error.code as ErrorCode,
            profileResult.error.message,
            request.id,
            profileResult.error.details
          )
        );
      }

      // Get savings accounts summary
      const savingsAccountsData = await db
        .select({
          id: savingsAccounts.id,
          accountType: savingsAccounts.accountType,
          balanceKobo: savingsAccounts.balanceKobo,
        })
        .from(savingsAccounts)
        .where(
          and(
            eq(savingsAccounts.userId, user.id),
            isNull(savingsAccounts.deletedAt)
          )
        );

      // Get active loans summary
      const activeLoans = await db
        .select({
          id: loans.id,
          loanReference: loans.loanReference,
          loanType: loans.loanType,
          principalKobo: loans.principalKobo,
          outstandingKobo: loans.outstandingKobo,
          status: loans.status,
        })
        .from(loans)
        .where(
          and(
            eq(loans.applicantId, user.id),
            inArray(loans.status, ['ACTIVE', 'DISBURSED']),
            isNull(loans.deletedAt)
          )
        );

      return reply.send(
        successResponse(
          {
            profile: profileResult.data,
            savingsAccounts: savingsAccountsData,
            activeLoans,
          },
          request.id
        )
      );
    }
  );

  /**
   * PATCH /api/v1/members/me
   * Update own profile
   */
  fastify.patch(
    '/api/v1/members/me',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = (request as any).user as AuthenticatedUser;

      // Validate input
      const validation = updateProfileSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.code(400).send(
          errorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Validation failed',
            request.id,
            validation.error.errors
          )
        );
      }

      // Get current version from body
      const { version } = request.body as any;
      if (typeof version !== 'number') {
        return reply.code(400).send(
          errorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Version number is required for optimistic locking',
            request.id
          )
        );
      }

      // Update profile
      const result = await updateMemberProfile(
        user.id,
        validation.data,
        version,
        user.id
      );

      if (!result.success) {
        const statusCode = getHttpStatusCode(result.error.code as ErrorCode);
        return reply.code(statusCode).send(
          errorResponse(
            result.error.code as ErrorCode,
            result.error.message,
            request.id,
            result.error.details
          )
        );
      }

      return reply.send(successResponse(result.data, request.id));
    }
  );

  /**
   * GET /api/v1/members/:id
   * Get member profile by ID (officers only)
   */
  fastify.get(
    '/api/v1/members/:id',
    {
      onRequest: [
        fastify.authenticate,
        requireRole(
          ROLES.SECRETARY,
          ROLES.TREASURER,
          ROLES.PRESIDENT,
          ROLES.COMMITTEE_MEMBER,
          ROLES.ADMIN
        ),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      // Get member profile
      const profileResult = await getMemberProfile(id);

      if (!profileResult.success) {
        const statusCode = getHttpStatusCode(
          profileResult.error.code as ErrorCode
        );
        return reply.code(statusCode).send(
          errorResponse(
            profileResult.error.code as ErrorCode,
            profileResult.error.message,
            request.id,
            profileResult.error.details
          )
        );
      }

      // Get savings accounts summary
      const savingsAccountsData = await db
        .select({
          id: savingsAccounts.id,
          accountType: savingsAccounts.accountType,
          balanceKobo: savingsAccounts.balanceKobo,
        })
        .from(savingsAccounts)
        .where(
          and(eq(savingsAccounts.userId, id), isNull(savingsAccounts.deletedAt))
        );

      // Get loans summary
      const loansData = await db
        .select({
          id: loans.id,
          loanReference: loans.loanReference,
          loanType: loans.loanType,
          principalKobo: loans.principalKobo,
          outstandingKobo: loans.outstandingKobo,
          status: loans.status,
          submittedAt: loans.submittedAt,
        })
        .from(loans)
        .where(and(eq(loans.applicantId, id), isNull(loans.deletedAt)));

      return reply.send(
        successResponse(
          {
            profile: profileResult.data,
            savingsAccounts: savingsAccountsData,
            loans: loansData,
          },
          request.id
        )
      );
    }
  );

  /**
   * PATCH /api/v1/members/:id
   * Update member profile (admin only)
   */
  fastify.patch(
    '/api/v1/members/:id',
    {
      onRequest: [fastify.authenticate, requireRole(ROLES.ADMIN)],
    },
    async (request, reply) => {
      const user = (request as any).user as AuthenticatedUser;
      const { id } = request.params as { id: string };

      // Validate input
      const validation = updateMemberSchema.safeParse(request.body);

      if (!validation.success) {
        return reply.code(400).send(
          errorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Validation failed',
            request.id,
            validation.error.errors
          )
        );
      }

      // Get current version from body
      const { version } = request.body as any;
      if (typeof version !== 'number') {
        return reply.code(400).send(
          errorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Version number is required for optimistic locking',
            request.id
          )
        );
      }

      // Update profile
      const result = await updateMemberProfile(
        id,
        validation.data,
        version,
        user.id
      );

      if (!result.success) {
        const statusCode = getHttpStatusCode(result.error.code as ErrorCode);
        return reply.code(statusCode).send(
          errorResponse(
            result.error.code as ErrorCode,
            result.error.message,
            request.id,
            result.error.details
          )
        );
      }

      return reply.send(successResponse(result.data, request.id));
    }
  );

  /**
   * PATCH /api/v1/members/:id/approve
   * Approve member registration (admin only)
   */
  fastify.patch(
    '/api/v1/members/:id/approve',
    {
      onRequest: [
        fastify.authenticate,
        requireRole(ROLES.SECRETARY, ROLES.TREASURER, ROLES.ADMIN),
      ],
    },
    async (request, reply) => {
      const user = (request as any).user as AuthenticatedUser;
      const { id } = request.params as { id: string };

      // Approve member
      const result = await approveMember(id, user.id);

      if (!result.success) {
        const statusCode = getHttpStatusCode(result.error.code as ErrorCode);
        return reply.code(statusCode).send(
          errorResponse(
            result.error.code as ErrorCode,
            result.error.message,
            request.id,
            result.error.details
          )
        );
      }

      return reply.send(successResponse(result.data, request.id));
    }
  );

  /**
   * GET /api/v1/members/pending
   * List pending member registrations (admin only)
   */
  fastify.get(
    '/api/v1/members/pending',
    {
      onRequest: [
        fastify.authenticate,
        requireRole(ROLES.SECRETARY, ROLES.TREASURER, ROLES.ADMIN),
      ],
    },
    async (request, reply) => {
      // Get pending members
      const result = await listPendingMembers();

      if (!result.success) {
        const statusCode = getHttpStatusCode(result.error.code as ErrorCode);
        return reply.code(statusCode).send(
          errorResponse(
            result.error.code as ErrorCode,
            result.error.message,
            request.id,
            result.error.details
          )
        );
      }

      return reply.send(successResponse(result.data, request.id));
    }
  );

  /**
   * GET /api/v1/members/eligible-guarantors
   * List eligible guarantors (active, approved members excluding self)
   */
  fastify.get(
    '/api/v1/members/eligible-guarantors',
    {
      onRequest: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = (request as any).user as AuthenticatedUser;

      try {
        // Get all active, approved members except the current user
        const eligibleMembers = await db
          .select({
            id: users.id,
            memberId: users.memberId,
            fullName: users.fullName,
            department: users.department,
          })
          .from(users)
          .where(
            and(
              eq(users.isApproved, true),
              eq(users.employmentStatus, 'ACTIVE'),
              isNull(users.deletedAt),
              sql`${users.id} != ${user.id}` // Exclude self
            )
          )
          .orderBy(users.fullName);

        return reply.send(
          successResponse(
            {
              members: eligibleMembers,
            },
            request.id
          )
        );
      } catch (error) {
        return reply.code(500).send(
          errorResponse(
            ErrorCode.DATABASE_ERROR,
            'Failed to fetch eligible guarantors',
            request.id,
            error instanceof Error ? error.message : 'Unknown error'
          )
        );
      }
    }
  );
}
