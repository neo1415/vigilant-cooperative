import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedUser } from './authentication';

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  previousValue: any;
  newValue: any;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

/**
 * Audit logging middleware for all mutations
 * Captures before/after state for financial operations
 */
export function createAuditLogMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Only audit mutating methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      return;
    }

    const user = (request as any).user as AuthenticatedUser | undefined;

    // Store audit context in request
    (request as any).auditContext = {
      userId: user?.id || null,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] || 'unknown',
      method: request.method,
      url: request.url,
      timestamp: new Date(),
    };
  };
}

/**
 * Helper to create audit log entry
 * To be used in service layer when performing mutations
 */
export function createAuditLogEntry(
  request: FastifyRequest,
  action: string,
  resourceType: string,
  resourceId: string,
  previousValue: any,
  newValue: any
): AuditLogEntry {
  const context = (request as any).auditContext || {};

  return {
    userId: context.userId || null,
    action,
    resourceType,
    resourceId,
    previousValue,
    newValue,
    ipAddress: context.ipAddress || request.ip,
    userAgent: context.userAgent || request.headers['user-agent'] || 'unknown',
    timestamp: context.timestamp || new Date(),
  };
}
