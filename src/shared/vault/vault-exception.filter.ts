import { 
  ExceptionFilter, 
  Catch, 
  ArgumentsHost, 
  HttpException, 
  HttpStatus, 
  Logger 
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class VaultExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(VaultExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'VAULT_ERROR';

    this.logger.error('Exception caught by VaultExceptionFilter', exception.stack);

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = typeof exceptionResponse === 'string' 
        ? exceptionResponse 
        : (exceptionResponse as any).message || message;
    } else if (exception.message) {
      // Handle specific Vault errors
      const errorMessage = exception.message.toLowerCase();
      
      if (errorMessage.includes('permission denied')) {
        status = HttpStatus.FORBIDDEN;
        message = 'Vault permission denied';
        errorCode = 'VAULT_PERMISSION_DENIED';
      } else if (errorMessage.includes('invalid token') || errorMessage.includes('token not found')) {
        status = HttpStatus.UNAUTHORIZED;
        message = 'Invalid or expired Vault token';
        errorCode = 'VAULT_INVALID_TOKEN';
      } else if (errorMessage.includes('sealed')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Vault is sealed';
        errorCode = 'VAULT_SEALED';
      } else if (errorMessage.includes('connection refused') || errorMessage.includes('econnrefused')) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = 'Cannot connect to Vault server';
        errorCode = 'VAULT_CONNECTION_FAILED';
      } else if (errorMessage.includes('not found') || errorMessage.includes('no value found')) {
        status = HttpStatus.NOT_FOUND;
        message = 'Secret not found in Vault';
        errorCode = 'VAULT_SECRET_NOT_FOUND';
      } else if (errorMessage.includes('timeout')) {
        status = HttpStatus.REQUEST_TIMEOUT;
        message = 'Vault request timeout';
        errorCode = 'VAULT_TIMEOUT';
      } else {
        message = exception.message;
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
      exception.stack
    );

    response.status(status).json(errorResponse);
  }
}
