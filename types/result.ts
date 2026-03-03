/**
 * Result Type for Error Handling
 * 
 * Result<T, E> is a type that represents either success (Ok) or failure (Err).
 * This pattern allows for explicit error handling without throwing exceptions
 * for expected business logic failures.
 * 
 * Use Result for:
 * - Business logic that can fail in expected ways
 * - Operations where failure is part of normal flow
 * - Functions that need to return detailed error information
 * 
 * DO NOT use Result for:
 * - Unexpected system errors (use throw for these)
 * - Programming errors (use throw for these)
 * 
 * @module types/result
 */

/**
 * Success variant of Result
 */
export interface Ok<T> {
  readonly success: true;
  readonly value: T;
}

/**
 * Failure variant of Result
 */
export interface Err<E> {
  readonly success: false;
  readonly error: E;
}

/**
 * Result type representing either success or failure
 */
export type Result<T, E> = Ok<T> | Err<E>;

// ============================================================================
// Constructors
// ============================================================================

/**
 * Create a successful Result
 * 
 * @example
 * ```ts
 * const result = ok(42);
 * // result: Ok<number>
 * ```
 */
export function ok<T>(value: T): Ok<T> {
  return { success: true, value };
}

/**
 * Create a failed Result
 * 
 * @example
 * ```ts
 * const result = err('Something went wrong');
 * // result: Err<string>
 * ```
 */
export function err<E>(error: E): Err<E> {
  return { success: false, error };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if Result is Ok
 * 
 * @example
 * ```ts
 * const result: Result<number, string> = ok(42);
 * if (isOk(result)) {
 *   console.log(result.value); // TypeScript knows this is number
 * }
 * ```
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.success === true;
}

/**
 * Check if Result is Err
 * 
 * @example
 * ```ts
 * const result: Result<number, string> = err('failed');
 * if (isErr(result)) {
 *   console.log(result.error); // TypeScript knows this is string
 * }
 * ```
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.success === false;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Transform the value inside an Ok Result
 * If the Result is Err, return it unchanged
 * 
 * @example
 * ```ts
 * const result = ok(5);
 * const doubled = map(result, x => x * 2);
 * // doubled: Ok<10>
 * 
 * const failed = err('error');
 * const stillFailed = map(failed, x => x * 2);
 * // stillFailed: Err<'error'>
 * ```
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Transform the value inside an Ok Result with a function that returns a Result
 * If the Result is Err, return it unchanged
 * This is useful for chaining operations that can fail
 * 
 * @example
 * ```ts
 * const divide = (a: number, b: number): Result<number, string> =>
 *   b === 0 ? err('Division by zero') : ok(a / b);
 * 
 * const result = ok(10);
 * const divided = flatMap(result, x => divide(x, 2));
 * // divided: Ok<5>
 * 
 * const divideByZero = flatMap(result, x => divide(x, 0));
 * // divideByZero: Err<'Division by zero'>
 * ```
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
}

/**
 * Extract the value from an Ok Result
 * Throws an error if the Result is Err
 * 
 * @throws {Error} If the Result is Err
 * 
 * @example
 * ```ts
 * const result = ok(42);
 * const value = unwrap(result); // 42
 * 
 * const failed = err('error');
 * const value = unwrap(failed); // throws Error
 * ```
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw new Error(`Called unwrap on an Err value: ${JSON.stringify(result.error)}`);
}

/**
 * Extract the value from an Ok Result, or return a default value if Err
 * 
 * @example
 * ```ts
 * const result = ok(42);
 * const value = unwrapOr(result, 0); // 42
 * 
 * const failed = err('error');
 * const value = unwrapOr(failed, 0); // 0
 * ```
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Extract the value from an Ok Result, or compute a default value if Err
 * 
 * @example
 * ```ts
 * const result = ok(42);
 * const value = unwrapOrElse(result, () => 0); // 42
 * 
 * const failed = err('error');
 * const value = unwrapOrElse(failed, () => 0); // 0
 * ```
 */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
  if (isOk(result)) {
    return result.value;
  }
  return fn(result.error);
}

/**
 * Transform the error inside an Err Result
 * If the Result is Ok, return it unchanged
 * 
 * @example
 * ```ts
 * const result = err('not found');
 * const mapped = mapErr(result, e => `Error: ${e}`);
 * // mapped: Err<'Error: not found'>
 * ```
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Match on a Result and handle both cases
 * 
 * @example
 * ```ts
 * const result: Result<number, string> = ok(42);
 * const message = match(result, {
 *   ok: value => `Success: ${value}`,
 *   err: error => `Failed: ${error}`
 * });
 * // message: 'Success: 42'
 * ```
 */
export function match<T, E, U>(
  result: Result<T, E>,
  handlers: {
    ok: (value: T) => U;
    err: (error: E) => U;
  }
): U {
  if (isOk(result)) {
    return handlers.ok(result.value);
  }
  return handlers.err(result.error);
}

/**
 * Combine multiple Results into a single Result
 * If all Results are Ok, return Ok with an array of values
 * If any Result is Err, return the first Err
 * 
 * @example
 * ```ts
 * const results = [ok(1), ok(2), ok(3)];
 * const combined = combine(results);
 * // combined: Ok<[1, 2, 3]>
 * 
 * const withError = [ok(1), err('failed'), ok(3)];
 * const combined = combine(withError);
 * // combined: Err<'failed'>
 * ```
 */
export function combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}

/**
 * Convert a Promise to a Result
 * Catches any errors and returns them as Err
 * 
 * @example
 * ```ts
 * const result = await fromPromise(
 *   fetch('/api/data'),
 *   error => `Network error: ${error}`
 * );
 * ```
 */
export async function fromPromise<T, E>(
  promise: Promise<T>,
  mapError: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (error) {
    return err(mapError(error));
  }
}

/**
 * Convert a function that might throw to a Result
 * 
 * @example
 * ```ts
 * const result = fromThrowable(
 *   () => JSON.parse(jsonString),
 *   error => `Parse error: ${error}`
 * );
 * ```
 */
export function fromThrowable<T, E>(fn: () => T, mapError: (error: unknown) => E): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    return err(mapError(error));
  }
}
