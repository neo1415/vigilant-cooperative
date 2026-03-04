import type { FastifyInstance } from 'fastify';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/init';
import { notifications } from '../db/schema';
import { successResponse, errorResponse, ErrorCode } from '../../utils/api-response';
import type { AuthenticatedUser } from '../middleware/authentication';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

export async function notificationRoutes(fastify: FastifyInstance) {
  // Get user notifications
  fastify.get(
    '/api/v1/notifications',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user as AuthenticatedUser;
      const { page = '1', limit = '20', filter = 'all' } = request.query as {
        page?: string;
        limit?: string;
        filter?: string;
      };

      const pageNum = parseInt(page, 10);
      const limitNum = Math.min(parseInt(limit, 10), 100);
      const offset = (pageNum - 1) * limitNum;

      try {
        // Build where clause
        const whereConditions = [eq(notifications.userId, user.id)];
        if (filter === 'unread') {
          whereConditions.push(sql`${notifications.metadata}->>'isRead' IS NULL OR ${notifications.metadata}->>'isRead' = 'false'`);
        }

        // Get notifications
        const userNotifications = await db
          .select({
            id: notifications.id,
            userId: notifications.userId,
            type: notifications.type,
            channel: notifications.channel,
            subject: notifications.subject,
            body: notifications.body,
            status: notifications.status,
            sentAt: notifications.sentAt,
            deliveredAt: notifications.deliveredAt,
            failedAt: notifications.failedAt,
            errorMessage: notifications.errorMessage,
            retryCount: notifications.retryCount,
            metadata: notifications.metadata,
            createdAt: notifications.createdAt,
            updatedAt: notifications.updatedAt,
          })
          .from(notifications)
          .where(and(...whereConditions))
          .orderBy(desc(notifications.createdAt))
          .limit(limitNum + 1)
          .offset(offset);

        const hasMore = userNotifications.length > limitNum;

        // Get unread count
        const unreadResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, user.id),
              sql`${notifications.metadata}->>'isRead' IS NULL OR ${notifications.metadata}->>'isRead' = 'false'`
            )
          );

        const unreadCount = Number(unreadResult[0]?.count || 0);

        // Format notifications
        const formattedNotifications = userNotifications.slice(0, limitNum).map((n: any) => ({
          id: n.id,
          type: n.type,
          subject: n.subject,
          body: n.body,
          status: n.status,
          createdAt: n.createdAt,
          isRead: n.metadata && typeof n.metadata === 'object' && 'isRead' in n.metadata
            ? n.metadata.isRead === true
            : false,
          metadata: n.metadata,
        }));

        return reply.send(
          successResponse({
            notifications: formattedNotifications,
            unreadCount,
            hasMore,
            page: pageNum,
            limit: limitNum,
          }, request.id)
        );
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to fetch notifications');
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, 'Failed to fetch notifications', request.id)
        );
      }
    }
  );

  // Mark notification as read
  fastify.patch(
    '/api/v1/notifications/:id/read',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user as AuthenticatedUser;
      const { id } = request.params as { id: string };

      try {
        // Get notification
        const notification = await db
          .select({
            id: notifications.id,
            userId: notifications.userId,
            type: notifications.type,
            subject: notifications.subject,
            body: notifications.body,
            status: notifications.status,
            metadata: notifications.metadata,
            createdAt: notifications.createdAt,
          })
          .from(notifications)
          .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
          .limit(1);

        if (notification.length === 0) {
          return reply.status(404).send(
            errorResponse(ErrorCode.NOT_FOUND, 'Notification not found', request.id)
          );
        }

        // Update metadata to mark as read
        const currentMetadata = notification[0]!.metadata || {};
        const updatedMetadata = {
          ...(typeof currentMetadata === 'object' ? currentMetadata : {}),
          isRead: true,
          readAt: new Date().toISOString(),
        };

        await db
          .update(notifications)
          .set({ metadata: updatedMetadata })
          .where(eq(notifications.id, id));

        return reply.send(successResponse({ message: 'Notification marked as read' }, request.id));
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to mark notification as read');
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, 'Failed to update notification', request.id)
        );
      }
    }
  );

  // Mark all notifications as read
  fastify.patch(
    '/api/v1/notifications/read-all',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = (request as any).user as AuthenticatedUser;

      try {
        // Get all unread notifications
        const unreadNotifications = await db
          .select({
            id: notifications.id,
            metadata: notifications.metadata,
          })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, user.id),
              sql`${notifications.metadata}->>'isRead' IS NULL OR ${notifications.metadata}->>'isRead' = 'false'`
            )
          );

        // Update each notification
        for (const notification of unreadNotifications) {
          const currentMetadata = notification.metadata || {};
          const updatedMetadata = {
            ...(typeof currentMetadata === 'object' ? currentMetadata : {}),
            isRead: true,
            readAt: new Date().toISOString(),
          };

          await db
            .update(notifications)
            .set({ metadata: updatedMetadata })
            .where(eq(notifications.id, notification.id));
        }

        return reply.send(
          successResponse({
            message: 'All notifications marked as read',
            count: unreadNotifications.length,
          }, request.id)
        );
      } catch (error) {
        fastify.log.error({ err: error }, 'Failed to mark all notifications as read');
        return reply.status(500).send(
          errorResponse(ErrorCode.DATABASE_ERROR, 'Failed to update notifications', request.id)
        );
      }
    }
  );
}
