import { metrics } from '@opentelemetry/api';
import * as logsAPI from '@opentelemetry/api-logs';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HostMetrics } from '@opentelemetry/host-metrics';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_INSTANCE_ID,
  SEMRESATTRS_SERVICE_NAMESPACE,
} from '@opentelemetry/semantic-conventions';

// Configure resource attributes (shared across all telemetry signals)
const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'cryptogadai-backend',
  [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || '1.0.0',
  [SEMRESATTRS_SERVICE_INSTANCE_ID]: process.env.HOSTNAME || process.pid.toString(),
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  [SEMRESATTRS_SERVICE_NAMESPACE]: 'cryptogadai',
});

// Configure log exporter and processor
const logExporter = new OTLPLogExporter({
  url:
    process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    'http://localhost:4318/v1/logs',
  headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
    ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
    : {},
});

// Create and configure the log record processor
const logRecordProcessor = new BatchLogRecordProcessor(logExporter);

// Initialize OpenTelemetry SDK
const otelSdk = new NodeSDK({
  // Use shared resource
  resource,

  // Configure trace exporter
  traceExporter: new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      'http://localhost:4318/v1/traces',
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
      ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
      : {},
  }),

  // Configure metric reader
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url:
        process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ||
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
        'http://localhost:4318/v1/metrics',
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        : {},
    }),
    exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL) || 30000,
    exportTimeoutMillis: 10000, // Must be less than or equal to exportIntervalMillis
  }),

  // Configure instrumentations
  instrumentations: [
    // Auto-instrumentations for Node.js libraries
    getNodeAutoInstrumentations({
      // Disable problematic instrumentations if needed
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable filesystem instrumentation to reduce noise
      },
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoreIncomingRequestHook: req => {
          // Ignore health check and metrics endpoints to reduce noise
          const url = req.url || '';
          return /^(\/api)?\/(health|metrics)(\/|$)/.test(url);
        },
        ignoreOutgoingRequestHook: options => {
          // Ignore internal service calls and telemetry endpoints
          const hostname = typeof options === 'string' ? options : options?.hostname;
          const isLocalhost = hostname === 'localhost';
          const isInternalCollector = hostname?.includes('otel-collector');
          return Boolean(
            (isLocalhost || isInternalCollector) && process.env.NODE_ENV === 'development',
          );
        },
        requestHook: (span, request) => {
          // Add custom attributes to HTTP spans
          const headers = 'headers' in request ? request.headers : undefined;
          span.setAttributes({
            'http.request.body.size': headers?.['content-length'] || 0,
          });
        },
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-redis': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-ioredis': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
        enhancedDatabaseReporting: true,
      },
    }),

    // NestJS-specific instrumentation
    new NestInstrumentation({
      enabled: true,
    }),
  ],
});

// Initialize host metrics for system monitoring using the global MeterProvider
const hostMetrics = new HostMetrics({
  meterProvider: metrics.getMeterProvider(),
});
hostMetrics.start();

otelSdk.start();

const loggerProvider = new LoggerProvider({
  resource,
  processors: [logRecordProcessor],
});

logsAPI.logs.setGlobalLoggerProvider(loggerProvider);

const logger = logsAPI.logs.getLogger('nestjs-console', '1.0.0');

const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

function createLogRecord(level: string, message: string, ...args: unknown[]) {
  const timestamp = Date.now();
  const fullMessage = args.length > 0 ? `${message} ${args.join(' ')}` : message;

  logger.emit({
    timestamp,
    severityNumber: getSeverityNumber(level),
    severityText: level.toUpperCase(),
    body: fullMessage,
    attributes: {
      source: 'nestjs-console',
      'log.level': level,
      'service.name': process.env.OTEL_SERVICE_NAME || 'cryptogadai-backend',
      'service.version': process.env.OTEL_SERVICE_VERSION || '1.0.0',
    },
  });
}

function getSeverityNumber(level: string): number {
  switch (level) {
    case 'debug':
      return 5; // DEBUG
    case 'info':
      return 9; // INFO
    case 'warn':
      return 13; // WARN
    case 'error':
      return 17; // ERROR
    default:
      return 9; // INFO as default
  }
}

console.log = function (message?: unknown, ...args: unknown[]) {
  const msg = String(message || '');
  createLogRecord('info', msg, ...args);
  originalConsole.log(message, ...args);
};

console.error = function (message?: unknown, ...args: unknown[]) {
  const msg = String(message || '');
  createLogRecord('error', msg, ...args);
  originalConsole.error(message, ...args);
};

console.warn = function (message?: unknown, ...args: unknown[]) {
  const msg = String(message || '');
  createLogRecord('warn', msg, ...args);
  originalConsole.warn(message, ...args);
};

console.info = function (message?: unknown, ...args: unknown[]) {
  const msg = String(message || '');
  createLogRecord('info', msg, ...args);
  originalConsole.info(message, ...args);
};

console.debug = function (message?: unknown, ...args: unknown[]) {
  const msg = String(message || '');
  createLogRecord('debug', msg, ...args);
  originalConsole.debug(message, ...args);
};

console.log('OpenTelemetry SDK started successfully');
console.log('Host metrics collection started');
console.log('Console logging instrumentation initialized');

// Graceful shutdown
async function gracefulShutdown() {
  console.log('Shutting down OpenTelemetry...');

  return await otelSdk
    .shutdown()
    .then(() => console.log('OpenTelemetry terminated'))
    .catch((error: unknown) => console.log('Error terminating OpenTelemetry', error))
    .finally(() => process.exit(0));
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default otelSdk;
