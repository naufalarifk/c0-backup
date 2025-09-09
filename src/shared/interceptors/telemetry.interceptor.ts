import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

import { Injectable, Logger } from '@nestjs/common';

import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { tap } from 'rxjs/operators';

import { TelemetryLogger } from '../../telemetry.logger';
import { AppConfigService } from '../services/app-config.service';
import { TelemetryService } from '../services/telemetry.service';

/**
 * TelemetryInterceptor - Comprehensive HTTP request/response logging and tracing
 *
 * Features:
 * - HTTP request/response logging with detailed metadata
 * - Request/Response body logging (development mode only)
 * - Sensitive data sanitization
 * - OpenTelemetry tracing integration
 * - Loki logging integration
 *
 * Environment Variables:
 * - ENABLE_BODY_LOGGING=true: Enable request/response body logging (dev only)
 * - MAX_BODY_LOG_SIZE=10000: Maximum body size to log in characters (default: 10000)
 *
 * Security:
 * - Automatically redacts sensitive fields: password, token, authorization, apikey, secret, key, private, session, cookie, credit_card, ssn, social_security
 * - Only enabled in development mode by default
 * - Bodies are truncated if they exceed MAX_BODY_LOG_SIZE
 */
export class TelemetryInterceptor implements NestInterceptor {
  #logger = new TelemetryLogger(TelemetryInterceptor.name);

  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly appConfigService: AppConfigService,
  ) {}

  /**
   * Sanitize request/response body for logging
   */
  private sanitizeBody(body: unknown, maxSize: number = 10000): string {
    // Check if body logging is enabled
    const enableBodyLogging = process.env.ENABLE_BODY_LOGGING === 'true';
    if (!enableBodyLogging) return '';

    if (!body) return '';

    try {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

      // Get max size from environment or default
      const configuredMaxSize = parseInt(process.env.MAX_BODY_LOG_SIZE || '10000', 10);

      // Truncate if too large
      if (bodyStr.length > configuredMaxSize) {
        return bodyStr.substring(0, configuredMaxSize) + '...[truncated]';
      }

      // Parse and sanitize JSON
      if (typeof body === 'object') {
        const sanitized = this.sanitizeObject(body);
        return JSON.stringify(sanitized, null, 2);
      }

      return bodyStr;
    } catch (_error) {
      return '[Error serializing body]';
    }
  }

  /**
   * Sanitize object by removing sensitive fields
   */
  private sanitizeObject(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') return obj;

    const sensitiveFields = [
      'password',
      'token',
      'authorization',
      'apikey',
      'secret',
      'key',
      'private',
      'session',
      'cookie',
      'credit_card',
      'ssn',
      'social_security',
    ];

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized = { ...obj } as Record<string, unknown>;
    for (const field of sensitiveFields) {
      if (sanitized[field] !== undefined) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeObject(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Log request body if in development mode
   */
  private logRequestBody(request: Request, context: Record<string, unknown>) {
    if (!this.appConfigService.isDevelopment) return;

    const enableBodyLogging = process.env.ENABLE_BODY_LOGGING === 'true';
    if (!enableBodyLogging) return;

    try {
      const contentType = request.get('content-type') || '';
      const body = request.body;

      if (body && (contentType.includes('json') || contentType.includes('text') || !contentType)) {
        const sanitizedBody = this.sanitizeBody(body);
        if (sanitizedBody) {
          this.#logger.custom('info', 'Request Body', {
            ...context,
            body: sanitizedBody,
            type: 'request_body',
          });
        }
      }
    } catch (error) {
      this.#logger.custom('warn', 'Failed to log request body', {
        ...context,
        error: error instanceof Error ? error.message : String(error),
        type: 'request_body_error',
      });
    }
  }

  /**
   * Log response data if in development mode
   */
  private logResponseBody(data: unknown, context: Record<string, unknown>) {
    if (!this.appConfigService.isDevelopment) return;

    const enableBodyLogging = process.env.ENABLE_BODY_LOGGING === 'true';
    if (!enableBodyLogging) return;

    try {
      if (data !== undefined && data !== null) {
        const sanitizedData = this.sanitizeBody(data);
        if (sanitizedData) {
          this.#logger.custom('info', 'Response Body', {
            ...context,
            body: sanitizedData,
            type: 'response_body',
          });
        }
      }
    } catch (error) {
      this.#logger.custom('warn', 'Failed to log response body', {
        ...context,
        error: error instanceof Error ? error.message : String(error),
        type: 'response_body_error',
      });
    }
  }

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
        // Log request body size if available
        'http.request.body.size': request.get('content-length') || '0',
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

            // Log request body
            this.logRequestBody(request, {
              method,
              url,
              route,
              requestId: request.get('x-request-id') || request.get('request-id') || 'unknown',
            });

            // Log response body
            this.logResponseBody(data, {
              method,
              url,
              route,
              statusCode: statusCode.toString(),
              requestId: request.get('x-request-id') || request.get('request-id') || 'unknown',
            });

            // Log HTTP request/response using TelemetryLogger
            this.#logger.httpRequest(method, url, statusCode, duration, {
              route,
              userAgent: request.get('user-agent') || '',
              userId: (request as { user?: { id?: string } }).user?.id || 'anonymous',
              contentLength: response.get('Content-Length') || '0',
              requestId: request.get('x-request-id') || request.get('request-id') || 'unknown',
              ip: request.ip || request.connection?.remoteAddress || 'unknown',
            });

            // Record metrics
            this.telemetryService.recordHttpRequest(method, route, statusCode, duration);

            // Update span
            span.setAttributes({
              'http.status_code': statusCode,
              ...(response.get('Content-Length')
                ? { 'http.response.size': parseInt(response.get('Content-Length') ?? '0', 10) }
                : {}),
            });

            span.setStatus({ code: SpanStatusCode.OK });
            this.telemetryService.addSpanEvent('handler.end', { duration });
            span.end();
          },
          error: error => {
            const duration = Date.now() - startTime;
            const statusCode = response.statusCode || 500;

            // Log request body even on error
            this.logRequestBody(request, {
              method,
              url,
              route,
              requestId: request.get('x-request-id') || request.get('request-id') || 'unknown',
              error: 'true',
            });

            // Log HTTP request/response error using TelemetryLogger
            this.#logger.httpRequest(method, url, statusCode, duration, {
              route,
              userAgent: request.get('user-agent') || '',
              userId: (request as { user?: { id?: string } }).user?.id || 'anonymous',
              error: error?.message || 'Unknown error',
              requestId: request.get('x-request-id') || request.get('request-id') || 'unknown',
              ip: request.ip || request.connection?.remoteAddress || 'unknown',
            });

            // Record metrics
            this.telemetryService.recordHttpRequest(method, route, statusCode, duration);
            this.telemetryService.recordError(
              error.name || error.constructor?.name || 'Error',
              'http',
              {
                method,
                route,
                status_code: statusCode.toString(),
              },
            );

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
