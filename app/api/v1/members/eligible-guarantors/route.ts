import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, ErrorCode } from '@/utils/api-response';
import { verifyAccessToken } from '@/utils/jwt';
import { db } from '@/server/db/init';
import { users } from '@/server/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        errorResponse(ErrorCode.UNAUTHORIZED, 'Missing authorization', requestId),
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = await verifyAccessToken(token);
    const userId = decoded.userId;

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
          sql`${users.id} != ${userId}` // Exclude self
        )
      )
      .orderBy(users.fullName);

    return NextResponse.json(
      successResponse(
        {
          members: eligibleMembers,
        },
        requestId
      )
    );
  } catch (error) {
    console.error('Error fetching eligible guarantors:', error);
    return NextResponse.json(
      errorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Failed to fetch eligible guarantors',
        requestId,
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ),
      { status: 500 }
    );
  }
}
