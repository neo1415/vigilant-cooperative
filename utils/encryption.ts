/**
 * Encryption and Hashing Utilities
 * 
 * Provides secure encryption, hashing, and authentication functions:
 * - AES-256-GCM for field-level encryption
 * - SHA-256 for searchable hashes
 * - bcrypt for password hashing (with pepper)
 * - TOTP for multi-factor authentication
 * 
 * SECURITY RULES:
 * - Never log plaintext sensitive data
 * - Never log encryption keys or peppers
 * - Always use unique IVs for each encryption
 * - Always verify HMAC signatures with timing-safe comparison
 * 
 * @module utils/encryption
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable not set');
  }
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Get hash salt from environment
 */
function getHashSalt(): string {
  const salt = process.env.HASH_SALT;
  if (!salt) {
    throw new Error('HASH_SALT environment variable not set');
  }
  if (salt.length < 32) {
    throw new Error('HASH_SALT must be at least 32 characters');
  }
  return salt;
}

/**
 * Get bcrypt pepper from environment
 */
function getBcryptPepper(): string {
  const pepper = process.env.BCRYPT_PEPPER;
  if (!pepper) {
    throw new Error('BCRYPT_PEPPER environment variable not set');
  }
  if (pepper.length < 32) {
    throw new Error('BCRYPT_PEPPER must be at least 32 characters');
  }
  return pepper;
}

/**
 * Get bcrypt cost factor from environment (default: 12, production: 14)
 */
function getBcryptRounds(): number {
  const rounds = process.env.BCRYPT_ROUNDS;
  if (!rounds) {
    return process.env.NODE_ENV === 'production' ? 14 : 12;
  }
  const parsed = parseInt(rounds, 10);
  if (isNaN(parsed) || parsed < 10 || parsed > 15) {
    throw new Error('BCRYPT_ROUNDS must be between 10 and 15');
  }
  return parsed;
}

// ============================================================================
// AES-256-GCM Encryption
// ============================================================================

/**
 * Encrypt data using AES-256-GCM
 * 
 * Format: [IV (16 bytes)][Auth Tag (16 bytes)][Encrypted Data]
 * 
 * @param plaintext - Data to encrypt
 * @returns Encrypted data as hex string
 * 
 * @example
 * ```ts
 * const encrypted = encrypt('sensitive data');
 * const decrypted = decrypt(encrypted); // 'sensitive data'
 * ```
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16); // Unique IV for each encryption
  
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Combine: IV + Auth Tag + Encrypted Data
  const combined = Buffer.concat([iv, authTag, encrypted]);
  
  // Return as hex string for TEXT storage
  return combined.toString('hex');
}

/**
 * Decrypt data encrypted with AES-256-GCM
 * 
 * @param ciphertext - Encrypted data as hex string
 * @returns Decrypted plaintext
 * 
 * @throws {Error} If decryption fails (wrong key, tampered data, etc.)
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  
  // Convert hex string to Buffer
  const buffer = Buffer.from(ciphertext, 'hex');
  
  if (buffer.length < 32) {
    throw new Error('Invalid ciphertext: too short');
  }
  
  // Extract components
  const iv = buffer.subarray(0, 16);
  const authTag = buffer.subarray(16, 32);
  const encrypted = buffer.subarray(32);
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  try {
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error('Decryption failed: invalid key or tampered data');
  }
}

// ============================================================================
// SHA-256 Hashing
// ============================================================================

/**
 * Create SHA-256 hash for searchable lookups
 * 
 * @param value - Value to hash
 * @returns Hex-encoded hash
 * 
 * @example
 * ```ts
 * const hash = hashForLookup('+2348012345678');
 * // Always produces same hash for same input
 * ```
 */
export function hashForLookup(value: string): string {
  const salt = getHashSalt();
  const hash = crypto.createHash('sha256');
  hash.update(value + salt);
  return hash.digest('hex');
}

