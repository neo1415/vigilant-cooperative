import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedUser } from './authentication';

/**
 * Role-based access control (RBAC) middleware
 */
export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser | undefined;

    if (!user) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Check if user has any of the allowed roles
    const hasRole = allowedRoles.some((role) => user.roles.includes(role));

    if (!hasRole) {
      return reply.code(403).send({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          details: {
            required: allowedRoles,
            current: user.roles,
          },
        },
      });
    }
  };
}

/**
 * Check if user owns the resource or has admin role
 */
export function requireOwnershipOrRole(
  getResourceOwnerId: (request: FastifyRequest) => string | Promise<string>,
  ...adminRoles: string[]
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthenticatedUser | undefined;

    if (!user) {
      return reply.code(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    // Check if user has admin role
    const hasAdminRole = adminRoles.some((role) => user.roles.includes(role));
    if (hasAdminRole) {
      return; // Admin can access any resource
    }

    // Check ownership
    const resourceOwnerId = await getResourceOwnerId(request);
    if (user.id === resourceOwnerId) {
      return; // User owns the resource
    }

    return reply.code(403).send({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this resource',
      },
    });
  };
}

/**
 * Common role constants
 */
export const ROLES = {
  MEMBER: 'MEMBER',
  COMMITTEE_MEMBER: 'COMMITTEE_MEMBER',
  PRESIDENT: 'PRESIDENT',
  TREASURER: 'TREASURER',
  SECRETARY: 'SECRETARY',
  ADMIN: 'ADMIN',
} as const;
