import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { registrationSchema, validateSchema } from '@/utils/validation';
import { successResponse, errorResponse, ErrorCode, getHttpStatusCode } from '@/utils/api-response';
import { getRedisClient } from '@/lib/redis';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  try {
    const body = await request.json();
    
    // Validate input
    const validation = validateSchema(registrationSchema, body);
    
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

    // Register user
    const result = await authService.register(validation.data);

    if (!result.success) {
      let errorCode: ErrorCode;
      let message: string;

      switch (result.error) {
        case 'DUPLICATE_EMPLOYEE_ID':
          errorCode = ErrorCode.DUPLICATE_EMPLOYEE_ID;
          message = 'Employee ID already registered';
          break;
        case 'DUPLICATE_PHONE':
          errorCode = ErrorCode.DUPLICATE_PHONE;
          message = 'Phone number already registered';
          break;
        default:
          errorCode = ErrorCode.INTERNAL_ERROR;
          message = 'Registration failed';
      }

      const statusCode = getHttpStatusCode(errorCode);
      return NextResponse.json(
        errorResponse(errorCode, message, requestId),
        { status: statusCode }
      );
    }

    return NextResponse.json(
      successResponse(
        {
          memberId: result.value.memberId,
          message: result.value.message,
        },
        requestId
      ),
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.INTERNAL_ERROR, 'Registration failed', requestId),
      { status: 500 }
    );
  }
}
