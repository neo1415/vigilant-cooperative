/**
 * API client wrapper for making authenticated requests to the backend
 * Automatically includes JWT token and handles common error scenarios
 */

import { getToken, logout } from './auth';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

/**
 * Make an authenticated API request
 * @param url API endpoint URL (relative or absolute)
 * @param options Fetch options
 * @returns Response object
 */
export async function apiClient(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  // Handle unauthorized responses by logging out
  if (response.status === 401) {
    logout();
    throw new Error('Unauthorized - please login again');
  }

  return response;
}

/**
 * Make a GET request
 * @param url API endpoint URL
 * @returns Parsed JSON response
 */
export async function get<T = any>(url: string): Promise<ApiResponse<T>> {
  const response = await apiClient(url, { method: 'GET' });
  return response.json();
}

/**
 * Make a POST request
 * @param url API endpoint URL
 * @param data Request body data
 * @returns Parsed JSON response
 */
export async function post<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
  const response = await apiClient(url, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
  return response.json();
}

/**
 * Make a PUT request
 * @param url API endpoint URL
 * @param data Request body data
 * @returns Parsed JSON response
 */
export async function put<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
  const response = await apiClient(url, {
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
  return response.json();
}

/**
 * Make a PATCH request
 * @param url API endpoint URL
 * @param data Request body data
 * @returns Parsed JSON response
 */
export async function patch<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
  const response = await apiClient(url, {
    method: 'PATCH',
    body: data ? JSON.stringify(data) : undefined,
  });
  return response.json();
}

/**
 * Make a DELETE request
 * @param url API endpoint URL
 * @returns Parsed JSON response
 */
export async function del<T = any>(url: string): Promise<ApiResponse<T>> {
  const response = await apiClient(url, { method: 'DELETE' });
  return response.json();
}