/**
 * Create SHA-256 HMAC for webhook signature verification
 * 
 * @param data - Data to sign
 * @param secret - Secret key
 * @returns Hex-encoded HMAC
 */
export function createHmacSignature(data: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(data);
  return hmac.digest('hex');
}

/**
 * Verify HMAC signature using timing-safe comparison
 * 
 * @param data - Original data
 * @param signature - Signature to verify
 * @param secret - Secret key
 * @returns true if signature is valid
 */
export function verifyHmacSignature(data: string, signature: string, secret: string): boolean {
  const expected = createHmacSignature(data, secret);
  
  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    // Lengths don't match
    return false;
  }
}

/**
 * Create SHA-256 hash for audit log chain
 * 
 * @param previousHash - Previous chain hash
 * @param timestamp - Current timestamp
 * @param data - Data to hash
 * @returns Hex-encoded chain hash
 */
export function createChainHash(previousHash: string, timestamp: Date, data: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(previousHash + timestamp.toISOString() + data);
  return hash.digest('hex');
}

// ============================================================================
// bcrypt Password Hashing
// ============================================================================

/**
 * Apply pepper to password before hashing
 * 
 * @param password - Plain password
 * @returns Password with pepper applied
 */
function applyPepper(password: string): string {
  const pepper = getBcryptPepper();
  
  // XOR password bytes with pepper bytes
  const passwordBuffer = Buffer.from(password, 'utf8');
  const pepperBuffer = Buffer.from(pepper, 'utf8');
  
  const result = Buffer.alloc(passwordBuffer.length);
  for (let i = 0; i < passwordBuffer.length; i++) {
    result[i] = passwordBuffer[i]! ^ pepperBuffer[i % pepperBuffer.length]!;
  }
  
  return result.toString('base64');
}

/**
 * Hash password using bcrypt with pepper
 * 
 * @param password - Plain password
 * @returns Bcrypt hash
 * 
 * @example
 * ```ts
 * const hash = await hashPassword('SecurePassword123!');
 * const isValid = await verifyPassword('SecurePassword123!', hash); // true
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
  const pepperedPassword = applyPepper(password);
  const rounds = getBcryptRounds();
  return bcrypt.hash(pepperedPassword, rounds);
}

/**
 * Verify password against bcrypt hash
 * 
 * @param password - Plain password
 * @param hash - Bcrypt hash
 * @returns true if password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const pepperedPassword = applyPepper(password);
  return bcrypt.compare(pepperedPassword, hash);
}

/**
 * Hash a value using bcrypt (for backup codes, OTPs, etc.)
 * 
 * @param value - Value to hash
 * @returns Bcrypt hash
 */
export async function hashValue(value: string): Promise<string> {
  const rounds = getBcryptRounds();
  return bcrypt.hash(value, rounds);
}

/**
 * Verify a value against bcrypt hash
 * 
 * @param value - Plain value
 * @param hash - Bcrypt hash
 * @returns true if value matches
 */
export async function verifyValue(value: string, hash: string): Promise<boolean> {
  return bcrypt.compare(value, hash);
}

// ============================================================================
// TOTP (Time-based One-Time Password)
// ============================================================================

/**
 * Generate a random TOTP secret
 * 
 * @returns Base32-encoded secret (32 bytes)
 * 
 * @example
 * ```ts
 * const secret = generateTotpSecret();
 * // Use this secret to generate QR code for user
 * ```
 */
export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(32);
  return base32Encode(bytes);
}

/**
 * Generate TOTP code for a given secret and time
 * 
 * @param secret - Base32-encoded secret
 * @param time - Time in seconds (defaults to current time)
 * @returns 6-digit TOTP code
 * 
 * @example
 * ```ts
 * const code = generateTotpCode(secret);
 * // code: '123456'
 * ```
 */
