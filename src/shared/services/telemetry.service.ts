import { Injectable } from '@nestjs/common';

import { context, metrics, type Span, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

@Injectable()
export class TelemetryService {
  private readonly meter = metrics.getMeter('cryptogadai-backend', '1.0.0');
  private readonly tracer = trace.getTracer('cryptogadai-backend', '1.0.0');

  // Metrics
  private readonly httpRequestsTotal = this.meter.createCounter('http_requests_total', {
    description: 'Total number of HTTP requests',
  });

  private readonly httpRequestDuration = this.meter.createHistogram(
    'http_request_duration_seconds',
    {
      description: 'Duration of HTTP requests in seconds',
      unit: 's',
    },
  );

  private readonly activeConnections = this.meter.createUpDownCounter('active_connections', {
    description: 'Number of active connections',
  });

  private readonly businessOperations = this.meter.createCounter('business_operations_total', {
    description: 'Total number of business operations',
  });

  private readonly errorCount = this.meter.createCounter('errors_total', {
    description: 'Total number of errors',
  });

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    const attributes = {
      method,
      route,
      status_code: statusCode.toString(),
    };

    this.httpRequestsTotal.add(1, attributes);
    this.httpRequestDuration.record(duration / 1000, attributes); // Convert to seconds
  }

  /**
   * Record active connection change
   */
  recordConnectionChange(change: number): void {
    this.activeConnections.add(change);
  }

  /**
   * Record business operation
   */
  recordBusinessOperation(
    operation: string,
    success: boolean,
    attributes: Record<string, string> = {},
  ): void {
    this.businessOperations.add(1, {
      operation,
      success: success.toString(),
      ...attributes,
    });
  }

  /**
   * Record error
   */
  recordError(error: string, component: string, attributes: Record<string, string> = {}): void {
    this.errorCount.add(1, {
      error,
      component,
      ...attributes,
    });
  }

  /**
   * Create and start a span
   */
  startSpan(
    name: string,
    options: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
    } = {},
  ): Span {
    return this.tracer?.startSpan(name, {
      kind: options.kind || SpanKind.INTERNAL,
      attributes: options.attributes,
    });
  }

  /**
   * Wrap a function with tracing
   */
  async traceFunction<T>(
    name: string,
    fn: () => Promise<T> | T,
    options: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
    } = {},
  ): Promise<T> {
    const span = this.startSpan(name, options);

    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Add attributes to current span
   */
  addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
    }
  }

  /**
   * Add an event to current span
   */
  addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Set current span status
   */
  setSpanStatus(code: SpanStatusCode, message?: string): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setStatus({ code, message });
    }
  }

  /**
   * Record an exception in current span
   */
  recordException(error: Error): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error);
    }
  }

  /**
   * Get current trace ID
   */
  getCurrentTraceId(): string | undefined {
    const span = trace.getActiveSpan();
    return span?.spanContext().traceId;
  }

  /**
   * Get current span ID
   */
  getCurrentSpanId(): string | undefined {
    const span = trace.getActiveSpan();
    return span?.spanContext().spanId;
  }

  /**
   * Execute function within a trace context
   */
  withTraceContext<T>(span: Span, fn: () => T): T {
    // Ensure the provided function executes synchronously within the trace context.
    // Callers that return Promises should manage async flow themselves.
    return context.with(trace.setSpan(context.active(), span), fn) as T;
  }
}
