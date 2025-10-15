import test from 'node:test';

import { takeFetchLogs } from 'test/setup/fetch.js';

let earlyExit = false;

export function isEarlyExit() {
  return earlyExit;
}

export function suite(name: string, fn: () => void) {
  return test.suite(name, fn);
}

export function describe(name: string, fn: () => void) {
  return test.describe(name, fn);
}

export function before(fn: () => Promise<void>) {
  test.before(async function () {
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

export function after(fn: () => Promise<void>) {
  test.after(async function () {
    if (typeof fn === 'function') {
      await Promise.resolve(fn());
    }
    const takenLogs = takeFetchLogs();
    if (earlyExit && takenLogs.length > 0) {
      console.debug('Recent fetch logs:');
      for (const log of takenLogs.slice(-10)) {
        console.debug(log);
      }
    }
  });
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
      t.skip('Skipping due to earlier failure');
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
