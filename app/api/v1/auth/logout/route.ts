import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { successResponse, errorResponse, ErrorCode } from '@/utils/api-response';
import { verifyAccessToken } from '@/utils/jwt';
import { getRedisClient } from '@/lib/redis';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
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

    // Get Redis client
    const redis = await getRedisClient();
    const authService = new AuthService(redis);

    // Logout
    await authService.logout(decoded.userId as any, decoded.jti, decoded.exp);

    // Create response with cleared cookie
    const response = NextResponse.json(
      successResponse({ message: 'Logged out successfully' }, requestId)
    );

    // Clear refresh token cookie
    response.cookies.set('refreshToken', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      errorResponse(ErrorCode.INTERNAL_ERROR, 'Logout failed', requestId),
      { status: 500 }
    );
  }
}
