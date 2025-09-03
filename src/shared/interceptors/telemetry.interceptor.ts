import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

import { Injectable, Logger } from '@nestjs/common';

import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { tap } from 'rxjs/operators';

import { TelemetryService } from '../services/telemetry.service';

@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  constructor(private readonly telemetryService: TelemetryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const startTime = Date.now();
    const method = request.method;
    const url = request.url;
    const route = request.route?.path || url;

    // Start a span for this request
    const span = this.telemetryService.startSpan(`${method} ${route}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': method,
        'http.url': url,
        'http.route': route,
        'http.user_agent': request.get('user-agent') || '',
        'user.id': (request as { user?: { id?: string } }).user?.id || 'anonymous',
      },
    });

    // Add a start event and increment a business operation metric for this handler
    this.telemetryService.addSpanEvent('handler.start', { method, route });
    this.telemetryService.recordBusinessOperation(`${method} ${route}`, true, { route });

    // Ensure downstream code executes with this span as the active span so child spans correlate
    return this.telemetryService.withTraceContext(span, () =>
      next.handle().pipe(
        tap({
          next: data => {
            const duration = Date.now() - startTime;
            const statusCode = response.statusCode;

            // Record metrics
            this.telemetryService.recordHttpRequest(method, route, statusCode, duration);

            // Update span
            span.setAttributes({
              'http.status_code': statusCode,
              ...(response.get('Content-Length') ? { 'http.response.size': parseInt(response.get('Content-Length'), 10) } : {}),
            });

            span.setStatus({ code: SpanStatusCode.OK });
            this.telemetryService.addSpanEvent('handler.end', { duration });
            span.end();
          },
          error: error => {
            const duration = Date.now() - startTime;
            const statusCode = response.statusCode || 500;

            // Record metrics
            this.telemetryService.recordHttpRequest(method, route, statusCode, duration);
            this.telemetryService.recordError(error.name || error.constructor?.name || 'Error', 'http', {
              method,
              route,
              status_code: statusCode.toString(),
            });

            // Update span
            span.setAttributes({
              'http.status_code': statusCode,
              error: true,
            });

            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error?.message,
            });

            span.recordException(error);
            this.telemetryService.addSpanEvent('handler.error', {
              message: error?.message,
              duration,
            });
            span.end();
          },
        }),
      ),
    );
  }
}
