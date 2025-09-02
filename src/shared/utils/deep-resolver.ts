export async function deepResolvePromises<T>(input: T): Promise<T> {
  if (input instanceof Promise) {
    return (await input) as Awaited<T>;
  }

  if (Array.isArray(input)) {
    const resolvedArray = await Promise.all(input.map(item => deepResolvePromises(item)));
    return resolvedArray as Awaited<T>;
  }

  if (input instanceof Date) {
    return input as T;
  }

  if (typeof input === 'object' && input !== null) {
    const keys = Object.keys(input) as (keyof T)[];
    const resolvedObject = {} as T;

    for (const key of keys) {
      resolvedObject[key] = (await deepResolvePromises(input[key])) as T[typeof key];
    }

    return resolvedObject;
  }

  return input;
}
