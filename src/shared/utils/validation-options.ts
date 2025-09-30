import type { ValidationError } from '@nestjs/common';

import { HttpStatus, UnprocessableEntityException, ValidationPipeOptions } from '@nestjs/common';

import { InterestRateInvalidException } from '../../modules/loans/exceptions/loan-exceptions';

function generateErrors(errors: ValidationError[]) {
  return errors.reduce(
    (accumulator, currentValue) => ({
      ...accumulator,
      [currentValue.property]:
        (currentValue.children?.length ?? 0) > 0
          ? generateErrors(currentValue.children ?? [])
          : Object.values(currentValue.constraints ?? {}),
    }),
    {},
  );
}

export const validationOptions: ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  dismissDefaultMessages: true,
  forbidNonWhitelisted: true,
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  exceptionFactory(errors) {
    // Check for specific validation errors that should throw custom exceptions
    // Check interest rate validation first as it's a critical business rule
    const interestRateError = errors.find(error => error.property === 'interestRate');
    if (interestRateError) {
      const value = interestRateError.value;
      if (typeof value === 'number' && (value < 0.1 || value > 50)) {
        return new InterestRateInvalidException(value);
      }
    }

    return new UnprocessableEntityException({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: generateErrors(errors),
      },
      timestamp: new Date().toISOString(),
    });
  },
};
