import { metrics } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HostMetrics } from '@opentelemetry/host-metrics';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_INSTANCE_ID,
  SEMRESATTRS_SERVICE_NAMESPACE,
} from '@opentelemetry/semantic-conventions';

// Initialize OpenTelemetry SDK
const otelSdk = new NodeSDK({
  // Configure resource attributes
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'cryptogadai-backend',
    [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || '1.0.0',
    [SEMRESATTRS_SERVICE_INSTANCE_ID]: process.env.HOSTNAME || process.pid.toString(),
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    [SEMRESATTRS_SERVICE_NAMESPACE]: 'cryptogadai',
  }),

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

// Start the SDK
otelSdk.start();

// Initialize host metrics for system monitoring using the global MeterProvider
const hostMetrics = new HostMetrics({
  meterProvider: metrics.getMeterProvider(),
});
hostMetrics.start();

console.log('OpenTelemetry SDK started successfully');
console.log('Host metrics collection started');

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
