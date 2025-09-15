import test from 'node:test';

let isExit = false;

export async function suite(name: string, fn: () => void) {
  await test.suite(name, fn);
}

export async function describe(name: string, fn: () => void) {
  await test.describe(name, fn);
}

export function before(fn: () => Promise<void>) {
  return test.before(async function () {
    // console.debug('before called', { isExit });
    if (isExit) return;
    try {
      await Promise.resolve(fn());
    } catch (error) {
      // console.debug('before error', error);
      isExit = true;
      throw error;
    }
  });
}

export function after(fn: () => Promise<void>) {
  return test.after(async function () {
    await Promise.resolve(fn());
  });
}

export function beforeEach(fn: () => Promise<void>) {
  return test.beforeEach(async function (c) {
    // console.debug('beforeEach called', { isExit });
    if (isExit) return;
    try {
      await Promise.resolve(fn());
    } catch (error) {
      // console.debug('beforeEach error', error);
      isExit = true;
      throw error;
    }
  });
}

export function afterEach(fn: () => Promise<void>) {
  test.afterEach(async function () {
    // console.debug('afterEach called', { isExit });
    if (isExit) return;
    try {
      await Promise.resolve(fn());
    } catch (error) {
      // console.debug('afterEach error', error);
      isExit = true;
      throw error;
    }
  });
}

export async function it(name: string, fn: () => Promise<void>): Promise<void> {
  // console.debug('it setup', name, { isExit });
  await test.it(name, async function (t) {
    // console.debug('it called', { isExit });
    if (isExit) {
      t.skip();
      return;
    }
    try {
      await Promise.resolve(fn());
    } catch (error) {
      // console.debug('it error', error);
      isExit = true;
      throw error;
    }
  });
}
