import { NextRequest, NextResponse } from 'next/server';
import { successResponse, errorResponse, ErrorCode, getHttpStatusCode } from '@/utils/api-response';
import { verifyAccessToken } from '@/utils/jwt';
import { listPendingMembers } from '@/services/member.service';
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
    
    // Check if user has required role (SECRETARY, TREASURER, or ADMIN)
    const userRoles = decoded.roles || [];
    const hasPermission = userRoles.some((role: string) => 
      ['SECRETARY', 'TREASURER', 'ADMIN'].includes(role)
    );
    
    if (!hasPermission) {
      return NextResponse.json(
        errorResponse(ErrorCode.FORBIDDEN, 'You do not have permission to view pending members', requestId),
        { status: 403 }
      );
    }

    // Get pending members
    const result = await listPendingMembers();

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
    console.error('Error fetching pending members:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch pending members', requestId),
      { status: 500 }
    );
  }
}
