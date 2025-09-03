import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';

// Initialize OpenTelemetry SDK
const otelSdk = new NodeSDK({
  // Configure resource attributes
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'cryptogadai-backend',
    [ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION || '0.0.1',
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),

  // Configure trace exporter
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
      ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
      : {},
  }),

  // Configure metric reader
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics',
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        : {},
    }),
    exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL) || 30000,
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
          // Ignore health check endpoints to reduce noise
          const url = req.url || '';
          return /^(\/api)?\/health(\/|$)/.test(url);
        },
        ignoreOutgoingRequestHook: options => {
          // Ignore internal service calls if needed
          const hostname = typeof options === 'string' ? options : options?.hostname;
          return hostname === 'localhost' && process.env.NODE_ENV === 'development';
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

// Graceful shutdown
async function gracefulShutdown() {
  return await otelSdk
    .shutdown()
    .then(() => console.log('OpenTelemetry terminated'))
    .catch((error: unknown) => console.log('Error terminating OpenTelemetry', error))
    .finally(() => process.exit(0));
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default otelSdk;
