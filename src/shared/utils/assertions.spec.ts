import {
  assertArray,
  assertArrayMapOf,
  assertDefined,
  assertNumber,
  assertPropDefined,
  assertPropNumber,
  assertPropString,
  assertString,
  isArray,
  isPropDefined,
} from './assertions';

describe('Assertion Utils', () => {
  describe('isArray', () => {
    it('should return true for arrays', () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray(['a', 'b'])).toBe(true);
    });

    it('should return false for non-arrays', () => {
      expect(isArray(null)).toBe(false);
      expect(isArray(undefined)).toBe(false);
      expect(isArray({})).toBe(false);
      expect(isArray('string')).toBe(false);
      expect(isArray(123)).toBe(false);
    });
  });

  describe('isPropDefined', () => {
    it('should return true when property exists and is not null/undefined', () => {
      expect(isPropDefined({ name: 'test' }, 'name')).toBe(true);
      expect(isPropDefined({ count: 0 }, 'count')).toBe(true);
      expect(isPropDefined({ flag: false }, 'flag')).toBe(true);
    });

    it('should return false when property is null or undefined', () => {
      expect(isPropDefined({ name: null }, 'name')).toBe(false);
      expect(isPropDefined({ name: undefined }, 'name')).toBe(false);
    });

    it('should return false when property does not exist', () => {
      expect(isPropDefined({}, 'name')).toBe(false);
      expect(isPropDefined({ other: 'value' }, 'name')).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isPropDefined(null, 'name')).toBe(false);
      expect(isPropDefined(undefined, 'name')).toBe(false);
      expect(isPropDefined('string', 'name')).toBe(false);
      expect(isPropDefined(123, 'name')).toBe(false);
    });
  });

  describe('assertDefined', () => {
    it('should pass for defined values', () => {
      expect(() => assertDefined('test')).not.toThrow();
      expect(() => assertDefined(0)).not.toThrow();
      expect(() => assertDefined(false)).not.toThrow();
      expect(() => assertDefined({})).not.toThrow();
    });

    it('should throw for null', () => {
      expect(() => assertDefined(null)).toThrow('Value is not defined');
    });

    it('should throw for undefined', () => {
      expect(() => assertDefined(undefined)).toThrow('Value is not defined');
    });

    it('should use custom error message', () => {
      expect(() => assertDefined(null, 'Custom error')).toThrow('Custom error');
    });
  });

  describe('assertArray', () => {
    it('should pass for arrays', () => {
      expect(() => assertArray([])).not.toThrow();
      expect(() => assertArray([1, 2, 3])).not.toThrow();
    });

    it('should throw for non-arrays', () => {
      expect(() => assertArray({})).toThrow('Value is not an array');
      expect(() => assertArray('string')).toThrow('Value is not an array');
      expect(() => assertArray(null)).toThrow('Value is not an array');
    });

    it('should use custom error message', () => {
      expect(() => assertArray({}, 'Must be array')).toThrow('Must be array');
    });
  });

  describe('assertArrayMapOf', () => {
    const isString = (item: unknown): item is string => typeof item === 'string';
    const isNumber = (item: unknown): item is number => typeof item === 'number';

    it('should pass for valid typed arrays', () => {
      expect(() => assertArrayMapOf(['a', 'b', 'c'], isString)).not.toThrow();
      expect(() => assertArrayMapOf([1, 2, 3], isNumber)).not.toThrow();
      expect(() => assertArrayMapOf([], isString)).not.toThrow();
    });

    it('should throw for arrays with invalid types', () => {
      expect(() => assertArrayMapOf(['a', 1, 'c'], isString)).toThrow(
        'Array contains invalid type',
      );
      expect(() => assertArrayMapOf([1, 'b', 3], isNumber)).toThrow('Array contains invalid type');
    });

    it('should throw for non-arrays', () => {
      expect(() => assertArrayMapOf({}, isString)).toThrow('Value is not an array');
    });

    it('should use custom error message', () => {
      expect(() => assertArrayMapOf(['a', 1], isString, 'Invalid string array')).toThrow(
        'Invalid string array',
      );
    });
  });

  describe('assertString', () => {
    it('should pass for strings', () => {
      expect(() => assertString('test')).not.toThrow();
      expect(() => assertString('')).not.toThrow();
    });

    it('should throw for non-strings', () => {
      expect(() => assertString(123)).toThrow('Value is not a string');
      expect(() => assertString(null)).toThrow('Value is not a string');
      expect(() => assertString({})).toThrow('Value is not a string');
    });

    it('should use custom error message', () => {
      expect(() => assertString(123, 'Must be string')).toThrow('Must be string');
    });
  });

  describe('assertNumber', () => {
    it('should pass for numbers', () => {
      expect(() => assertNumber(123)).not.toThrow();
      expect(() => assertNumber(0)).not.toThrow();
      expect(() => assertNumber(-1)).not.toThrow();
      expect(() => assertNumber(3.14)).not.toThrow();
    });

    it('should throw for non-numbers', () => {
      expect(() => assertNumber('123')).toThrow('Value is not a number');
      expect(() => assertNumber(null)).toThrow('Value is not a number');
      expect(() => assertNumber({})).toThrow('Value is not a number');
    });

    it('should use custom error message', () => {
      expect(() => assertNumber('123', 'Must be number')).toThrow('Must be number');
    });
  });

  describe('assertPropDefined', () => {
    it('should pass when property is defined', () => {
      expect(() => assertPropDefined({ name: 'test' }, 'name')).not.toThrow();
      expect(() => assertPropDefined({ count: 0 }, 'count')).not.toThrow();
    });

    it('should throw when property is null or undefined', () => {
      expect(() => assertPropDefined({ name: null }, 'name')).toThrow(
        'Property "name" is not defined',
      );
      expect(() => assertPropDefined({ name: undefined }, 'name')).toThrow(
        'Property "name" is not defined',
      );
    });

    it('should throw when property does not exist', () => {
      expect(() => assertPropDefined({}, 'name')).toThrow('Property "name" is not defined');
    });

    it('should throw for non-object values', () => {
      expect(() => assertPropDefined(null, 'name')).toThrow('Property "name" is not defined');
      expect(() => assertPropDefined('string', 'name')).toThrow('Property "name" is not defined');
    });

    it('should use custom error message', () => {
      expect(() => assertPropDefined({}, 'name', 'Custom error')).toThrow('Custom error');
    });
  });

  describe('assertPropNumber', () => {
    it('should pass when property is a number', () => {
      expect(() => assertPropNumber({ age: 25 }, 'age')).not.toThrow();
      expect(() => assertPropNumber({ count: 0 }, 'count')).not.toThrow();
    });

    it('should throw when property is not a number', () => {
      expect(() => assertPropNumber({ age: '25' }, 'age')).toThrow(
        'Property "age" is not a number',
      );
      expect(() => assertPropNumber({ age: null }, 'age')).toThrow(
        'Property "age" is not a number',
      );
    });

    it('should throw when property does not exist', () => {
      expect(() => assertPropNumber({}, 'age')).toThrow('Property "age" is not a number');
    });

    it('should use custom error message', () => {
      expect(() => assertPropNumber({ age: '25' }, 'age', 'Age must be number')).toThrow(
        'Age must be number',
      );
    });
  });

  describe('assertPropString', () => {
    it('should pass when property is a string', () => {
      expect(() => assertPropString({ name: 'test' }, 'name')).not.toThrow();
      expect(() => assertPropString({ name: '' }, 'name')).not.toThrow();
    });

    it('should throw when property is not a string', () => {
      expect(() => assertPropString({ name: 123 }, 'name')).toThrow(
        'Property "name" is not a string',
      );
      expect(() => assertPropString({ name: null }, 'name')).toThrow(
        'Property "name" is not a string',
      );
    });

    it('should throw when property does not exist', () => {
      expect(() => assertPropString({}, 'name')).toThrow('Property "name" is not a string');
    });

    it('should use custom error message', () => {
      expect(() => assertPropString({ name: 123 }, 'name', 'Name must be string')).toThrow(
        'Name must be string',
      );
    });
  });
});
