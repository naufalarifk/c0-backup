import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

import { InterestRateInvalidException } from '../exceptions/loan-exceptions';

@ValidatorConstraint({ name: 'interestRateValid', async: false })
export class InterestRateValidConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'number') {
      return false;
    }
    // Return false for invalid interest rates (outside SRS CONF-001 bounds)
    // Format: 0-1 decimal (e.g., 0.001 = 0.1%, 0.125 = 12.5%, 0.50 = 50%)
    return value >= 0.001 && value <= 0.5;
  }

  defaultMessage(): string {
    return 'Interest rate must be between 0.001 and 0.50 (0.1% to 50%)';
  }
}

export function IsValidInterestRate(validationOptions?: ValidationOptions) {
  return function (object: Record<string, unknown>, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: InterestRateValidConstraint,
    });
  };
}
