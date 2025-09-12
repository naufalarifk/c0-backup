import test from 'node:test';

let earlyExit = false;

export function suite(name: string, fn: () => void) {
  return test.suite(name, fn);
}

export function describe(name: string, fn: () => void) {
  return test.describe(name, fn);
}

export function beforeEach(fn: () => Promise<void>) {
  test.beforeEach(async function () {
    if (earlyExit) return;
    try {
      if (typeof fn === 'function') {
        await Promise.resolve(fn());
      }
    } catch (error) {
      earlyExit = true;
      throw error;
    }
  });
}

export function afterEach(fn: () => Promise<void>) {
  test.afterEach(async function () {
    if (earlyExit) return;
    try {
      if (typeof fn === 'function') {
        await Promise.resolve(fn());
      }
    } catch (error) {
      earlyExit = true;
      throw error;
    }
  });
}

export function it(name: string, fn: () => Promise<void>): Promise<void> {
  return test.it(name, async function (t) {
    if (earlyExit) {
      t.skip();
      return;
    }
    try {
      if (typeof fn === 'function') {
        await Promise.resolve(fn());
      }
    } catch (error) {
      earlyExit = true;
      throw error;
    }
  });
}
