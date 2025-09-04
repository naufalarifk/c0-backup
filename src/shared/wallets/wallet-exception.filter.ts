import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { Request, Response } from 'express';

@Catch()
export class WalletExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WalletExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'WALLET_ERROR';

    this.logger.error('Exception caught by WalletExceptionFilter', (exception as Error).stack);

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Error).message || message;
    } else if ((exception as Error).message) {
      // Handle specific Wallet errors
      const errorMessage = (exception as Error).message.toLowerCase();

      if (errorMessage.includes('wallet not found')) {
        status = HttpStatus.NOT_FOUND;
        message = 'Wallet not found';
        errorCode = 'WALLET_NOT_FOUND';
      } else if (errorMessage.includes('account not found')) {
        status = HttpStatus.NOT_FOUND;
        message = 'Account not found';
        errorCode = 'ACCOUNT_NOT_FOUND';
      } else if (errorMessage.includes('address not found')) {
        status = HttpStatus.NOT_FOUND;
        message = 'Address not found';
        errorCode = 'ADDRESS_NOT_FOUND';
      } else if (errorMessage.includes('invalid mnemonic')) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid mnemonic phrase';
        errorCode = 'INVALID_MNEMONIC';
      } else if (
        errorMessage.includes('invalid derivation path') ||
        errorMessage.includes('invalid path')
      ) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid derivation path';
        errorCode = 'INVALID_DERIVATION_PATH';
      } else if (
        errorMessage.includes('insufficient balance') ||
        errorMessage.includes('insufficient funds')
      ) {
        status = HttpStatus.BAD_REQUEST;
        message = 'Insufficient balance for transaction';
        errorCode = 'INSUFFICIENT_BALANCE';
      } else if (errorMessage.includes('database') || errorMessage.includes('connection')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Database connection failed';
        errorCode = 'DATABASE_CONNECTION_FAILED';
      } else if (errorMessage.includes('encryption') || errorMessage.includes('decryption')) {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Encryption/decryption failed';
        errorCode = 'ENCRYPTION_ERROR';
      } else if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
        status = HttpStatus.CONFLICT;
        message = 'Resource already exists';
        errorCode = 'DUPLICATE_RESOURCE';
      } else if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
        status = HttpStatus.BAD_REQUEST;
        message = (exception as Error).message;
        errorCode = 'VALIDATION_ERROR';
      } else if (errorMessage.includes('timeout')) {
        status = HttpStatus.REQUEST_TIMEOUT;
        message = 'Request timeout';
        errorCode = 'REQUEST_TIMEOUT';
      } else if (errorMessage.includes('network') || errorMessage.includes('blockchain')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Blockchain network unavailable';
        errorCode = 'BLOCKCHAIN_NETWORK_ERROR';
      } else {
        message = (exception as Error).message;
      }
    }

    const errorResponse = {
      statusCode: status,
      errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    // Log the error details
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      (exception as Error).stack,
    );

    response.status(status).json(errorResponse);
  }
}
