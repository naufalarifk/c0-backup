import { unknownErrorToPlain, unknownErrorToString } from './errors';

describe('Error Utils', () => {
  describe('unknownErrorToPlain', () => {
    it('should convert Error instance to plain object', () => {
      const error = new Error('Test error');
      error.name = 'TestError';

      const result = unknownErrorToPlain(error);

      expect(result).toEqual({
        name: 'TestError',
        message: 'Test error',
        stack: expect.any(String),
        cause: undefined,
      });
    });

    it('should convert string to plain object', () => {
      const result = unknownErrorToPlain('Error message');

      expect(result).toEqual({
        message: 'Error message',
      });
    });

    it('should return object as-is when already an object', () => {
      const errorObj = { custom: 'error', code: 500 };

      const result = unknownErrorToPlain(errorObj);

      expect(result).toBe(errorObj);
    });

    it('should return undefined for undefined input', () => {
      const result = unknownErrorToPlain(undefined);

      expect(result).toBeUndefined();
    });

    it('should handle primitive types', () => {
      expect(unknownErrorToPlain(123)).toEqual({
        message: 'Unhandled Type Error: 123',
      });

      expect(unknownErrorToPlain(true)).toEqual({
        message: 'Unhandled Type Error: true',
      });
    });

    it('should handle null input', () => {
      const result = unknownErrorToPlain(null);

      expect(result).toEqual({
        message: 'Unhandled Type Error: null',
      });
    });

    it('should handle nested Error causes', () => {
      const rootCause = new Error('Root cause');
      const error = new Error('Main error');
      error.cause = rootCause;

      const result = unknownErrorToPlain(error);

      expect(result).toEqual({
        name: 'Error',
        message: 'Main error',
        stack: expect.any(String),
        cause: {
          name: 'Error',
          message: 'Root cause',
          stack: expect.any(String),
          cause: undefined,
        },
      });
    });

    it('should handle non-Error cause', () => {
      const error = new Error('Main error');
      error.cause = 'Simple cause';

      const result = unknownErrorToPlain(error);

      expect(result).toEqual({
        name: 'Error',
        message: 'Main error',
        stack: expect.any(String),
        cause: 'Simple cause',
      });
    });
  });

  describe('unknownErrorToString', () => {
    it('should convert error to JSON string', () => {
      const error = new Error('Test error');

      const result = unknownErrorToString(error);

      expect(result).toContain('"name": "Error"');
      expect(result).toContain('"message": "Test error"');
      expect(JSON.parse(result)).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: expect.any(String),
        cause: undefined,
      });
    });

    it('should format with proper indentation', () => {
      const result = unknownErrorToString('Simple error');

      expect(result).toBe('{\n  "message": "Simple error"\n}');
    });
  });
});
