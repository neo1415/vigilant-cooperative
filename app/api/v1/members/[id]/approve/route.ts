import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, ErrorCode, getHttpStatusCode } from '@/utils/api-response';
import { verifyAccessToken } from '@/utils/jwt';
import { approveMember } from '@/services/member.service';
import { randomUUID } from 'crypto';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = randomUUID();
  const { id } = await params;
  
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
    
    // Check if user has required role (SECRETARY, TREASURER, or ADMIN)
    const userRoles = decoded.roles || [];
    const hasPermission = userRoles.some((role: string) => 
      ['SECRETARY', 'TREASURER', 'ADMIN'].includes(role)
    );
    
    if (!hasPermission) {
      return NextResponse.json(
        errorResponse(ErrorCode.FORBIDDEN, 'You do not have permission to approve members', requestId),
        { status: 403 }
      );
    }

    // Approve member
    const result = await approveMember(id, userId);

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
    console.error('Error approving member:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to approve member', requestId),
      { status: 500 }
    );
  }
}
