/**
 * Fastify Prometheus Metrics Plugin
 * A comprehensive plugin for collecting and exporting Prometheus metrics in Fastify applications
 *
 * @packageDocumentation
 */

export { default as fastifyPrometheusPlugin } from './plugin';
export { AwsMetricsExporter } from './aws-metrics-exporter';
export { PrometheusMetrics } from './prometheus-metrics';
export { MetricsCollector } from './metrics-collector';
export { otelExemplarExtractor } from './exemplars';
export { shouldRecord, matchesRoute } from './route-filter';

// Export all types
export type {
  FastifyPrometheusOptions,
  HttpMetricsConfig,
  RequestDurationConfig,
  RequestCountConfig,
  ResponseSizeConfig,
  ErrorCountConfig,
  SuccessCountConfig,
  InFlightConfig,
  CustomMetricDefinition,
  CustomMetricConfig,
  AwsExporterConfig,
  MetricLabels,
  MetricExportData,
  HttpRequestMetrics,
  FastifyPrometheusContext,
  ExemplarLabels,
  ExemplarExtractor,
  RouteMatcher,
  RouteMatchMode,
  RouteFilterConfig,
} from './types';

// Re-export the plugin as default for easy import
export { default } from './plugin';
