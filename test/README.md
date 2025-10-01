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
- Test setup and test check shall be deterministic. Use multiple test cases instead of conditional checks. This rules also applies to optional field, each optinal field state must be known from setup and check it properly whether it is defined or not, do not wrap optional field in "if" statement. For example:
  ```ts
  import { ok } from 'node:assert/strict';
  import { assertDefined, assertProp, isNullable } from 'typeshaper';
  // DO:
  it('shall do something', function () {
    const data = await retreiveDataFromSomewhereWithCreationDate();
    assertDefined(data);
    assertPropDefined(data, 'creationDate');
    ok(data.creationDate instanceof Date, 'creationDate shall be a Date object');
  });
  it('shall do something else', function () {
    const data = await setupDataFromSomewhereWithoutCreationDate();
    assertDefined(data);
    assertProp(isNullable, data, 'creationDate');
  });
  // DON'T:
  it('shall do something', function () {
    const data = await retreiveDataFromSomewhere();
    assertDefined(data);
    assertPropDefined(data, 'creationDate');
    if (data.creationDate) {
      ok(data.creationDate instanceof Date, 'creationDate shall be a Date object');
    } else {
      // this branch is not deterministic
      // and may hide bugs in the code
      // because the test may pass without checking the actual code path
      // if the condition is not met
      ok(true, 'creationDate is null or undefined');
    }
  });
  ```
- Any "if" statement in test case need to be critically scrutinize, 90% of the time it come from improper setup and asumtions.
- Test must check how many items are in array, the test must know how many items are expected to be in the array from test setup.
