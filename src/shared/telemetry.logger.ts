import { Injectable, LoggerService, Optional } from '@nestjs/common';

import { Logger, logs, SeverityNumber } from '@opentelemetry/api-logs';

export interface LogContext {
  [key: string]: string | number | boolean | null | undefined;
}

export interface LogEntry {
  message: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  context?: LogContext;
  error?: Error;
  timestamp?: number;
}

@Injectable()
export class TelemetryLogger implements LoggerService {
  private readonly logger: Logger;
  private readonly serviceName: string;
  private readonly serviceVersion: string;

  constructor(@Optional() serviceName?: string, @Optional() serviceVersion?: string) {
    this.serviceName = serviceName || process.env.OTEL_SERVICE_NAME || 'cryptogadai-backend';
    this.serviceVersion = serviceVersion || process.env.OTEL_SERVICE_VERSION || '1.0.0';

    // Get the logger from the global LoggerProvider (set up in telemetry.ts)
    this.logger = logs.getLogger(this.serviceName, this.serviceVersion);
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    this.emitLog('debug', message, optionalParams);
  }

  log(message: string, ...optionalParams: unknown[]): void {
    this.emitLog('info', message, optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    this.emitLog('warn', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    if (typeof message === 'string') {
      this.emitLog('error', message, optionalParams);
    } else if (message instanceof Error) {
      this.emitLog('error', message.message, {
        ...optionalParams,
        errorName: message.name,
        errorMessage: message.message,
        errorStack: message.stack,
      });
    } else {
      this.emitLog('error', String(message), optionalParams);
    }
  }

  verbose(message: string, context?: LogContext): void {
    this.debug(message, context);
  }

  business(operation: string, success: boolean, context?: LogContext): void {
    this.emitLog(success ? 'info' : 'error', `Business operation: ${operation}`, {
      ...context,
      operation,
      success: success.toString(),
      type: 'business',
    });
  }

  httpRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    context?: LogContext,
  ): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    this.emitLog(level, `HTTP ${method} ${url} - ${statusCode}`, {
      ...context,
      method,
      url,
      statusCode: statusCode.toString(),
      duration: duration.toString(),
      type: 'http',
    });
  }

  database(operation: string, table: string, duration: number, context?: LogContext): void {
    this.emitLog('info', `Database ${operation} on ${table}`, {
      ...context,
      operation,
      table,
      duration: duration.toString(),
      type: 'database',
    });
  }

  custom(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    attributes: Record<string, string | number | boolean>,
  ): void {
    this.emitLog(level, message, { ...attributes, type: 'custom' });
  }

  private emitLog(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    ...optionalParams: unknown[]
  ): void {
    // Check if logging is enabled for this level (respects LOG_LEVEL from telemetry.ts)
    const LOG_LEVEL = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = LOG_LEVELS[level] ?? 1;
    const configuredLevel = LOG_LEVELS[LOG_LEVEL as keyof typeof LOG_LEVELS] ?? 1;

    if (currentLevel < configuredLevel) {
      return;
    }

    const timestamp = Date.now();
    const severityNumber = this.getSeverityNumber(level);

    // Prepare attributes
    const attributes: Record<string, string | number | boolean> = {
      'service.name': this.serviceName,
      'service.version': this.serviceVersion,
      'log.level': level,
      source: 'logger-service',
    };

    // Emit the log record
    this.logger.emit({
      timestamp,
      severityNumber,
      severityText: level.toUpperCase(),
      body: message,
      attributes,
    });

    // Also log to console for local development (respects the console override in telemetry.ts)
    const consoleMethod =
      level === 'debug' ? 'debug' : level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log';

    console[consoleMethod](`[${level.toUpperCase()}] ${message}`, ...optionalParams);
  }

  private getSeverityNumber(level: string): number {
    switch (level) {
      case 'debug':
        return SeverityNumber.DEBUG;
      case 'info':
        return SeverityNumber.INFO;
      case 'warn':
        return SeverityNumber.WARN;
      case 'error':
        return SeverityNumber.ERROR;
      default:
        return SeverityNumber.INFO;
    }
  }

  child(context: LogContext): TelemetryLogger {
    const childLogger = new TelemetryLogger(this.serviceName, this.serviceVersion);
    // Store the base context for all future logs
    (childLogger as { baseContext?: LogContext }).baseContext = context;
    return childLogger;
  }

  static setGlobalLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
    process.env.LOG_LEVEL = level;
  }
}
