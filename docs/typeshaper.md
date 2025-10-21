# Type Handling Guidelines using Typeshaper

This repository employs strict type handling practices to ensure type safety and reliability throughout the codebase. Below are the guidelines for handling types effectively.

We use utils called `typeshaper` to help with type narrowing and shaping.

## Always use `unknown` instead of `any`

All unkown type needs to be narrowed down before use.

### Using `typeshaper` to narrow down types

```typescript
import {
  assertArrayMapOf,
  assertDefined,
  assertProp,
  assertPropArrayMapOf,
  assertPropArrayOf,
  assertPropString,
  check,
  isNullable,
  isNumber,
  isString,
  isInstanceOf,
} from 'typeshaper';

const data: unknown = fetchDataFromSomewhere();

// Assert that data is defined (not null or undefined)
// assertDefined is mandatory, without assertDefined or assertPropDefined, any other assertion will fail if data is null or undefined
assertDefined(data);
// Assert that data is an array
assertArrayMapOf(data, function (item) {
  assertDefined(item);
  // assert that item has a string property 'id' and 'name'
  assertPropNumber(item, 'id');
  assertPropString(item, 'name');
  // assert that item has an optional string property 'description'
  assertProp(check(isNullable, isString), item, 'description');
  // assert that item has an array property 'tags' with objects containing 'label' and 'value'
  assertPropArrayMapOf(item, 'tags', function (tag) {
    assertDefined(tag);
    assertPropString(tag, 'label');
    assertPropNumber(tag, 'value');
    return tag;
  });
  // assert that item has a property 'countOrLabel' which can be either number or string
  assertProp(check(isNumber, isString), item, 'countOrLabel');
  // assert that item has a property 'createdDate' which is an instance of Date
  assertProp(isInstanceOf(Date), item, 'createdDate');
  return item;
});

```

### Type categorization

```typescript
import { isArray, isBoolean, isNumber, isString, hasProp, hasPropString, hasPropArrayOf } from 'typeshaper';

function processValue(value: unknown) {
  if (isString(value)) {
    // value is string
  } else if (isNumber(value)) {
    // value is number
  } else if (isBoolean(value)) {
    // value is boolean
  } else if (isArray(value)) {
    // value is array
  } else if (hasProp(check(isString, isNumber), value, 'id')) {
    // value is object with property 'id' which can be string or number
  } else if (hasPropString(value, 'name')) {
    // value is object with property 'name' which is string
  } else if (hasPropArrayOf(value, 'items', isNumber)) {
    // value is object with property 'items' which is array of numbers
  }
}
```

For more details about typeshaper, read the `node_modules/typeshaper/lib/typeshaper.js` file directly.
