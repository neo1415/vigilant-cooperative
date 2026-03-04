import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { forgotPasswordSchema, validateSchema } from '@/utils/validation';
import { successResponse, errorResponse, ErrorCode, getHttpStatusCode } from '@/utils/api-response';
import { getRedisClient } from '@/lib/redis';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const body = await request.json();
    
    // Validate input
    const validation = validateSchema(forgotPasswordSchema, body);
    
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

    // Request password reset
    const result = await authService.forgotPassword(validation.data);

    return NextResponse.json(
      successResponse(
        { message: result.success ? result.value.message : 'If the account exists, an OTP has been sent.' },
        requestId
      )
    );
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.INTERNAL_ERROR, 'Password reset request failed', requestId),
      { status: 500 }
    );
  }
}
