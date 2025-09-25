// biome-ignore-all lint/suspicious/noExplicitAny: Global exception filter needs flexible typing for error objects
import { STATUS_CODES } from 'node:http';

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

import { ValidationError } from 'class-validator';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let payload: unknown = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      payload = exception.getResponse();
    } else if (exception instanceof Error) {
      payload = { message: exception.message };
    }

    // Get request ID from headers
    const requestId = req.get('x-request-id') || req.get('request-id') || 'unknown';
    const timestamp = new Date().toISOString();

    // Handle validation errors (422 status code)
    if (status === HttpStatus.UNPROCESSABLE_ENTITY) {
      const validationDetails = this.extractValidationDetails(payload);

      return res.status(status).json({
        success: false,
        timestamp,
        requestId,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: validationDetails,
        },
      });
    }

    // Handle conflict errors (409 status code)
    if (status === HttpStatus.CONFLICT) {
      const errorCode = this.extractErrorCode(exception);
      const details = this.extractConflictDetails(exception, payload);

      return res.status(status).json({
        success: false,
        timestamp,
        requestId,
        error: {
          code: errorCode,
          message: this.extractErrorMessage(payload),
          details,
        },
      });
    }

    // Handle forbidden errors with specific code mapping
    if (status === HttpStatus.FORBIDDEN) {
      const errorMessage = this.extractErrorMessage(payload);
      const errorCode = this.getForbiddenErrorCode(errorMessage);

      return res.status(status).json({
        success: false,
        timestamp,
        requestId,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      });
    }

    // Handle other HTTP errors with standard format
    if (exception instanceof HttpException) {
      return res.status(status).json({
        success: false,
        timestamp,
        requestId,
        error: {
          code: this.getErrorCodeFromStatus(status),
          message: this.extractErrorMessage(payload),
        },
      });
    }

    // Handle custom errors with specific error codes
    if (exception instanceof Error && (exception as any).code) {
      const customError = exception as any;
      const statusCode =
        customError.code === 'USER_ALREADY_MEMBER' ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;

      const errorResponse: any = {
        code: customError.code,
        message: customError.message,
      };

      // Add details if present
      if (customError.details) {
        errorResponse.details = customError.details;
      }

      return res.status(statusCode).json({
        success: false,
        timestamp,
        requestId,
        error: errorResponse,
      });
    }

    // Fallback for unexpected errors
    return res.status(status).json({
      success: false,
      timestamp,
      requestId,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  }

  private extractValidationDetails(payload: unknown): Record<string, string> {
    if (typeof payload === 'object' && payload !== null) {
      const p = payload as any;

      // Handle custom errors structure from validation pipe
      if (p.errors && typeof p.errors === 'object') {
        const details: Record<string, string> = {};
        for (const [field, messages] of Object.entries(p.errors)) {
          if (Array.isArray(messages) && messages.length > 0) {
            details[field] = messages[0]; // Get the first error message
          } else if (typeof messages === 'string') {
            details[field] = messages;
          }
        }
        return details;
      }

      // Handle class-validator ValidationError array
      if (Array.isArray(p.message)) {
        const details: Record<string, string> = {};
        for (const error of p.message) {
          if (error && typeof error === 'object' && 'property' in error && 'constraints' in error) {
            const validationError = error as ValidationError;
            if (validationError.constraints) {
              // Get the first constraint message
              const constraintKey = Object.keys(validationError.constraints)[0];
              details[validationError.property] = validationError.constraints[constraintKey];
            }
          }
        }
        return details;
      }

      // Handle custom validation details
      if (p.details && typeof p.details === 'object') {
        return p.details;
      }

      // Handle single validation message
      if (typeof p.message === 'string') {
        return { validation: p.message };
      }
    }

    return {};
  }

  private extractErrorCode(exception: unknown): string {
    // Try to extract error code from ConflictException response
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        const responseObj = response as any;
        if (responseObj.code) {
          return responseObj.code;
        }
      }

      // Try to extract from exception custom properties
      if ((exception as any).code) {
        return (exception as any).code;
      }
    }

    // Try to extract error code from exception message or properties
    if (exception instanceof Error) {
      // Check for custom error code property first
      if ((exception as any).code) {
        return (exception as any).code;
      }

      const message = exception.message.toLowerCase();
      if (
        message.includes('duplicate') ||
        message.includes('already exists') ||
        message.includes('already associated')
      ) {
        if (message.includes('nik')) return 'DUPLICATE_NIK';
        if (message.includes('business name')) return 'BUSINESS_NAME_EXISTS';
        return 'DUPLICATE_RESOURCE';
      }
    }
    return 'CONFLICT';
  }

  private extractConflictDetails(exception: unknown, payload: unknown): Record<string, any> {
    // Try to extract details from ConflictException response
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        const responseObj = response as any;
        if (responseObj.details) {
          return responseObj.details;
        }
      }

      // Try to extract from exception custom properties
      if ((exception as any).details) {
        return (exception as any).details;
      }
    }

    // Try to extract specific details from conflict errors
    if (exception instanceof Error) {
      // Check for custom details property first
      if ((exception as any).details) {
        return (exception as any).details;
      }

      const message = exception.message;
      if (message.includes('NIK')) {
        // Extract NIK from error message if possible
        const nikMatch = message.match(/(\d{16})/);
        return {
          nik: nikMatch ? nikMatch[1] : 'unknown',
          message: message,
        };
      }
      if (message.includes('business name')) {
        // Extract business name from error message if possible
        return {
          businessName: 'unknown',
          message: message,
        };
      }
    }

    return { message: this.extractErrorMessage(payload) };
  }

  private extractErrorMessage(payload: unknown): string {
    if (typeof payload === 'string') {
      return payload;
    }

    if (typeof payload === 'object' && payload !== null) {
      const p = payload as any;
      if (typeof p.message === 'string') {
        return p.message;
      }
      if (Array.isArray(p.message) && p.message.length > 0) {
        return 'Validation failed';
      }
    }

    return 'An error occurred';
  }

  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.METHOD_NOT_ALLOWED:
        return 'METHOD_NOT_ALLOWED';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      default:
        return 'HTTP_ERROR';
    }
  }

  private getForbiddenErrorCode(message: string): string {
    // Check for specific permission-related messages
    if (
      message.includes('not a member') ||
      message.includes('insufficient permissions') ||
      message.includes('Insufficient permissions')
    ) {
      return 'INSUFFICIENT_PERMISSIONS';
    }

    // Default forbidden error code
    return 'FORBIDDEN';
  }
}
