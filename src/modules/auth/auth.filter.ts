import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import { Catch } from '@nestjs/common';
import { APIError } from 'better-auth/api';

@Catch(APIError)
export class AuthFilter implements ExceptionFilter {
  catch(exception: APIError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.statusCode;
    const message = exception.body?.message;

    response.status(status).json({
      statusCode: status,
      message,
    });
  }
}
