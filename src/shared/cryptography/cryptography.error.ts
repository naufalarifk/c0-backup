import { HttpException, HttpStatus } from '@nestjs/common';

export class CryptographyServiceError extends HttpException {
  constructor(message: string, options?: ErrorOptions & { httpStatus?: HttpStatus }) {
    super(message, options?.httpStatus ?? HttpStatus.INTERNAL_SERVER_ERROR, options);
    this.name = CryptographyServiceError.name;
  }
}
