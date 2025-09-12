import test, { SuiteContext, TestContext } from 'node:test';

export function createEarlyExitNodeTestIt() {
  let isExit = false;
  return {
    beforeEach(
      fn?: ((c: TestContext | SuiteContext) => void | Promise<void>) | undefined,
      options?: test.it.HookOptions,
    ) {
      return test.beforeEach(async function (c) {
        // console.debug('beforeEach called', { isExit });
        if (isExit) return;
        try {
          if (typeof fn === 'function') {
            await Promise.resolve(fn(c));
          }
        } catch (error) {
          // console.debug('beforeEach error', error);
          isExit = true;
          throw error;
        }
      });
    },
    afterEach(
      fn?: ((c: TestContext | SuiteContext) => void | Promise<void>) | undefined,
      options?: test.it.HookOptions,
    ) {
      return test.afterEach(async function (c) {
        // console.debug('afterEach called', { isExit });
        if (isExit) return;
        try {
          if (typeof fn === 'function') {
            await Promise.resolve(fn(c));
          }
        } catch (error) {
          // console.debug('afterEach error', error);
          isExit = true;
          throw error;
        }
      });
    },
    async it(
      name?: string | undefined,
      fn?: ((t: TestContext) => void | Promise<void>) | undefined,
    ): Promise<void> {
      // console.debug('it setup', name, { isExit });
      await test.it(name, async function (t) {
        // console.debug('it called', { isExit });
        if (isExit) {
          t.skip();
          return;
        }
        try {
          if (typeof fn === 'function') {
            await Promise.resolve(fn(t));
          }
        } catch (error) {
          // console.debug('it error', error);
          isExit = true;
          throw error;
        }
      });
    },
  };
}
