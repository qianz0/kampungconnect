'use strict';

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { Resource } = require('@opentelemetry/resources');
const { SEMRESATTRS_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');

// ---- Configure OTLP exporter ----
const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4317',
});

// ---- Determine service name ----
const serviceName = 'request-service';

// ---- Create Resource ----
const resource = new Resource({
  [SEMRESATTRS_SERVICE_NAME]: serviceName,
  'service.version': '1.0.0',
  'service.environment': process.env.NODE_ENV || 'development',
});

// ---- Initialize NodeSDK ----
const sdk = new NodeSDK({
  resource,
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

// ---- Start SDK ----
(async () => {
  try {
    await sdk.start();
    console.log(`🚀 OpenTelemetry tracing initialized for ${serviceName}`);
  } catch (err) {
    console.error('❌ OpenTelemetry init error:', err);
  }
})();


// ---- Graceful shutdown ----
process.on('SIGTERM', async () => {
  try {
    await sdk.shutdown();
    console.log('🛑 OpenTelemetry SDK shut down gracefully');
  } catch (err) {
    console.error('❌ Error shutting down OpenTelemetry SDK', err);
  } finally {
    process.exit(0);
  }
});
