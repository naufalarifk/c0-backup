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

export function assertDefined(
  value: unknown,
  message?: string,
): asserts value is NonNullable<typeof value> {
  if (value === undefined || value === null) {
    throw new Error(message || 'Value is not defined');
  }
}

export function assertArray(value: unknown, message?: string): asserts value is unknown[] {
  if (!isArray(value)) {
    throw new Error(message || 'Value is not an array');
  }
}

export function assertArrayMapOf<T>(
  value: unknown,
  typeCheck: (item: unknown) => T,
  message?: string,
): asserts value is T[] {
  assertArray(value, message);
  for (const item of value) {
    if (!typeCheck(item)) {
      throw new Error(message || 'Array contains invalid type');
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

export function assertPropDefined(
  value: unknown,
  propName: string,
  message?: string,
): asserts value is Record<string, NonNullable<unknown>> {
  if (
    typeof value !== 'object' ||
    value === null ||
    !(propName in value) ||
    (value as Record<string, unknown>)[propName] === undefined ||
    (value as Record<string, unknown>)[propName] === null
  ) {
    throw new Error(message || `Property "${propName}" is not defined`);
  }
}

export function assertPropNumber(
  value: unknown,
  propName: string,
  message?: string,
): asserts value is Record<string, number> {
  if (
    typeof value !== 'object' ||
    value === null ||
    !(propName in value) ||
    typeof (value as Record<string, unknown>)[propName] !== 'number'
  ) {
    throw new Error(message || `Property "${propName}" is not a number`);
  }
}

export function assertPropString(
  value: unknown,
  propName: string,
  message?: string,
): asserts value is Record<string, string> {
  if (
    typeof value !== 'object' ||
    value === null ||
    !(propName in value) ||
    typeof (value as Record<string, unknown>)[propName] !== 'string'
  ) {
    throw new Error(message || `Property "${propName}" is not a string`);
  }
}
