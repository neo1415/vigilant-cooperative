/**
 * Authentication Routes
 * 
 * Handles user authentication endpoints:
 * - POST /auth/register - Member registration
 * - POST /auth/login - Login with credentials
 * - POST /auth/logout - Logout (blacklist JWT)
 * - POST /auth/refresh - Refresh access token
 * - POST /auth/forgot-password - Request password reset OTP
 * - POST /auth/reset-password - Reset password with OTP
 * 
 * @module routes/auth
 */

import type { FastifyInstance } from 'fastify';
import { AuthService } from '../../services/auth.service';
import {
  registrationSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  validateSchema,
} from '../../utils/validation';
import {
  successResponse,
  errorResponse,
  ErrorCode,
  getHttpStatusCode,
} from '../../utils/api-response';
import { verifyAccessToken } from '../../utils/jwt';
import type { AuthenticatedUser } from '../middleware/authentication';
import type { RedisClient } from '../redis/client';

// Extend Fastify types to include decorators
declare module 'fastify' {
  interface FastifyInstance {
    redis: RedisClient;
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

/**
 * Register authentication routes
 */
export async function authRoutes(fastify: FastifyInstance, options: any) {
  const authService = new AuthService(fastify.redis);

  /**
   * POST /api/v1/auth/register
   * Register a new member
   */
  fastify.post('/api/v1/auth/register', async (request, reply) => {
    // Validate input
    const validation = validateSchema(registrationSchema, request.body);
    
    if (!validation.success) {
      const statusCode = getHttpStatusCode(ErrorCode.VALIDATION_ERROR);
      return reply.code(statusCode).send(
        errorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Validation failed',
          request.id,
          validation.errors
        )
      );
    }

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
      return reply.code(statusCode).send(
        errorResponse(errorCode, message, request.id)
      );
    }

    return reply.code(201).send(
      successResponse(
        {
          memberId: result.value.memberId,
          message: result.value.message,
        },
        request.id
      )
    );
  });

  /**
   * POST /api/v1/auth/login
   * Login with credentials
   */
  fastify.post('/api/v1/auth/login', async (request, reply) => {
    // Validate input
    const validation = validateSchema(loginSchema, request.body);
    
    if (!validation.success) {
      const statusCode = getHttpStatusCode(ErrorCode.VALIDATION_ERROR);
      return reply.code(statusCode).send(
        errorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Validation failed',
          request.id,
          validation.errors
        )
      );
    }

    // Login
    const result = await authService.login(validation.data);

    if (!result.success) {
      let errorCode: ErrorCode;
      let message: string;
      let details: Record<string, unknown> | undefined;

      switch (result.error) {
        case 'INVALID_CREDENTIALS':
          errorCode = ErrorCode.INVALID_CREDENTIALS;
          message = 'Invalid credentials';
          break;
        case 'ACCOUNT_LOCKED':
          errorCode = ErrorCode.ACCOUNT_LOCKED;
          message = 'Account is locked due to too many failed login attempts';
          break;
        case 'ACCOUNT_NOT_APPROVED':
          errorCode = ErrorCode.MEMBER_NOT_APPROVED;
          message = 'Account is pending approval';
          break;
        case 'MFA_REQUIRED':
          errorCode = ErrorCode.MFA_REQUIRED;
          message = 'MFA code required';
          break;
        case 'INVALID_MFA_CODE':
          errorCode = ErrorCode.MFA_REQUIRED;
          message = 'Invalid MFA code';
          break;
        default:
          errorCode = ErrorCode.INTERNAL_ERROR;
          message = 'Login failed';
      }

      const statusCode = getHttpStatusCode(errorCode);
      return reply.code(statusCode).send(
        errorResponse(errorCode, message, request.id, details)
      );
    }

    // Set refresh token cookie
    reply.setCookie('refreshToken', result.value.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return reply.send(
      successResponse(
        {
          accessToken: result.value.accessToken,
          user: result.value.user,
        },
        request.id
      )
    );
  });

  /**
   * POST /api/v1/auth/logout
   * Logout (blacklist JWT and delete refresh token)
   */
  fastify.post('/api/v1/auth/logout', {
    onRequest: [fastify.authenticate],
  }, async (request, reply) => {
    const user = (request as any).user as AuthenticatedUser;

    // Extract JWT expiration from token
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.code(401).send(
        errorResponse(ErrorCode.UNAUTHORIZED, 'Missing authorization header', request.id)
      );
    }

    const token = authHeader.substring(7); // Remove "Bearer "
    const decoded = await verifyAccessToken(token);

    // Logout
    await authService.logout(user.id as any, user.jti, decoded.exp);

    // Clear refresh token cookie
    reply.clearCookie('refreshToken', { path: '/' });

    return reply.send(
      successResponse({ message: 'Logged out successfully' }, request.id)
    );
  });

  /**
   * POST /api/v1/auth/forgot-password
   * Request password reset OTP
   */
  fastify.post('/api/v1/auth/forgot-password', async (request, reply) => {
    // Validate input
    const validation = validateSchema(forgotPasswordSchema, request.body);
    
    if (!validation.success) {
      const statusCode = getHttpStatusCode(ErrorCode.VALIDATION_ERROR);
      return reply.code(statusCode).send(
        errorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Validation failed',
          request.id,
          validation.errors
        )
      );
    }

    // Request password reset
    const result = await authService.forgotPassword(validation.data);

    return reply.send(
      successResponse({ message: result.success ? result.value.message : 'If the account exists, an OTP has been sent.' }, request.id)
    );
  });

  /**
   * POST /api/v1/auth/reset-password
   * Reset password with OTP
   */
  fastify.post('/api/v1/auth/reset-password', async (request, reply) => {
    // Validate input
    const validation = validateSchema(resetPasswordSchema, request.body);
    
    if (!validation.success) {
      const statusCode = getHttpStatusCode(ErrorCode.VALIDATION_ERROR);
      return reply.code(statusCode).send(
        errorResponse(
          ErrorCode.VALIDATION_ERROR,
          'Validation failed',
          request.id,
          validation.errors
        )
      );
    }

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
      return reply.code(statusCode).send(
        errorResponse(errorCode, message, request.id)
      );
    }

    return reply.send(
      successResponse({ message: result.value.message }, request.id)
    );
  });
}
