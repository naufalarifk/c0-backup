/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation> */
import { STATUS_CODES } from 'node:http';

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let payload: unknown = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      payload = exception.getResponse();
    } else if (exception instanceof Error) {
      payload = { message: exception.message };
    }

    // Jika kita menerima object yang memang berisi `errors` (struktur custom dari exceptionFactory)
    if (typeof payload === 'object' && payload !== null && 'errors' in (payload as any)) {
      // kirim apa adanya (biarkan frontend handle errors object)
      return res.status(status).json(payload);
    }

    // Jika kita menerima default class-validator shape: object with message: ValidationError[]
    if (typeof payload === 'object' && payload !== null && 'message' in (payload as any)) {
      const p = payload as any;
      // jangan ubah p.message kalau itu array (biarkan array tetap array)
      return res.status(status).json({
        statusCode: status,
        error: STATUS_CODES[status],
        message: p.message ?? p, // bisa string | string[] | ValidationError[]
        ...(p.errors ? { errors: p.errors } : {}),
      });
    }

    // fallback: payload bisa jadi string atau array langsung
    return res.status(status).json({
      statusCode: status,
      error: STATUS_CODES[status],
      message: payload,
    });
  }
}
