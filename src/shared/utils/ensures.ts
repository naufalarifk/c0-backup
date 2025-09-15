/** biome-ignore-all lint/suspicious/noExplicitAny: Allow any */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  PreconditionFailedException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

// ============================================
// CORE ENSURE FUNCTIONS
// ============================================

/**
 * Ensures condition is true, throws BadRequestException if false
 */
export function ensure<T>(condition: T, message: string): asserts condition {
  if (!condition) {
    throw new BadRequestException(message);
  }
}

/**
 * Ensures value exists (not null/undefined), throws NotFoundException if not
 */
export function ensureExists<T>(value: T | null | undefined, message: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundException(message);
  }
}

/**
 * Ensures condition is true, throws PreconditionFailedException if false
 */
export function ensurePrecondition<T>(condition: T, message: string): asserts condition {
  if (!condition) {
    throw new PreconditionFailedException(message);
  }
}

/**
 * Ensures user is authorized, throws UnauthorizedException if not
 */
export function ensureAuthorized<T>(
  condition: T,
  message = 'Unauthorized access',
): asserts condition {
  if (!condition) {
    throw new UnauthorizedException(message);
  }
}

/**
 * Ensures user has permission, throws ForbiddenException if not
 */
export function ensurePermission<T>(
  condition: T,
  message = 'Permission denied',
): asserts condition {
  if (!condition) {
    throw new ForbiddenException(message);
  }
}

/**
 * Ensures resource is unique, throws ConflictException if not
 */
export function ensureUnique<T>(condition: T, message: string): asserts condition {
  if (!condition) {
    throw new ConflictException(message);
  }
}

/**
 * Ensures data is valid, throws UnprocessableEntityException if not
 */
export function ensureValid<T>(condition: T, message: string): asserts condition {
  if (!condition) {
    throw new UnprocessableEntityException(message);
  }
}

/**
 * Ensures array is not empty
 */
export function ensureNotEmpty<T>(
  array: T[] | null | undefined,
  message: string,
): asserts array is T[] {
  if (!array || array.length === 0) {
    throw new BadRequestException(message);
  }
}

/**
 * Ensures string is not blank (empty or whitespace)
 */
export function ensureNotBlank(
  value: string | null | undefined,
  message: string,
): asserts value is string {
  if (!value || value.trim().length === 0) {
    throw new BadRequestException(message);
  }
}

/**
 * Ensures value is within range
 */
export function ensureInRange(value: number, min: number, max: number, message: string): void {
  if (value < min || value > max) {
    throw new BadRequestException(message);
  }
}

/**
 * Ensures string matches pattern
 */
export function ensurePattern(value: string, pattern: RegExp, message: string): void {
  if (!pattern.test(value)) {
    throw new BadRequestException(message);
  }
}

/**
 * Ensures value is valid enum value
 */
export function ensureEnum<T extends Record<string, any>>(
  value: any,
  enumObject: T,
  message: string,
): asserts value is T[keyof T] {
  const validValues = Object.values(enumObject);
  if (!validValues.includes(value)) {
    throw new BadRequestException(message);
  }
}

/**
 * Custom ensure with specific HttpException
 */
export function ensureWithException<T extends HttpException>(
  condition: any,
  exception: T,
): asserts condition {
  if (!condition) {
    throw exception;
  }
}

/**
 * Ensures value is of specific type using type predicate
 */
export function ensureType<T>(
  value: unknown,
  predicate: (value: unknown) => value is T,
  message: string,
): asserts value is T {
  if (!predicate(value)) {
    throw new BadRequestException(message);
  }
}

// ============================================
// TYPE GUARDS
// ============================================

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

export function isUUID(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function isPositiveNumber(value: unknown): value is number {
  return isNumber(value) && value > 0;
}

export function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

export function isPhoneNumber(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(value);
}

export function isURL(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// ============================================
// USAGE EXAMPLES
// ============================================

/**
 * @example Basic usage
 * ```typescript
 * import { ensure, ensureExists, ensurePermission } from '@common/utils/ensure';
 *
 * // Simple validation
 * ensure(user.age >= 18, 'Must be 18 or older');
 *
 * // Check existence
 * ensureExists(user.email, 'Email is required');
 *
 * // Permission check
 * ensurePermission(user.role === 'ADMIN', 'Admin access required');
 * ```
 *
 * @example With type guards
 * ```typescript
 * import { ensureType, isEmail, isUUID } from '@common/utils/ensure';
 *
 * // Validate email
 * ensureType(value, isEmail, 'Invalid email format');
 *
 * // Validate UUID
 * ensureType(userId, isUUID, 'Invalid user ID format');
 *
 * // After this, TypeScript knows the type!
 * ```
 *
 * @example In NestJS Service
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   async inviteUser(email: string, currentUser: User) {
 *     // Validate permissions
 *     ensurePermission(
 *       currentUser.role === 'ADMIN',
 *       'Only admins can invite users'
 *     );
 *
 *     // Validate input
 *     ensureType(email, isEmail, 'Invalid email format');
 *
 *     // Check uniqueness
 *     const exists = await this.userRepo.findOne({ email });
 *     ensureUnique(!exists, 'Email already registered');
 *
 *     // Continue with invitation...
 *   }
 * }
 * ```
 *
 * @example Complex validation
 * ```typescript
 * async updateProfile(userId: string, updates: UpdateDto, currentUser: User) {
 *   // Validate UUID
 *   ensureType(userId, isUUID, 'Invalid user ID');
 *
 *   // Check authorization
 *   ensureAuthorized(
 *     currentUser.id === userId || currentUser.role === 'ADMIN',
 *     'Cannot update other users profile'
 *   );
 *
 *   // Find user
 *   const user = await this.userRepo.findOne(userId);
 *   ensureExists(user, 'User not found');
 *
 *   // Validate specific fields
 *   if (updates.username) {
 *     ensurePattern(
 *       updates.username,
 *       /^[a-zA-Z0-9_-]+$/,
 *       'Username contains invalid characters'
 *     );
 *   }
 *
 *   if (updates.age !== undefined) {
 *     ensureInRange(updates.age, 13, 120, 'Age must be between 13 and 120');
 *   }
 * }
 * ```
 */
