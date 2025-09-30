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
    return value >= 0.1 && value <= 50;
  }

  defaultMessage(): string {
    return 'Interest rate must be between 0.1% and 50%';
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
