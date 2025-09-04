/** biome-ignore-all lint/suspicious/noExplicitAny: Find other way if possible */
import { ok } from 'node:assert/strict';

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isPropDefined(
  value: unknown,
  propName: string,
): value is Record<string, NonNullable<unknown>> {
  return (
    typeof value === 'object' &&
    value !== null &&
    propName in value &&
    (value as Record<string, unknown>)[propName] !== undefined &&
    (value as Record<string, unknown>)[propName] !== null
  );
}

export function isDefined(value: unknown): value is NonNullable<typeof value> {
  return value !== undefined && value !== null;
}

export function assertDefined(
  value: unknown,
  message?: string,
): asserts value is NonNullable<typeof value> {
  if (isDefined(value)) return;
  throw new Error(message || 'Value is not defined');
}

export function assertArray(value: unknown, message?: string): asserts value is unknown[] {
  ok(Array.isArray(value), message || 'Value is not an array');
}

export function assertArrayOf<T>(
  value: Array<unknown>,
  check: (item: unknown) => T,
  message?: string,
): asserts value is T[] {
  for (const item of value) {
    try {
      check(item);
    } catch (error) {
      ok(
        false,
        message ||
          'Array contains invalid item: ' +
            (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}

export function assertArrayMapOf<T>(
  value: unknown,
  typeCheck: (item: unknown) => T,
  message?: string,
): asserts value is T[] {
  assertArray(value, message);
  for (const item of value) {
    ok(typeCheck(item), message || 'Array contains invalid type');
  }
}

export function assertString(value: unknown, message?: string): asserts value is string {
  ok(typeof value === 'string', message || 'Value is not a string');
}

export function assertNumber(value: unknown, message?: string): asserts value is number {
  ok(typeof value === 'number', message || 'Value is not a number');
}

export type PropKey = string | number | symbol;

export function assertPropEqual<K extends PropKey, V extends NonNullable<unknown>, T>(
  obj: V,
  propKey: K,
  expectedValue: T,
  message?: string,
): asserts obj is V & Record<K, T> {
  ok(
    typeof obj === 'object' &&
      obj !== null &&
      propKey in obj &&
      (obj as any)[propKey] === expectedValue,
    message || `Property "${String(propKey)}" is not equal to expected value`,
  );
}

export function assertPropDefined<K extends PropKey, V extends NonNullable<unknown>>(
  value: V,
  propKey: K,
  message?: string,
): asserts value is V & Record<K, NonNullable<unknown>> {
  ok(
    typeof value === 'object' &&
      value !== null &&
      propKey in value &&
      (value as any)[propKey] !== undefined &&
      (value as any)[propKey] !== null,
    message || `Property "${String(propKey)}" is not defined`,
  );
}

export function assertPropNumber<K extends PropKey, V extends NonNullable<unknown>>(
  value: V,
  propKey: K,
  message?: string,
): asserts value is V & Record<K, number> {
  ok(
    typeof value === 'object' &&
      value !== null &&
      propKey in value &&
      typeof (value as any)[propKey] === 'number',
    message || `Property "${String(propKey)}" is not a number`,
  );
}

export function assertPropString<K extends PropKey, V extends NonNullable<unknown>>(
  value: V,
  propKey: K,
  message?: string,
): asserts value is V & Record<K, string> {
  ok(
    typeof value === 'object' &&
      value !== null &&
      propKey in value &&
      typeof (value as any)[propKey] === 'string',
    message || `Property "${String(propKey)}" is not a string`,
  );
}

export function assertPropStringOrNumber<K extends PropKey, V extends NonNullable<unknown>>(
  obj: V,
  propKey: K,
  message?: string,
): asserts obj is V & Record<K, string | number> {
  ok(
    typeof obj === 'object' &&
      obj !== null &&
      propKey in obj &&
      (typeof (obj as any)[propKey] === 'string' ||
        typeof (obj as any)[propKey] === 'number' ||
        typeof (obj as any)[propKey] === 'bigint'),
    message || `Property "${String(propKey)}" is not a string, number, or bigint`,
  );
}

export function assertPropNullableString<K extends PropKey, V extends NonNullable<unknown>>(
  obj: V,
  propKey: K,
  message?: string,
): asserts obj is V & Record<K, string | null> {
  ok(
    typeof obj === 'object' &&
      obj !== null &&
      propKey in obj &&
      ((obj as any)[propKey] === null || typeof (obj as any)[propKey] === 'string'),
    message || `Property "${String(propKey)}" is not a string or null`,
  );
}

export function assertPropNullableStringOrNumber<K extends PropKey, V extends NonNullable<unknown>>(
  obj: V,
  propKey: K,
  message?: string,
): asserts obj is V & Record<K, string | number | null> {
  ok(
    typeof obj === 'object' &&
      obj !== null &&
      propKey in obj &&
      ((obj as any)[propKey] === null ||
        typeof (obj as any)[propKey] === 'string' ||
        typeof (obj as any)[propKey] === 'number'),
    message || `Property "${String(propKey)}" is not a string, number, or null`,
  );
}

export function assertPropDate<K extends PropKey, V extends NonNullable<unknown>>(
  obj: V,
  propKey: K,
  message?: string,
): asserts obj is V & Record<K, Date> {
  ok(
    typeof obj === 'object' &&
      obj !== null &&
      propKey in obj &&
      (obj as any)[propKey] instanceof Date,
    message || `Property "${String(propKey)}" is not a Date`,
  );
}

export function assertPropNullableDate<K extends PropKey, V extends NonNullable<unknown>>(
  obj: V,
  propKey: K,
  message?: string,
): asserts obj is V & Record<K, Date | null> {
  ok(
    typeof obj === 'object' &&
      obj !== null &&
      propKey in obj &&
      ((obj as any)[propKey] === null || (obj as any)[propKey] instanceof Date),
    message || `Property "${String(propKey)}" is not a Date or null`,
  );
}

export function assertPropOneOf<K extends PropKey, V extends NonNullable<unknown>, T>(
  obj: V,
  propKey: K,
  validValues: T[],
  message?: string,
): asserts obj is V & Record<K, T> {
  ok(
    typeof obj === 'object' &&
      obj !== null &&
      propKey in obj &&
      validValues.includes((obj as any)[propKey]),
    message ||
      `Property "${String(propKey)}" is not one of the valid values: ${validValues.join(', ')}`,
  );
}

export function setAssertPropValue<K extends PropKey, V extends NonNullable<unknown>, T>(
  obj: V,
  propKey: K,
  value: T,
): asserts obj is V & Record<K, T> {
  (obj as any)[propKey] = value;
}

export function assertSingleRecord<T extends { id: string }>(
  value: T | T[],
  context?: string,
): asserts value is T {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      ok(false, `Expected single record but got empty array${context ? ` in ${context}` : ''}`);
    }
    if (value.length > 1) {
      ok(
        false,
        `Expected single record but got ${value.length} records${context ? ` in ${context}` : ''}`,
      );
    }
  }
}
