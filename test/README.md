# CryptoGadai Backend E2E Test Guidelines

## Test Setup
- Test suite uses `node:test` as the testing framework.
- To run tests, we requires some node options to be set:
  - `--import tsx` to enable TypeScript support.
  - `--experimental-vm-modules` to enable ES module support in Node.js.
  refer to `package.json` for default test script.
- Each test file run independent backend server instance described by `setup` function in `test/setup/setup.ts`.
- Backend test runs compiled version of the code located in `dist` directory so make sure to `pnpm build` before running tests.

## Writing Tests
- Tests are located in the `test/*.test.ts` directory.
- Test shall use wrapped `node:test` functions to provide early exit functionality on failed assertions described in `test/setup/test.ts`.
- Test shall use `node:assert/strict` for assertions.
- Test shall use `typeshaper` for type shapping/narrowing assertions. Example:
  ```ts
  import { assertDefined, assertPropString, assertPropArrayOf } from 'typeshaper';
  const value: unknown = getValue();
  /** the type of value is detetected as unknown */
  assertDefined(value);
  /** the type of value is detetected as NonNullable<unknown> */
  assertPropString(value, 'name');
  /** the type of value is detetected as { name: string } */
  assertPropArrayOf(value, 'items', function (item) {
    /** the type of item is detetected as unknown */
    assertDefined(item);
    /** the type of item is detetected as NonNullable<unknown> */
    assertPropString(item, 'id');
    /** the type of item is detetected as { id: string } */
    return item;
  });
  /** the type of value is detetected as { name: string, items: { id: string }[] } */
  ```
