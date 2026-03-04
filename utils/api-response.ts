/**
 * API Response Utilities
 * 
 * Standardized response envelopes and error codes for the API.
 * All API responses follow a consistent structure for success and error cases.
 * 
 * @module utils/api-response
 */

import { KoboAmount } from '../types/branded';

// ============================================================================
// Response Types
// ============================================================================

/**
 * Standard success response envelope
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta: ResponseMeta;
}

/**
 * Standard error response envelope
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: ResponseMeta;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  idempotencyReplayed?: boolean;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

/**
 * Paginated response data
 */
export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Standard error codes used across the API
 */
export enum ErrorCode {
  // Authentication/Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  MFA_REQUIRED = 'MFA_REQUIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_PHONE = 'INVALID_PHONE',
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_MEMBER_ID = 'INVALID_MEMBER_ID',
  INVALID_DATE = 'INVALID_DATE',

  // Business Rules - Savings
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  WITHDRAWAL_LIMIT_EXCEEDED = 'WITHDRAWAL_LIMIT_EXCEEDED',
  MINIMUM_BALANCE_REQUIRED = 'MINIMUM_BALANCE_REQUIRED',
  SAVINGS_ACCOUNT_LOCKED = 'SAVINGS_ACCOUNT_LOCKED',

  // Business Rules - Loans
  LOAN_ELIGIBILITY_FAILED = 'LOAN_ELIGIBILITY_FAILED',
  INVALID_LOAN_STATUS = 'INVALID_LOAN_STATUS',
  GUARANTOR_LIMIT_EXCEEDED = 'GUARANTOR_LIMIT_EXCEEDED',
  GUARANTOR_NOT_ELIGIBLE = 'GUARANTOR_NOT_ELIGIBLE',
  LOAN_AMOUNT_EXCEEDS_ELIGIBILITY = 'LOAN_AMOUNT_EXCEEDS_ELIGIBILITY',
  CONCURRENT_LONG_TERM_LOAN = 'CONCURRENT_LONG_TERM_LOAN',
  INSUFFICIENT_GUARANTORS = 'INSUFFICIENT_GUARANTORS',

  // Business Rules - Payroll
  DUPLICATE_PAYROLL_PERIOD = 'DUPLICATE_PAYROLL_PERIOD',
  PAYROLL_ALREADY_CONFIRMED = 'PAYROLL_ALREADY_CONFIRMED',
  INVALID_PAYROLL_STATUS = 'INVALID_PAYROLL_STATUS',

  // Business Rules - Member
  MEMBER_NOT_APPROVED = 'MEMBER_NOT_APPROVED',
  MEMBER_DEACTIVATED = 'MEMBER_DEACTIVATED',
  DUPLICATE_EMPLOYEE_ID = 'DUPLICATE_EMPLOYEE_ID',
  DUPLICATE_PHONE = 'DUPLICATE_PHONE',
  DUPLICATE_EMAIL = 'DUPLICATE_EMAIL',

  // Business Rules - Ledger
  VOUCHER_NOT_FOUND = 'VOUCHER_NOT_FOUND',
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  ENTRIES_NOT_BALANCED = 'ENTRIES_NOT_BALANCED',
  INVALID_ENTRY_AMOUNT = 'INVALID_ENTRY_AMOUNT',
  INVALID_ACCOUNT_CODE = 'INVALID_ACCOUNT_CODE',
  VOUCHER_ALREADY_POSTED = 'VOUCHER_ALREADY_POSTED',

  // Business Rules - Reporting
  MEMBER_NOT_FOUND = 'MEMBER_NOT_FOUND',
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // System
  OPTIMISTIC_LOCK_CONFLICT = 'OPTIMISTIC_LOCK_CONFLICT',
  REQUEST_IN_FLIGHT = 'REQUEST_IN_FLIGHT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_BUSY = 'SERVICE_BUSY',
  TRANSACTION_DEADLOCK = 'TRANSACTION_DEADLOCK',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',

  // External Services
  PAYMENT_GATEWAY_ERROR = 'PAYMENT_GATEWAY_ERROR',
  SMS_DELIVERY_FAILED = 'SMS_DELIVERY_FAILED',
  EMAIL_DELIVERY_FAILED = 'EMAIL_DELIVERY_FAILED',
  INSUFFICIENT_COOPERATIVE_FUNDS = 'INSUFFICIENT_COOPERATIVE_FUNDS',
}

