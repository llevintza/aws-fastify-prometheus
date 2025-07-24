/**
 * Main entry point for the aws-node-prometheus library
 * 
 * This library provides utilities for integrating Prometheus metrics
 * with AWS services and Node.js applications.
 * 
 * @packageDocumentation
 */

export { PrometheusMetrics } from './prometheus-metrics';
export { MetricsCollector } from './metrics-collector';
export { AwsMetricsExporter } from './aws-metrics-exporter';

export type {
  MetricConfig,
  MetricType,
  MetricLabels,
  PrometheusConfig,
  AwsExporterConfig,
  CollectorOptions,
} from './types';

export type {
  Counter,
  Gauge,
  Histogram,
  Summary,
} from './interfaces';
