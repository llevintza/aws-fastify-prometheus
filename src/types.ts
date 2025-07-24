/**
 * Type definitions for the Fastify Prometheus metrics plugin
 */

import type { FastifyPluginOptions } from 'fastify';
import type { register } from 'prom-client';

/**
 * Plugin configuration options
 */
export interface FastifyPrometheusOptions extends FastifyPluginOptions {
  /** Prometheus metrics registry (optional, defaults to global registry) */
  register?: typeof register;

  /** Metrics endpoint path */
  endpoint?: string;

  /** Enable default metrics collection */
  enableDefaultMetrics?: boolean;

  /** Default metrics collection interval in milliseconds */
  defaultMetricsInterval?: number;

  /** Predefined HTTP metrics configuration */
  httpMetrics?: HttpMetricsConfig;

  /** Custom metrics definitions */
  customMetrics?: CustomMetricDefinition[];

  /** AWS CloudWatch integration configuration */
  awsCloudWatch?: AwsExporterConfig;

  /** Exclude specific routes from metrics collection */
  excludeRoutes?: string[];

  /** Include only specific routes in metrics collection */
  includeRoutes?: string[];

  /** Custom labels to add to all metrics */
  defaultLabels?: Record<string, string>;
}

/**
 * HTTP metrics configuration
 */
export interface HttpMetricsConfig {
  /** Enable request duration histogram */
  requestDuration?: RequestDurationConfig;

  /** Enable request count counter */
  requestCount?: RequestCountConfig;

  /** Enable response size histogram */
  responseSize?: ResponseSizeConfig;

  /** Enable error count counter */
  errorCount?: ErrorCountConfig;

  /** Enable success count counter */
  successCount?: SuccessCountConfig;
}

/**
 * Request duration histogram configuration
 */
export interface RequestDurationConfig {
  /** Enable this metric */
  enabled?: boolean;

  /** Metric name */
  name?: string;

  /** Metric help text */
  help?: string;

  /** Histogram buckets in milliseconds */
  buckets?: number[];

  /** Additional labels */
  labels?: string[];
}

/**
 * Request count counter configuration
 */
export interface RequestCountConfig {
  /** Enable this metric */
  enabled?: boolean;

  /** Metric name */
  name?: string;

  /** Metric help text */
  help?: string;

  /** Additional labels */
  labels?: string[];
}

/**
 * Response size histogram configuration
 */
export interface ResponseSizeConfig {
  /** Enable this metric */
  enabled?: boolean;

  /** Metric name */
  name?: string;

  /** Metric help text */
  help?: string;

  /** Histogram buckets in bytes */
  buckets?: number[];

  /** Additional labels */
  labels?: string[];
}

/**
 * Error count counter configuration
 */
export interface ErrorCountConfig {
  /** Enable this metric */
  enabled?: boolean;

  /** Metric name */
  name?: string;

  /** Metric help text */
  help?: string;

  /** Additional labels */
  labels?: string[];
}

/**
 * Success count counter configuration
 */
export interface SuccessCountConfig {
  /** Enable this metric */
  enabled?: boolean;

  /** Metric name */
  name?: string;

  /** Metric help text */
  help?: string;

  /** Additional labels */
  labels?: string[];
}

/**
 * Custom metric definition
 */
export interface CustomMetricDefinition {
  /** Metric type */
  type: 'counter' | 'gauge' | 'histogram' | 'summary';

  /** Metric name */
  name: string;

  /** Metric help text */
  help: string;

  /** Metric labels */
  labels?: string[];

  /** Configuration specific to metric type */
  config?: CustomMetricConfig;
}

/**
 * Custom metric configuration
 */
export interface CustomMetricConfig {
  /** Histogram buckets (for histogram metrics) */
  buckets?: number[];

  /** Summary percentiles (for summary metrics) */
  percentiles?: number[];

  /** Summary max age in seconds (for summary metrics) */
  maxAgeSeconds?: number;

  /** Summary age buckets (for summary metrics) */
  ageBuckets?: number;
}

/**
 * AWS CloudWatch exporter configuration
 */
export interface AwsExporterConfig {
  /** AWS region */
  region: string;

  /** CloudWatch namespace */
  namespace: string;

  /** Batch size for metrics */
  batchSize?: number;

  /** Flush interval in milliseconds */
  flushInterval?: number;

  /** CloudWatch endpoint URL (optional) */
  endpoint?: string;

  /** AWS credentials (optional, uses default credential chain if not provided) */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}

/**
 * Metric labels type
 */
export type MetricLabels = Record<string, string>;

/**
 * Metric data for export
 */
export interface MetricExportData {
  /** Metric name */
  name: string;

  /** Metric value */
  value: number;

  /** Metric labels */
  labels?: MetricLabels;

  /** Metric timestamp */
  timestamp?: Date;
}

/**
 * HTTP request metrics data
 */
export interface HttpRequestMetrics {
  /** Request method */
  method: string;

  /** Request route */
  route: string;

  /** Response status code */
  statusCode: number;

  /** Request duration in milliseconds */
  duration: number;

  /** Response size in bytes */
  responseSize?: number;

  /** Additional labels */
  labels?: MetricLabels;
}

/**
 * Plugin context with metrics methods
 */
export interface FastifyPrometheusContext {
  /** Get metrics in Prometheus format */
  getMetrics(): Promise<string>;

  /** Clear all metrics */
  clearMetrics(): void;

  /** Increment a counter metric */
  incrementCounter(name: string, labels?: MetricLabels, value?: number): void;

  /** Set a gauge metric */
  setGauge(name: string, value: number, labels?: MetricLabels): void;

  /** Observe a histogram metric */
  observeHistogram(name: string, value: number, labels?: MetricLabels): void;

  /** Observe a summary metric */
  observeSummary(name: string, value: number, labels?: MetricLabels): void;

  /** Record HTTP request metrics */
  recordHttpRequest(metrics: HttpRequestMetrics): void;
}