export function generateTotpCode(secret: string, time?: number): string {
  const timeStep = 30; // 30-second window
  const currentTime = time ?? Math.floor(Date.now() / 1000);
  const counter = Math.floor(currentTime / timeStep);
  
  const secretBytes = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  
  const hmac = crypto.createHmac('sha1', secretBytes);
  hmac.update(counterBuffer);
  const hash = hmac.digest();
  
  const offset = hash[hash.length - 1]! & 0x0f;
  const binary =
    ((hash[offset]! & 0x7f) << 24) |
    ((hash[offset + 1]! & 0xff) << 16) |
    ((hash[offset + 2]! & 0xff) << 8) |
    (hash[offset + 3]! & 0xff);
  
  const code = binary % 1000000;
  return code.toString().padStart(6, '0');
}

/**
 * Verify TOTP code with time window tolerance
 * 
 * @param secret - Base32-encoded secret
 * @param code - 6-digit code to verify
 * @param window - Number of time steps to check (±1 = 90 seconds total)
 * @returns true if code is valid
 * 
 * @example
 * ```ts
 * const isValid = verifyTotpCode(secret, '123456');
 * // Checks current time ± 30 seconds
 * ```
 */
export function verifyTotpCode(secret: string, code: string, window: number = 1): boolean {
  const timeStep = 30;
  const currentTime = Math.floor(Date.now() / 1000);
  
  // Check current time and ±window time steps
  for (let i = -window; i <= window; i++) {
    const time = currentTime + i * timeStep;
    const expectedCode = generateTotpCode(secret, time);
    
    if (crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expectedCode))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate otpauth:// URI for QR code
 * 
 * @param secret - Base32-encoded secret
 * @param accountName - User's account name (e.g., email or member ID)
 * @param issuer - Issuer name (e.g., "Vigilant Cooperative")
 * @returns otpauth:// URI
 * 
 * @example
 * ```ts
 * const uri = generateTotpUri(secret, 'VIG-2026-001', 'Vigilant Cooperative');
 * // otpauth://totp/Vigilant%20Cooperative:VIG-2026-001?secret=...&issuer=Vigilant%20Cooperative
 * ```
 */
export function generateTotpUri(secret: string, accountName: string, issuer: string): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?${params}`;
}

// ============================================================================
// Backup Codes
// ============================================================================

/**
 * Generate backup codes for MFA
 * 
 * @param count - Number of codes to generate (default: 8)
 * @returns Array of backup codes
 * 
 * @example
 * ```ts
 * const codes = generateBackupCodes();
 * // ['A1B2C3D4E5', 'F6G7H8I9J0', ...]
 * ```
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(5);
    const code = bytes.toString('hex').toUpperCase();
    codes.push(code);
  }
  
  return codes;
}

// ============================================================================
// Random Token Generation
// ============================================================================

/**
 * Generate cryptographically secure random token
 * 
 * @param bytes - Number of random bytes (default: 32)
 * @returns Hex-encoded token
 * 
 * @example
 * ```ts
 * const token = generateRandomToken(64);
 * // 128-character hex string
 * ```
 */
export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate numeric OTP
 * 
 * @param digits - Number of digits (default: 6)
 * @returns Numeric OTP
 * 
 * @example
 * ```ts
 * const otp = generateNumericOtp(6);
 * // '123456'
 * ```
 */
export function generateNumericOtp(digits: number = 6): string {
  const max = Math.pow(10, digits);
  const randomValue = crypto.randomInt(0, max);
  return randomValue.toString().padStart(digits, '0');
}

// ============================================================================
// Base32 Encoding/Decoding (for TOTP)
// ============================================================================

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encode buffer to base32
 */
function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]!;
    bits += 8;
    
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  
  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  
  return output;
}

/**
 * Decode base32 to buffer
 */
function base32Decode(input: string): Buffer {
  const cleanInput = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  
  for (let i = 0; i < cleanInput.length; i++) {
    const char = cleanInput[i]!;
    const index = BASE32_CHARS.indexOf(char);
    
    if (index === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    
    value = (value << 5) | index;
    bits += 5;
    
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  
  return Buffer.from(output);
}
