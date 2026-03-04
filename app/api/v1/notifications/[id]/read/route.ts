import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/server/db/init';
import { notifications } from '@/server/db/schema';
import { successResponse, errorResponse, ErrorCode } from '@/utils/api-response';
import { verifyAccessToken } from '@/utils/jwt';
import { randomUUID } from 'crypto';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();

  try {
    // Await params
    const { id } = await params;

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
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .limit(1);

    if (notification.length === 0) {
      return NextResponse.json(
        errorResponse(ErrorCode.NOT_FOUND, 'Notification not found', requestId),
        { status: 404 }
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

    return NextResponse.json(
      successResponse({ message: 'Notification marked as read' }, requestId)
    );
  } catch (error) {
    console.error('Mark notification as read error:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.DATABASE_ERROR, 'Failed to update notification', requestId),
      { status: 500 }
    );
  }
}
