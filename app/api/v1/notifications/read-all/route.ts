import { NextRequest, NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/server/db/init';
import { notifications } from '@/server/db/schema';
import { successResponse, errorResponse, ErrorCode } from '@/utils/api-response';
import { verifyAccessToken } from '@/utils/jwt';
import { randomUUID } from 'crypto';

export async function PATCH(request: NextRequest) {
  const requestId = randomUUID();

  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        errorResponse(ErrorCode.UNAUTHORIZED, 'Missing authorization header', requestId),
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = await verifyAccessToken(token);
    const userId = decoded.userId;

    // Get all unread notifications
    const unreadNotifications = await db
      .select({
        id: notifications.id,
        metadata: notifications.metadata,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
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

    return NextResponse.json(
      successResponse(
        {
          message: 'All notifications marked as read',
          count: unreadNotifications.length,
        },
        requestId
      )
    );
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.DATABASE_ERROR, 'Failed to update notifications', requestId),
      { status: 500 }
    );
  }
}
