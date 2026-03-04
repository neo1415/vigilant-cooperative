import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/server/db/init';
import { notifications } from '@/server/db/schema';
import { successResponse, errorResponse, ErrorCode } from '@/utils/api-response';
import { verifyAccessToken } from '@/utils/jwt';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  
  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        errorResponse(ErrorCode.UNAUTHORIZED, 'Missing or invalid authorization header', requestId),
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = await verifyAccessToken(token);
    const userId = decoded.userId;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const filter = searchParams.get('filter') || 'all';
    const offset = (page - 1) * limit;

    // Build where clause
    const whereConditions = [eq(notifications.userId, userId)];
    if (filter === 'unread') {
      whereConditions.push(
        sql`${notifications.metadata}->>'isRead' IS NULL OR ${notifications.metadata}->>'isRead' = 'false'`
      );
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
      .limit(limit + 1)
      .offset(offset);

    const hasMore = userNotifications.length > limit;

    // Get unread count
    const unreadResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          sql`${notifications.metadata}->>'isRead' IS NULL OR ${notifications.metadata}->>'isRead' = 'false'`
        )
      );

    const unreadCount = Number(unreadResult[0]?.count || 0);

    // Format notifications
    const formattedNotifications = userNotifications.slice(0, limit).map((n: any) => ({
      id: n.id,
      type: n.type,
      subject: n.subject,
      body: n.body,
      status: n.status,
      createdAt: n.createdAt,
      isRead:
        n.metadata && typeof n.metadata === 'object' && 'isRead' in n.metadata
          ? n.metadata.isRead === true
          : false,
      metadata: n.metadata,
    }));

    return NextResponse.json(
      successResponse({
        notifications: formattedNotifications,
        unreadCount,
        hasMore,
        page,
        limit,
      }, requestId)
    );
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.DATABASE_ERROR, 'Failed to fetch notifications', requestId),
      { status: 500 }
    );
  }
}
