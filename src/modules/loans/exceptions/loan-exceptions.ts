import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';

export class ValidationErrorException extends UnprocessableEntityException {
  constructor(message = 'Request validation failed') {
    super({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

export class CurrencyNotSupportedException extends UnprocessableEntityException {
  constructor(blockchainKey: string, tokenId: string) {
    super({
      success: false,
      error: {
        code: 'CURRENCY_NOT_SUPPORTED',
        message: `Currency ${blockchainKey}:${tokenId} is not supported`,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

export class InterestRateInvalidException extends UnprocessableEntityException {
  constructor(rate: number) {
    super({
      success: false,
      error: {
        code: 'INTEREST_RATE_INVALID',
        message: `Interest rate ${rate}% is outside valid range (0.1% - 50%)`,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

export class AmountOutOfBoundsException extends UnprocessableEntityException {
  constructor(amount: string, min: string, max: string) {
    super({
      success: false,
      error: {
        code: 'AMOUNT_OUT_OF_BOUNDS',
        message: `Amount ${amount} is outside valid range (${min} - ${max})`,
      },
      timestamp: new Date().toISOString(),
    });
  }
}

export class MalformedJsonException extends BadRequestException {
  constructor() {
    super({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Request body contains invalid JSON or is not valid JSON',
      },
      timestamp: new Date().toISOString(),
    });
  }
}
