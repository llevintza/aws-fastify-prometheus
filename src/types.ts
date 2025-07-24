/**
 * Type definitions for the aws-node-prometheus library
 */

/**
 * Supported metric types in Prometheus
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Labels for Prometheus metrics
 */
export interface MetricLabels {
  readonly [key: string]: string;
}

/**
 * Configuration for a single metric
 */
export interface MetricConfig {
  readonly name: string;
  readonly help: string;
  readonly type: MetricType;
  readonly labelNames?: readonly string[];
  readonly buckets?: readonly number[];
  readonly percentiles?: readonly number[];
  readonly maxAgeSeconds?: number;
  readonly ageBuckets?: number;
}

/**
 * Configuration for Prometheus metrics collection
 */
export interface PrometheusConfig {
  readonly defaultLabels?: MetricLabels;
  readonly prefix?: string;
  readonly register?: boolean;
  readonly collectDefaultMetrics?: boolean;
  readonly timeout?: number;
}

/**
 * Configuration for AWS metrics exporter
 */
export interface AwsExporterConfig {
  readonly region?: string;
  readonly namespace: string;
  readonly credentials?: {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly sessionToken?: string;
  };
  readonly endpoint?: string;
  readonly batchSize?: number;
  readonly flushInterval?: number;
}

/**
 * Options for metrics collector
 */
export interface CollectorOptions {
  readonly enabled?: boolean;
  readonly interval?: number;
  readonly labels?: MetricLabels;
  readonly filters?: readonly string[];
}
