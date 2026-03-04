import { NextRequest, NextResponse } from 'next/server';
import { getMemberProfile, updateMemberProfile } from '@/services/member.service';
import { db } from '@/server/db/init';
import { savingsAccounts, loans } from '@/server/db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { successResponse, errorResponse, ErrorCode, getHttpStatusCode } from '@/utils/api-response';
import { verifyAccessToken } from '@/utils/jwt';
import { randomUUID } from 'crypto';
import { z } from 'zod';

const updateProfileSchema = z.object({
  email: z.string().email().optional(),
  department: z.string().min(1).max(100).optional(),
});

export async function GET(request: NextRequest) {
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

    // Get member profile
    const profileResult = await getMemberProfile(userId);

    if (!profileResult.success) {
      const statusCode = getHttpStatusCode(profileResult.error.code as ErrorCode);
      return NextResponse.json(
        errorResponse(
          profileResult.error.code as ErrorCode,
          profileResult.error.message,
          requestId,
          typeof profileResult.error.details === 'string'
            ? { message: profileResult.error.details }
            : profileResult.error.details
        ),
        { status: statusCode }
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
      .where(and(eq(savingsAccounts.userId, userId), isNull(savingsAccounts.deletedAt)));

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
          eq(loans.applicantId, userId),
          inArray(loans.status, ['ACTIVE', 'DISBURSED']),
          isNull(loans.deletedAt)
        )
      );

    return NextResponse.json(
      successResponse(
        {
          profile: profileResult.value,
          savingsAccounts: savingsAccountsData,
          activeLoans,
        },
        requestId
      )
    );
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch profile', requestId),
      { status: 500 }
    );
  }
}

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

    const body = await request.json();

    // Validate input
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        errorResponse(ErrorCode.VALIDATION_ERROR, 'Validation failed', requestId, {
          issues: validation.error.issues,
        }),
        { status: 400 }
      );
    }

    // Get current version from body
    const { version } = body;
    if (typeof version !== 'number') {
      return NextResponse.json(
        errorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Version number is required for optimistic locking',
          requestId
        ),
        { status: 400 }
      );
    }

    // Update profile
    const { email, department } = validation.data;
    const result = await updateMemberProfile(
      userId,
      {
        ...(email ? { email } : {}),
        ...(department ? { department } : {}),
      },
      version,
      userId
    );

    if (!result.success) {
      const statusCode = getHttpStatusCode(result.error.code as ErrorCode);
      return NextResponse.json(
        errorResponse(
          result.error.code as ErrorCode,
          result.error.message,
          requestId,
          typeof result.error.details === 'string'
            ? { message: result.error.details }
            : result.error.details
        ),
        { status: statusCode }
      );
    }

    return NextResponse.json(successResponse(result.value, requestId));
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to update profile', requestId),
      { status: 500 }
    );
  }
}
