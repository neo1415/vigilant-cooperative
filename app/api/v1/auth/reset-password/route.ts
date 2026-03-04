import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { resetPasswordSchema, validateSchema } from '@/utils/validation';
import { successResponse, errorResponse, ErrorCode, getHttpStatusCode } from '@/utils/api-response';
import { getRedisClient } from '@/lib/redis';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const body = await request.json();
    
    // Validate input
    const validation = validateSchema(resetPasswordSchema, body);
    
    if (!validation.success) {
      const statusCode = getHttpStatusCode(ErrorCode.VALIDATION_ERROR);
      return NextResponse.json(
        errorResponse(ErrorCode.VALIDATION_ERROR, 'Validation failed', requestId, validation.errors),
        { status: statusCode }
      );
    }

    // Get Redis client
    const redis = await getRedisClient();
    const authService = new AuthService(redis);

    // Reset password
    const result = await authService.resetPassword(validation.data);

    if (!result.success) {
      let errorCode: ErrorCode;
      let message: string;

      switch (result.error) {
        case 'USER_NOT_FOUND':
          errorCode = ErrorCode.NOT_FOUND;
          message = 'User not found';
          break;
        case 'OTP_EXPIRED':
          errorCode = ErrorCode.VALIDATION_ERROR;
          message = 'OTP has expired';
          break;
        case 'INVALID_OTP':
          errorCode = ErrorCode.VALIDATION_ERROR;
          message = 'Invalid OTP';
          break;
        default:
          errorCode = ErrorCode.INTERNAL_ERROR;
          message = 'Password reset failed';
      }

      const statusCode = getHttpStatusCode(errorCode);
      return NextResponse.json(
        errorResponse(errorCode, message, requestId),
        { status: statusCode }
      );
    }

    return NextResponse.json(
      successResponse({ message: result.value.message }, requestId)
    );
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.INTERNAL_ERROR, 'Password reset failed', requestId),
      { status: 500 }
    );
  }
}
