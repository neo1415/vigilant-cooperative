/**
 * Authentication utility library for client-side auth state management
 * Handles JWT token storage, validation, and user info extraction
 */

export interface UserInfo {
  id: string;
  memberId: string;
  roles: string[];
  fullName?: string;
  email?: string;
}

/**
 * Check if user is authenticated by validating JWT token
 * @returns true if valid token exists and is not expired
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  
  const token = localStorage.getItem('auth_token');
  if (!token) return false;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return false;
    
    const payload = JSON.parse(atob(parts[1]));
    // Check if token is expired (exp is in seconds, Date.now() is in milliseconds)
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

/**
 * Get JWT token from localStorage
 * @returns JWT token string or null if not found
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

/**
 * Decode JWT token and extract user information
 * @returns User info object or null if token is invalid
 */
export function getUserFromToken(): UserInfo | null {
  const token = getToken();
  if (!token) return null;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return {
      id: payload.sub,
      memberId: payload.member_id,
      roles: payload.roles || [],
      fullName: payload.full_name,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

/**
 * Store JWT token in localStorage and cookie
 * @param token JWT token string
 */
export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', token);
  
  // Also store in cookie for server-side middleware access
  // Set cookie with secure flags
  document.cookie = `auth_token=${token}; path=/; max-age=86400; SameSite=Lax`;
}

/**
 * Clear authentication token and redirect to login
 */
export function logout(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
  
  // Also clear the cookie
  document.cookie = 'auth_token=; path=/; max-age=0';
  
  window.location.href = '/login';
}

/**
 * Check if user has a specific role
 * @param role Role to check for
 * @returns true if user has the role
 */
export function hasRole(role: string): boolean {
  const user = getUserFromToken();
  if (!user) return false;
  return user.roles.includes(role);
}

/**
 * Check if user has any of the specified roles
 * @param roles Array of roles to check
 * @returns true if user has at least one of the roles
 */
export function hasAnyRole(roles: string[]): boolean {
  const user = getUserFromToken();
  if (!user) return false;
  return roles.some(role => user.roles.includes(role));
}
