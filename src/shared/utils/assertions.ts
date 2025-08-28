/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation> */
export function assertDefined(
  value: unknown,
  message?: string,
): asserts value is NonNullable<typeof value> {
  if (value === undefined || value === null) {
    throw new Error(message || 'Value is not defined');
  }
}

export function assertArray(value: unknown, message?: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(message || 'Value is not an array');
  }
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
      throw new Error(
        message ||
          'Array contains invalid item: ' +
            (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}

export function assertString(value: unknown, message?: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(message || 'Value is not a string');
  }
}

export function assertNumber(value: unknown, message?: string): asserts value is number {
  if (typeof value !== 'number') {
    throw new Error(message || 'Value is not a number');
  }
}

export type PropKey = string | number | symbol;

export function assertPropEqual<K extends PropKey, V extends NonNullable<unknown>, T>(
  obj: V,
  propKey: K,
  expectedValue: T,
  message?: string,
): asserts obj is V & Record<K, T> {
  if (
    typeof obj !== 'object' ||
    obj === null ||
    !(propKey in obj) ||
    (obj as any)[propKey] !== expectedValue
  ) {
    throw new Error(message || `Property "${String(propKey)}" is not equal to expected value`);
  }
}

export function assertPropDefined<K extends PropKey, V extends NonNullable<unknown>>(
  value: V,
  propKey: K,
  message?: string,
): asserts value is V & Record<K, NonNullable<unknown>> {
  if (
    typeof value !== 'object' ||
    value === null ||
    !(propKey in value) ||
    (value as any)[propKey] === undefined ||
    (value as any)[propKey] === null
  ) {
    throw new Error(message || `Property "${String(propKey)}" is not defined`);
  }
}

export function assertPropNumber<K extends PropKey, V extends NonNullable<unknown>>(
  value: V,
  propKey: K,
  message?: string,
): asserts value is V & Record<K, number> {
  if (
    typeof value !== 'object' ||
    value === null ||
    !(propKey in value) ||
    typeof (value as any)[propKey] !== 'number'
  ) {
    throw new Error(message || `Property "${String(propKey)}" is not a number`);
  }
}

export function assertPropString<K extends PropKey, V extends NonNullable<unknown>>(
  value: V,
  propKey: K,
  message?: string,
): asserts value is V & Record<K, string> {
  if (
    typeof value !== 'object' ||
    value === null ||
    !(propKey in value) ||
    typeof (value as any)[propKey] !== 'string'
  ) {
    throw new Error(message || `Property "${String(propKey)}" is not a string`);
  }
}

export function assertPropStringOrNumber<K extends PropKey, V extends NonNullable<unknown>>(
  obj: V,
  propKey: K,
  message?: string,
): asserts obj is V & Record<K, string | number> {
  if (
    typeof obj !== 'object' ||
    obj === null ||
    !(propKey in obj) ||
    (typeof (obj as any)[propKey] !== 'string' && typeof (obj as any)[propKey] !== 'number')
  ) {
    throw new Error(message || `Property "${String(propKey)}" is not a string or number`);
  }
}

export function assertPropNullableString<K extends PropKey, V extends NonNullable<unknown>>(
  obj: V,
  propKey: K,
  message?: string,
): asserts obj is V & Record<K, string | null> {
  if (
    typeof obj !== 'object' ||
    obj === null ||
    !(propKey in obj) ||
    ((obj as any)[propKey] !== null && typeof (obj as any)[propKey] !== 'string')
  ) {
    throw new Error(message || `Property "${String(propKey)}" is not a string or null`);
  }
}

export function assertPropNullableStringOrNumber<K extends PropKey, V extends NonNullable<unknown>>(
  obj: V,
  propKey: K,
  message?: string,
): asserts obj is V & Record<K, string | number | null> {
  if (
    typeof obj !== 'object' ||
    obj === null ||
    !(propKey in obj) ||
    ((obj as any)[propKey] !== null &&
      typeof (obj as any)[propKey] !== 'string' &&
      typeof (obj as any)[propKey] !== 'number')
  ) {
    throw new Error(message || `Property "${String(propKey)}" is not a string, number, or null`);
  }
}

export function assertPropDate<K extends PropKey, V extends NonNullable<unknown>>(
  obj: V,
  propKey: K,
  message?: string,
): asserts obj is V & Record<K, Date> {
  if (
    typeof obj !== 'object' ||
    obj === null ||
    !(propKey in obj) ||
    !((obj as any)[propKey] instanceof Date)
  ) {
    throw new Error(message || `Property "${String(propKey)}" is not a Date`);
  }
}

export function assertPropNullableDate<K extends PropKey, V extends NonNullable<unknown>>(
  obj: V,
  propKey: K,
  message?: string,
): asserts obj is V & Record<K, Date | null> {
  if (
    typeof obj !== 'object' ||
    obj === null ||
    !(propKey in obj) ||
    !((obj as any)[propKey] === null || (obj as any)[propKey] instanceof Date)
  ) {
    throw new Error(message || `Property "${String(propKey)}" is not a Date or null`);
  }
}

export function assertPropOneOf<K extends PropKey, V extends NonNullable<unknown>, T>(
  obj: V,
  propKey: K,
  validValues: T[],
  message?: string,
): asserts obj is V & Record<K, T> {
  if (
    typeof obj !== 'object' ||
    obj === null ||
    !(propKey in obj) ||
    !validValues.includes((obj as any)[propKey])
  ) {
    throw new Error(
      message ||
        `Property "${String(propKey)}" is not one of the valid values: ${validValues.join(', ')}`,
    );
  }
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
      throw new Error(
        `Expected single record but got empty array${context ? ` in ${context}` : ''}`,
      );
    }
    if (value.length > 1) {
      throw new Error(
        `Expected single record but got ${value.length} records${context ? ` in ${context}` : ''}`,
      );
    }
  }
}
