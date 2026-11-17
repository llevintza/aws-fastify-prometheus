/**
 * Type definitions for the Fastify Prometheus metrics plugin
 */

import type { FastifyPluginOptions, FastifyRequest } from 'fastify';
import type { register } from 'prom-client';

/**
 * Prometheus metrics configuration interface
 */
export interface PrometheusConfig {
  /** Default labels to apply to all metrics */
  defaultLabels?: Record<string, string>;
  /** Prefix for metric names */
  prefix?: string;
  /** Whether to use global registry */
  register?: boolean;
  /** Whether to collect default metrics */
  collectDefaultMetrics?: boolean;
  /** Timeout for default metrics collection */
  timeout?: number;
}

/**
 * Metric configuration interface
 */
export interface MetricConfig {
  /** Metric type */
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  /** Metric name */
  name: string;
  /** Metric help text */
  help: string;
  /** Label names */
  labelNames?: string[];
  /** Additional configuration for histogram/summary */
  buckets?: number[];
  percentiles?: number[];
  maxAgeSeconds?: number;
  ageBuckets?: number;
}

/**
 * Collector options interface
 */
export interface CollectorOptions {
  /** Prefix for metric names */
  prefix?: string;
  /** Default labels */
  defaultLabels?: Record<string, string>;
  /** Filters for metric collection */
  filters?: Array<(metricName: string) => boolean>;
  /** Whether metrics collection is enabled */
  enabled?: boolean;
  /** Collection interval in milliseconds */
  interval?: number;
  /** Additional labels */
  labels?: Record<string, string>;
}

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
  excludeRoutes?: RouteMatcher[];

  /** Include only specific routes in metrics collection */
  includeRoutes?: RouteMatcher[];

  /**
   * How string entries in `excludeRoutes` / `includeRoutes` are matched.
   * Defaults to `'substring'`.
   */
  routeMatch?: RouteMatchMode;

  /**
   * Label used for the `route` label when a request matched no registered route
   * (for example a 404). When unset, the raw request URL is used.
   */
  unmatchedRouteLabel?: string;

  /** Custom labels to add to all metrics */
  defaultLabels?: Record<string, string>;

  /**
   * Serve `/metrics` in OpenMetrics format instead of Prometheus text format 0.0.4.
   * Switches the content type of the registry in use (the global one unless `register` is set).
   */
  openMetrics?: boolean;

  /**
   * Attach tracing exemplars to the request-duration histogram and request-count counter.
   * `true` reads `trace_id`/`span_id` from the active OpenTelemetry span (via the optional
   * `@opentelemetry/api` peer dependency); a function supplies the exemplar labels itself.
   * Requires `openMetrics: true`.
   */
  exemplars?: boolean | ExemplarExtractor;

  /**
   * Prefix prepended verbatim to the HTTP and custom metric names registered by the plugin
   * (for example `'myapp_'`). Context methods such as `incrementCounter` still take the
   * unprefixed name. Default: no prefix.
   */
  prefix?: string;
}

/**
 * A route filter entry: a string (matched per `routeMatch`), a RegExp, or a predicate
 */
export type RouteMatcher = string | RegExp | ((route: string) => boolean);

/**
 * How string route matchers are compared with the route label
 */
export type RouteMatchMode = 'substring' | 'exact';

/**
 * Route filter settings consumed by `shouldRecord`
 */
export interface RouteFilterConfig {
  /** Routes to skip */
  excludeRoutes?: RouteMatcher[];

  /** When non-empty, only matching routes are recorded */
  includeRoutes?: RouteMatcher[];

  /** String matching mode (default `'substring'`) */
  routeMatch?: RouteMatchMode;
}

/**
 * Exemplar labels attached to an observation (for example `trace_id` and `span_id`)
 */
export type ExemplarLabels = Record<string, string>;

/**
 * Returns the exemplar labels for a request, or `undefined` to record no exemplar
 */
export type ExemplarExtractor = (request: FastifyRequest) => ExemplarLabels | undefined;

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

  /** Enable the in-flight requests gauge (off by default) */
  inFlight?: InFlightConfig;
}

/**
 * In-flight requests gauge configuration. The gauge has a single `method` label.
 */
export interface InFlightConfig {
  /** Enable this metric (default: false) */
  enabled?: boolean;

  /** Metric name (default: `http_requests_in_flight`) */
  name?: string;

  /** Metric help text */
  help?: string;
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