// ============================================================================
// Response Builders
// ============================================================================

/**
 * Create a success response
 * 
 * @param data - Response data
 * @param requestId - Request ID from middleware
 * @param idempotencyReplayed - Whether response was served from cache
 * @returns Success response envelope
 * 
 * @example
 * ```ts
 * return successResponse({ balance: '100000' }, req.id);
 * ```
 */
export function successResponse<T>(
  data: T,
  requestId: string,
  idempotencyReplayed?: boolean
): SuccessResponse<T> {
  return {
    success: true,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
      ...(idempotencyReplayed && { idempotencyReplayed: true }),
    },
  };
}

/**
 * Create an error response
 * 
 * @param code - Error code
 * @param message - Human-readable error message
 * @param requestId - Request ID from middleware
 * @param details - Additional error details
 * @returns Error response envelope
 * 
 * @example
 * ```ts
 * return errorResponse(
 *   ErrorCode.INSUFFICIENT_BALANCE,
 *   'Withdrawal amount exceeds available balance',
 *   req.id,
 *   { available: '100000', requested: '150000' }
 * );
 * ```
 */
export function errorResponse(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create a paginated success response
 * 
 * @param items - Array of items
 * @param pagination - Pagination metadata
 * @param requestId - Request ID from middleware
 * @returns Paginated success response
 * 
 * @example
 * ```ts
 * return paginatedResponse(
 *   transactions,
 *   { limit: 25, offset: 0, total: 100, hasMore: true },
 *   req.id
 * );
 * ```
 */
export function paginatedResponse<T>(
  items: T[],
  pagination: PaginationMeta,
  requestId: string
): SuccessResponse<PaginatedData<T>> {
  return successResponse(
    {
      items,
      pagination,
    },
    requestId
  );
}

// ============================================================================
// Pagination Utilities
// ============================================================================

/**
 * Calculate pagination metadata
 * 
 * @param total - Total number of items
 * @param limit - Items per page
 * @param offset - Current offset
 * @returns Pagination metadata
 * 
 * @example
 * ```ts
 * const pagination = calculatePagination(100, 25, 0);
 * // { limit: 25, offset: 0, total: 100, hasMore: true }
 * ```
 */
export function calculatePagination(
  total: number,
  limit: number,
  offset: number
): PaginationMeta {
  return {
    limit,
    offset,
    total,
    hasMore: offset + limit < total,
  };
}

/**
 * Parse pagination parameters from query string
 * 
 * @param query - Query parameters
 * @returns Parsed limit and offset
 * 
 * @example
 * ```ts
 * const { limit, offset } = parsePaginationParams(req.query);
 * ```
 */
export function parsePaginationParams(query: Record<string, unknown>): {
  limit: number;
  offset: number;
} {
  const limit = Math.min(
    Math.max(1, parseInt(String(query.limit || 25), 10)),
    100 // Max 100 items per page
  );
  
  const offset = Math.max(0, parseInt(String(query.offset || 0), 10));
  
  return { limit, offset };
}

// ============================================================================
// Currency Formatting for API
// ============================================================================

/**
 * Format kobo amount for API response (as string, not number)
 * 
 * CRITICAL: Monetary values must be transmitted as strings to prevent
 * JavaScript number precision issues on the client side.
 * 
 * @param kobo - Amount in kobo
 * @returns String representation of kobo amount
 * 
 * @example
 * ```ts
 * formatKoboForApi(1050000) // '1050000'
 * ```
 */
export function formatKoboForApi(kobo: KoboAmount): string {
  return kobo.toString();
}

/**
 * Format multiple kobo amounts in an object
 * 
 * @param obj - Object with kobo amounts
 * @param fields - Fields to format
 * @returns Object with formatted amounts
 * 
 * @example
 * ```ts
 * const loan = {
 *   principalKobo: 500000,
 *   interestKobo: 25000,
 *   name: 'John Doe'
 * };
 * 
 * const formatted = formatKoboFields(loan, ['principalKobo', 'interestKobo']);
 * // {
 * //   principalKobo: '500000',
 * //   interestKobo: '25000',
 * //   name: 'John Doe'
 * // }
 * ```
 */
export function formatKoboFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  
  for (const field of fields) {
    if (typeof result[field] === 'number') {
      result[field] = result[field].toString() as T[keyof T];
    }
  }
  
  return result;
}

// ============================================================================
// Validation Error Formatting
// ============================================================================

/**
 * Format Zod validation errors for API response
 * 
 * @param errors - Zod validation errors
 * @returns Formatted error details
 * 
 * @example
 * ```ts
 * const result = schema.safeParse(data);
 * if (!result.success) {
 *   return errorResponse(
 *     ErrorCode.VALIDATION_ERROR,
 *     'Validation failed',
 *     req.id,
 *     formatValidationErrors(result.error.errors)
 *   );
 * }
 * ```
 */
export function formatValidationErrors(
  errors: Array<{ path: (string | number)[]; message: string }>
): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};
  
  for (const error of errors) {
    const field = error.path.join('.');
    if (!formatted[field]) {
      formatted[field] = [];
    }
    formatted[field].push(error.message);
  }
  
  return formatted;
}

// ============================================================================
// HTTP Status Code Mapping
// ============================================================================

/**
 * Map error code to HTTP status code
 * 
 * @param code - Error code
 * @returns HTTP status code
 */
export function getHttpStatusCode(code: ErrorCode): number {
  switch (code) {
    // 400 Bad Request
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.INVALID_AMOUNT:
    case ErrorCode.INVALID_PHONE:
    case ErrorCode.INVALID_EMAIL:
    case ErrorCode.INVALID_MEMBER_ID:
    case ErrorCode.INVALID_DATE:
    case ErrorCode.INSUFFICIENT_BALANCE:
    case ErrorCode.WITHDRAWAL_LIMIT_EXCEEDED:
    case ErrorCode.MINIMUM_BALANCE_REQUIRED:
    case ErrorCode.LOAN_ELIGIBILITY_FAILED:
    case ErrorCode.INVALID_LOAN_STATUS:
    case ErrorCode.GUARANTOR_LIMIT_EXCEEDED:
    case ErrorCode.GUARANTOR_NOT_ELIGIBLE:
    case ErrorCode.LOAN_AMOUNT_EXCEEDS_ELIGIBILITY:
    case ErrorCode.CONCURRENT_LONG_TERM_LOAN:
    case ErrorCode.INSUFFICIENT_GUARANTORS:
    case ErrorCode.INVALID_PAYROLL_STATUS:
    case ErrorCode.INSUFFICIENT_COOPERATIVE_FUNDS:
      return 400;

    // 401 Unauthorized
    case ErrorCode.UNAUTHORIZED:
    case ErrorCode.INVALID_CREDENTIALS:
    case ErrorCode.TOKEN_EXPIRED:
    case ErrorCode.TOKEN_INVALID:
      return 401;

    // 403 Forbidden
    case ErrorCode.FORBIDDEN:
    case ErrorCode.ACCOUNT_LOCKED:
    case ErrorCode.MFA_REQUIRED:
    case ErrorCode.MEMBER_NOT_APPROVED:
    case ErrorCode.MEMBER_DEACTIVATED:
      return 403;

    // 404 Not Found
    case ErrorCode.NOT_FOUND:
      return 404;

    // 409 Conflict
    case ErrorCode.OPTIMISTIC_LOCK_CONFLICT:
    case ErrorCode.REQUEST_IN_FLIGHT:
    case ErrorCode.CONFLICT:
    case ErrorCode.DUPLICATE_PAYROLL_PERIOD:
    case ErrorCode.PAYROLL_ALREADY_CONFIRMED:
    case ErrorCode.DUPLICATE_EMPLOYEE_ID:
    case ErrorCode.DUPLICATE_PHONE:
    case ErrorCode.DUPLICATE_EMAIL:
      return 409;

    // 429 Too Many Requests
    case ErrorCode.RATE_LIMIT_EXCEEDED:
      return 429;

    // 500 Internal Server Error
    case ErrorCode.INTERNAL_ERROR:
      return 500;

    // 502 Bad Gateway
    case ErrorCode.PAYMENT_GATEWAY_ERROR:
    case ErrorCode.SMS_DELIVERY_FAILED:
    case ErrorCode.EMAIL_DELIVERY_FAILED:
      return 502;

    // 503 Service Unavailable
    case ErrorCode.SERVICE_BUSY:
    case ErrorCode.TRANSACTION_DEADLOCK:
      return 503;

    default:
      return 500;
  }
}
