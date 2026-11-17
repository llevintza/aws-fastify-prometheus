/**
 * Fastify Prometheus Metrics Plugin
 */

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import {
  register,
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
  Summary,
} from 'prom-client';
import type { DefaultMetricsCollectorConfiguration, RegistryContentType } from 'prom-client';

import { AwsMetricsExporter } from './aws-metrics-exporter';
import { resolveExemplarExtractor, safeExtractExemplar } from './exemplars';
import { elapsedMs, prefixMetricName } from './metric-utils';
import { shouldRecord } from './route-filter';
import type {
  FastifyPrometheusOptions,
  HttpRequestMetrics,
  MetricLabels,
  CustomMetricDefinition,
  HttpMetricsConfig,
  FastifyPrometheusContext,
  ExemplarLabels,
  InFlightConfig,
} from './types';

const DEFAULT_IN_FLIGHT_NAME = 'http_requests_in_flight';
const DEFAULT_IN_FLIGHT_HELP = 'Number of HTTP requests currently being processed';

/**
 * Default configuration for HTTP metrics
 */
const DEFAULT_HTTP_METRICS: Required<HttpMetricsConfig> = {
  requestDuration: {
    enabled: true,
    name: 'http_request_duration_ms',
    help: 'Duration of HTTP requests in milliseconds',
    buckets: [0.1, 5, 15, 50, 100, 200, 300, 400, 500, 1000, 2000, 5000],
    labels: ['method', 'route', 'status_code'],
  },
  requestCount: {
    enabled: true,
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labels: ['method', 'route', 'status_code'],
  },
  responseSize: {
    enabled: true,
    name: 'http_response_size_bytes',
    help: 'Size of HTTP responses in bytes',
    buckets: [1, 100, 1000, 10000, 100000, 1000000],
    labels: ['method', 'route', 'status_code'],
  },
  errorCount: {
    enabled: true,
    name: 'http_errors_total',
    help: 'Total number of HTTP errors',
    labels: ['method', 'route', 'status_code'],
  },
  successCount: {
    enabled: true,
    name: 'http_success_total',
    help: 'Total number of successful HTTP requests',
    labels: ['method', 'route', 'status_code'],
  },
  inFlight: {
    enabled: false,
    name: DEFAULT_IN_FLIGHT_NAME,
    help: DEFAULT_IN_FLIGHT_HELP,
  },
};

/**
 * Default plugin options
 */
const DEFAULT_OPTIONS: Partial<FastifyPrometheusOptions> = {
  endpoint: '/metrics',
  enableDefaultMetrics: true,
  defaultMetricsInterval: 10000,
  httpMetrics: DEFAULT_HTTP_METRICS,
  excludeRoutes: ['/health', '/healthcheck'],
  defaultLabels: {},
};

/**
 * Fastify Prometheus Metrics Plugin
 */
const fastifyPrometheusPlugin: FastifyPluginAsync<FastifyPrometheusOptions> = async (
  fastify: FastifyInstance,
  options: FastifyPrometheusOptions
) => {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const metricsRegistry = config.register ?? register;

  // Validate exemplar options first so a misconfiguration fails before anything is registered
  const exemplarExtractor = resolveExemplarExtractor(config);

  // Must run before any metric is created: prom-client only allows exemplars on metrics whose
  // registries are already OpenMetrics registries
  if (config.openMetrics === true) {
    (metricsRegistry as Registry<RegistryContentType>).setContentType(
      Registry.OPENMETRICS_CONTENT_TYPE
    );
  }

  // Store metrics instances
  const metrics = new Map<string, Counter | Gauge | Histogram | Summary>();
  // Names of metrics created with `enableExemplars` (they only accept the object call form)
  const exemplarMetrics = new Set<string>();
  // Exemplars captured in onRequest, while the request's trace span is still active
  const requestExemplars = new WeakMap<FastifyRequest, ExemplarLabels>();
  let awsExporter: AwsMetricsExporter | undefined;

  // Initialize AWS CloudWatch exporter if configured
  if (config.awsCloudWatch) {
    awsExporter = new AwsMetricsExporter(config.awsCloudWatch);
  }
  // Sink every CloudWatch export goes through; applies the prefix only when opted in
  const cloudWatch = createCloudWatchSink(
    awsExporter,
    config.awsCloudWatch?.applyPrefix === true ? config.prefix : undefined
  );

  // Set default labels
  if (config.defaultLabels && Object.keys(config.defaultLabels).length > 0) {
    metricsRegistry.setDefaultLabels(config.defaultLabels);
  }

  // Enable default metrics collection
  if (config.enableDefaultMetrics === true) {
    const defaultMetricsOptions: DefaultMetricsCollectorConfiguration<RegistryContentType> = {
      register: metricsRegistry,
    };
    // Opt-in: prefix the Node.js default metrics (process_*, nodejs_*) as well
    if (config.prefixDefaultMetrics === true && config.prefix !== undefined) {
      defaultMetricsOptions.prefix = config.prefix;
    }
    collectDefaultMetrics(defaultMetricsOptions);
  }

  // Initialize HTTP metrics
  if (config.httpMetrics) {
    initializeHttpMetrics(
      config.httpMetrics,
      metrics,
      metricsRegistry,
      config.prefix,
      exemplarExtractor !== undefined ? exemplarMetrics : undefined
    );
  }

  // Initialize custom metrics
  if (config.customMetrics && config.customMetrics.length > 0) {
    initializeCustomMetrics(config.customMetrics, metrics, metricsRegistry, config.prefix);
  }

  // Initialize the opt-in in-flight requests gauge
  const inFlightGauge = createInFlightGauge(
    config.httpMetrics?.inFlight,
    metricsRegistry,
    config.prefix
  );
  // Requests that incremented the gauge; deleting on decrement prevents double-decrements
  const inFlightRequests = new WeakSet<FastifyRequest>();

  // Same filter as the HTTP metrics in onResponse: per-route opt-out, then include/exclude.
  const isRouteRecorded = (request: FastifyRequest): boolean =>
    request.routeOptions.config?.metrics !== false &&
    shouldRecord(request.routeOptions.url ?? request.url, config);

  const decrementInFlight = (request: FastifyRequest): void => {
    if (inFlightGauge !== undefined && inFlightRequests.delete(request)) {
      inFlightGauge.dec({ method: request.method });
    }
  };

  // Add metrics endpoint
  if (typeof config.endpoint === 'string' && config.endpoint.length > 0) {
    fastify.route({
      method: 'GET',
      url: config.endpoint,
      handler: async (_request: FastifyRequest, reply: FastifyReply) => {
        void reply.type(metricsRegistry.contentType);
        return metricsRegistry.metrics();
      },
    });
  }

  // Add request tracking hooks
  void fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.startTime = process.hrtime.bigint();

    const recorded = isRouteRecorded(request);

    if (inFlightGauge !== undefined && recorded) {
      inFlightGauge.inc({ method: request.method });
      inFlightRequests.add(request);
    }

    if (exemplarExtractor !== undefined && recorded) {
      const exemplarLabels = safeExtractExemplar(exemplarExtractor, request);
      if (exemplarLabels !== undefined) {
        requestExemplars.set(request, exemplarLabels);
      }
    }

    return Promise.resolve();
  });

  if (inFlightGauge !== undefined) {
    // Aborted requests may never reach onResponse; decrement here so the gauge can't leak.
    // Older Fastify 4.x minors don't know this hook and throw from addHook; there the gauge
    // is decremented in onResponse only.
    try {
      void fastify.addHook('onRequestAbort', async (request: FastifyRequest) => {
        decrementInFlight(request);
        return Promise.resolve();
      });
    } catch (error) {
      fastify.log.warn(
        { err: error },
        'onRequestAbort hook unsupported by this Fastify version; in-flight gauge relies on onResponse'
      );
    }
  }

  void fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    decrementInFlight(request);

    if (!isRouteRecorded(request)) {
      return;
    }

    // Decide record/skip on the matched pattern or the raw URL, then pick the emitted label.
    const matchedRoute = request.routeOptions.url;
    const route =
      matchedRoute ??
      (typeof config.unmatchedRouteLabel === 'string' ? config.unmatchedRouteLabel : request.url);

    const duration = typeof request.startTime === 'bigint' ? elapsedMs(request.startTime) : 0;
    const labels = {
      method: request.method,
      route,
      status_code: reply.statusCode.toString(),
    };

    // Record HTTP metrics
    const contentLength = reply.getHeader('content-length');
    const responseSize =
      typeof contentLength === 'string'
        ? parseInt(contentLength, 10)
        : typeof contentLength === 'number'
          ? contentLength
          : undefined;

    const metricsData: HttpRequestMetrics = {
      method: request.method,
      route,
      statusCode: reply.statusCode,
      duration,
      labels,
    };

    if (responseSize !== undefined) {
      metricsData.responseSize = responseSize;
    }

    if (config.httpMetrics) {
      // Prefer the onRequest snapshot: tracing instrumentations may end or detach the span before
      // onResponse runs. Fall back to extracting now (e.g. labels set by the route handler).
      const exemplarLabels =
        requestExemplars.get(request) ??
        (exemplarExtractor !== undefined
          ? safeExtractExemplar(exemplarExtractor, request)
          : undefined);
      recordHttpMetrics(
        metricsData,
        config.httpMetrics,
        metrics,
        cloudWatch,
        exemplarMetrics,
        exemplarLabels
      );
    }
  });

  // Add plugin context methods
  const context: FastifyPrometheusContext = {
    async getMetrics(): Promise<string> {
      return metricsRegistry.metrics();
    },

    clearMetrics(): void {
      metricsRegistry.clear();
    },

    incrementCounter(name: string, labels?: MetricLabels, value = 1): void {
      const metric = metrics.get(name) as Counter;
      if (metric !== undefined) {
        incrementCounterMetric(metric, exemplarMetrics.has(name), labels, value);

        cloudWatch?.exportMetric(name, value, labels);
      }
    },

    setGauge(name: string, value: number, labels?: MetricLabels): void {
      const metric = metrics.get(name) as Gauge;
      if (metric !== undefined) {
        if (labels && Object.keys(labels).length > 0) {
          metric.set(labels, value);
        } else {
          metric.set(value);
        }

        cloudWatch?.exportMetric(name, value, labels);
      }
    },

    observeHistogram(name: string, value: number, labels?: MetricLabels): void {
      const metric = metrics.get(name) as Histogram;
      if (metric !== undefined) {
        observeHistogramMetric(metric, exemplarMetrics.has(name), value, labels);

        cloudWatch?.exportMetric(name, value, labels);
      }
    },

    observeSummary(name: string, value: number, labels?: MetricLabels): void {
      const metric = metrics.get(name) as Summary;
      if (metric !== undefined) {
        if (labels && Object.keys(labels).length > 0) {
          metric.observe(labels, value);
        } else {
          metric.observe(value);
        }

        cloudWatch?.exportMetric(name, value, labels);
      }
    },

    recordHttpRequest(httpMetrics: HttpRequestMetrics): void {
      if (config.httpMetrics) {
        recordHttpMetrics(httpMetrics, config.httpMetrics, metrics, cloudWatch, exemplarMetrics);
      }
    },
  };

  // Decorate fastify instance with metrics context
  fastify.decorate('prometheus', context);

  // Cleanup on close
  void fastify.addHook('onClose', async () => {
    if (awsExporter) {
      await awsExporter.flush();
      awsExporter.stop();
    }
  });

  // Wait for plugin initialization to complete
  await Promise.resolve();
};

/**
 * Initialize HTTP metrics
 */
function initializeHttpMetrics(
  config: HttpMetricsConfig,
  metrics: Map<string, Counter | Gauge | Histogram | Summary>,
  registry: typeof register,
  prefix?: string,
  exemplarMetrics?: Set<string>
): void {
  const enableExemplars = exemplarMetrics !== undefined;

  if (
    config.requestDuration?.enabled === true &&
    typeof config.requestDuration.name === 'string' &&
    config.requestDuration.name.length > 0 &&
    typeof config.requestDuration.help === 'string' &&
    config.requestDuration.help.length > 0
  ) {
    const metric = new Histogram({
      name: prefixMetricName(config.requestDuration.name, prefix),
      help: config.requestDuration.help,
      labelNames: config.requestDuration.labels ?? [],
      buckets: config.requestDuration.buckets ?? [0.1, 0.5, 1, 2, 5, 10],
      registers: [registry],
      enableExemplars,
    });
    metrics.set(config.requestDuration.name, metric);
    if (enableExemplars) {
      exemplarMetrics.add(config.requestDuration.name);
    }
  }

  if (
    config.requestCount?.enabled === true &&
    typeof config.requestCount.name === 'string' &&
    config.requestCount.name.length > 0 &&
    typeof config.requestCount.help === 'string' &&
    config.requestCount.help.length > 0
  ) {
    const metric = new Counter({
      name: prefixMetricName(config.requestCount.name, prefix),
      help: config.requestCount.help,
      labelNames: config.requestCount.labels ?? [],
      registers: [registry],
      enableExemplars,
    });
    metrics.set(config.requestCount.name, metric);
    if (enableExemplars) {
      exemplarMetrics.add(config.requestCount.name);
    }
  }

  if (
    config.responseSize?.enabled === true &&
    typeof config.responseSize.name === 'string' &&
    config.responseSize.name.length > 0 &&
    typeof config.responseSize.help === 'string' &&
    config.responseSize.help.length > 0
  ) {
    const metric = new Histogram({
      name: prefixMetricName(config.responseSize.name, prefix),
      help: config.responseSize.help,
      labelNames: config.responseSize.labels ?? [],
      buckets: config.responseSize.buckets ?? [10, 100, 1000, 10000, 100000],
      registers: [registry],
    });
    metrics.set(config.responseSize.name, metric);
  }

  if (
    config.errorCount?.enabled === true &&
    typeof config.errorCount.name === 'string' &&
    config.errorCount.name.length > 0 &&
    typeof config.errorCount.help === 'string' &&
    config.errorCount.help.length > 0
  ) {
    const metric = new Counter({
      name: prefixMetricName(config.errorCount.name, prefix),
      help: config.errorCount.help,
      labelNames: config.errorCount.labels ?? [],
      registers: [registry],
    });
    metrics.set(config.errorCount.name, metric);
  }

  if (
    config.successCount?.enabled === true &&
    typeof config.successCount.name === 'string' &&
    config.successCount.name.length > 0 &&
    typeof config.successCount.help === 'string' &&
    config.successCount.help.length > 0
  ) {
    const metric = new Counter({
      name: prefixMetricName(config.successCount.name, prefix),
      help: config.successCount.help,
      labelNames: config.successCount.labels ?? [],
      registers: [registry],
    });
    metrics.set(config.successCount.name, metric);
  }
}

/**
 * Initialize custom metrics
 */
function initializeCustomMetrics(
  customMetrics: CustomMetricDefinition[],
  metrics: Map<string, Counter | Gauge | Histogram | Summary>,
  registry: typeof register,
  prefix?: string
): void {
  for (const metricDef of customMetrics) {
    const name = prefixMetricName(metricDef.name, prefix);
    let metric: Counter | Gauge | Histogram | Summary;

    switch (metricDef.type) {
      case 'counter':
        {
          interface CounterConfig {
            name: string;
            help: string;
            registers: (typeof register)[];
            labelNames?: string[];
          }
          const config: CounterConfig = {
            name,
            help: metricDef.help,
            registers: [registry],
          };
          if (metricDef.labels && metricDef.labels.length > 0) {
            config.labelNames = metricDef.labels;
          }
          metric = new Counter(config);
        }
        break;

      case 'gauge':
        {
          interface GaugeConfig {
            name: string;
            help: string;
            registers: (typeof register)[];
            labelNames?: string[];
          }
          const config: GaugeConfig = {
            name,
            help: metricDef.help,
            registers: [registry],
          };
          if (metricDef.labels && metricDef.labels.length > 0) {
            config.labelNames = metricDef.labels;
          }
          metric = new Gauge(config);
        }
        break;

      case 'histogram':
        {
          interface HistogramConfig {
            name: string;
            help: string;
            registers: (typeof register)[];
            labelNames?: string[];
            buckets?: number[];
          }
          const config: HistogramConfig = {
            name,
            help: metricDef.help,
            registers: [registry],
          };
          if (metricDef.labels && metricDef.labels.length > 0) {
            config.labelNames = metricDef.labels;
          }
          if (metricDef.config?.buckets && metricDef.config.buckets.length > 0) {
            config.buckets = metricDef.config.buckets;
          }
          metric = new Histogram(config);
        }
        break;

      case 'summary':
        {
          interface SummaryConfig {
            name: string;
            help: string;
            registers: (typeof register)[];
            labelNames?: string[];
            percentiles?: number[];
            maxAgeSeconds?: number;
            ageBuckets?: number;
          }
          const config: SummaryConfig = {
            name,
            help: metricDef.help,
            registers: [registry],
          };
          if (metricDef.labels && metricDef.labels.length > 0) {
            config.labelNames = metricDef.labels;
          }
          if (metricDef.config?.percentiles && metricDef.config.percentiles.length > 0) {
            config.percentiles = metricDef.config.percentiles;
          }
          if (
            typeof metricDef.config?.maxAgeSeconds === 'number' &&
            metricDef.config.maxAgeSeconds > 0
          ) {
            config.maxAgeSeconds = metricDef.config.maxAgeSeconds;
          }
          if (typeof metricDef.config?.ageBuckets === 'number' && metricDef.config.ageBuckets > 0) {
            config.ageBuckets = metricDef.config.ageBuckets;
          }
          metric = new Summary(config);
        }
        break;

      default:
        continue;
    }

    metrics.set(metricDef.name, metric);
  }
}

/**
 * Create the in-flight requests gauge when enabled. Unset name/help fall back to defaults.
 */
function createInFlightGauge(
  config: InFlightConfig | undefined,
  registry: typeof register,
  prefix?: string
): Gauge<'method'> | undefined {
  if (config?.enabled !== true) {
    return undefined;
  }

  const name =
    typeof config.name === 'string' && config.name.length > 0
      ? config.name
      : DEFAULT_IN_FLIGHT_NAME;
  const help =
    typeof config.help === 'string' && config.help.length > 0
      ? config.help
      : DEFAULT_IN_FLIGHT_HELP;

  return new Gauge({
    name: prefixMetricName(name, prefix),
    help,
    labelNames: ['method'],
    registers: [registry],
  });
}

/**
 * The CloudWatch export surface the plugin records into
 */
type CloudWatchSink = Pick<AwsMetricsExporter, 'exportMetric'>;

/**
 * Wrap the exporter so every exported metric name gets `prefix` (none when unset/empty).
 * Returns `undefined` when CloudWatch export is not configured.
 */
function createCloudWatchSink(
  exporter: AwsMetricsExporter | undefined,
  prefix: string | undefined
): CloudWatchSink | undefined {
  if (exporter === undefined) {
    return undefined;
  }
  return {
    exportMetric: (name, value, labels, timestamp) =>
      exporter.exportMetric(prefixMetricName(name, prefix), value, labels, timestamp),
  };
}

/**
 * Record HTTP metrics
 */
function recordHttpMetrics(
  requestMetrics: HttpRequestMetrics,
  config: HttpMetricsConfig,
  metrics: Map<string, Counter | Gauge | Histogram | Summary>,
  cloudWatch?: CloudWatchSink,
  exemplarMetrics?: Set<string>,
  exemplarLabels?: ExemplarLabels
): void {
  const isError = requestMetrics.statusCode >= 400;
  const isSuccess = requestMetrics.statusCode >= 200 && requestMetrics.statusCode < 400;

  // Record request duration
  if (
    config.requestDuration?.enabled === true &&
    typeof config.requestDuration.name === 'string' &&
    config.requestDuration.name.length > 0
  ) {
    const metric = metrics.get(config.requestDuration.name) as Histogram;
    if (metric !== undefined) {
      observeHistogramMetric(
        metric,
        exemplarMetrics?.has(config.requestDuration.name) === true,
        requestMetrics.duration,
        requestMetrics.labels,
        exemplarLabels
      );
    }
  }

  // Record request count
  if (
    config.requestCount?.enabled === true &&
    typeof config.requestCount.name === 'string' &&
    config.requestCount.name.length > 0
  ) {
    const metric = metrics.get(config.requestCount.name) as Counter;
    if (metric !== undefined) {
      incrementCounterMetric(
        metric,
        exemplarMetrics?.has(config.requestCount.name) === true,
        requestMetrics.labels,
        1,
        exemplarLabels
      );
    }
  }

  // Record response size
  if (
    config.responseSize?.enabled === true &&
    typeof config.responseSize.name === 'string' &&
    config.responseSize.name.length > 0 &&
    typeof requestMetrics.responseSize === 'number' &&
    requestMetrics.responseSize > 0
  ) {
    const metric = metrics.get(config.responseSize.name) as Histogram;
    if (metric !== undefined) {
      if (requestMetrics.labels && Object.keys(requestMetrics.labels).length > 0) {
        metric.observe(requestMetrics.labels, requestMetrics.responseSize);
      } else {
        metric.observe(requestMetrics.responseSize);
      }
    }
  }

  // Record error count
  if (
    config.errorCount?.enabled === true &&
    typeof config.errorCount.name === 'string' &&
    config.errorCount.name.length > 0 &&
    isError
  ) {
    const metric = metrics.get(config.errorCount.name) as Counter;
    if (metric !== undefined) {
      if (requestMetrics.labels && Object.keys(requestMetrics.labels).length > 0) {
        metric.inc(requestMetrics.labels);
      } else {
        metric.inc();
      }
    }
  }

  // Record success count
  if (
    config.successCount?.enabled === true &&
    typeof config.successCount.name === 'string' &&
    config.successCount.name.length > 0 &&
    isSuccess
  ) {
    const metric = metrics.get(config.successCount.name) as Counter;
    if (metric !== undefined) {
      if (requestMetrics.labels && Object.keys(requestMetrics.labels).length > 0) {
        metric.inc(requestMetrics.labels);
      } else {
        metric.inc();
      }
    }
  }

  // Export to AWS CloudWatch
  if (cloudWatch !== undefined) {
    if (
      config.requestDuration?.enabled === true &&
      typeof config.requestDuration.name === 'string' &&
      config.requestDuration.name.length > 0
    ) {
      cloudWatch.exportMetric(
        config.requestDuration.name,
        requestMetrics.duration,
        requestMetrics.labels
      );
    }

    if (
      config.requestCount?.enabled === true &&
      typeof config.requestCount.name === 'string' &&
      config.requestCount.name.length > 0
    ) {
      cloudWatch.exportMetric(config.requestCount.name, 1, requestMetrics.labels);
    }

    if (
      config.responseSize?.enabled === true &&
      typeof config.responseSize.name === 'string' &&
      config.responseSize.name.length > 0 &&
      typeof requestMetrics.responseSize === 'number' &&
      requestMetrics.responseSize > 0
    ) {
      cloudWatch.exportMetric(
        config.responseSize.name,
        requestMetrics.responseSize,
        requestMetrics.labels
      );
    }

    if (
      config.errorCount?.enabled === true &&
      typeof config.errorCount.name === 'string' &&
      config.errorCount.name.length > 0 &&
      isError
    ) {
      cloudWatch.exportMetric(config.errorCount.name, 1, requestMetrics.labels);
    }

    if (
      config.successCount?.enabled === true &&
      typeof config.successCount.name === 'string' &&
      config.successCount.name.length > 0 &&
      isSuccess
    ) {
      cloudWatch.exportMetric(config.successCount.name, 1, requestMetrics.labels);
    }
  }
}

/**
 * Increment a counter. Exemplar-enabled counters only accept the object call form.
 */
function incrementCounterMetric(
  metric: Counter,
  withExemplars: boolean,
  labels: MetricLabels | undefined,
  value: number,
  exemplarLabels?: ExemplarLabels
): void {
  const hasLabels = labels !== undefined && Object.keys(labels).length > 0;
  if (withExemplars) {
    metric.inc({
      value,
      ...(hasLabels ? { labels } : {}),
      ...(exemplarLabels !== undefined ? { exemplarLabels } : {}),
    });
  } else if (hasLabels) {
    metric.inc(labels, value);
  } else {
    metric.inc(value);
  }
}

/**
 * Observe a histogram value. Exemplar-enabled histograms only accept the object call form.
 */
function observeHistogramMetric(
  metric: Histogram,
  withExemplars: boolean,
  value: number,
  labels: MetricLabels | undefined,
  exemplarLabels?: ExemplarLabels
): void {
  const hasLabels = labels !== undefined && Object.keys(labels).length > 0;
  if (withExemplars) {
    metric.observe({
      value,
      ...(hasLabels ? { labels } : {}),
      ...(exemplarLabels !== undefined ? { exemplarLabels } : {}),
    });
  } else if (hasLabels) {
    metric.observe(labels, value);
  } else {
    metric.observe(value);
  }
}

// Extend FastifyRequest interface to include startTime
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: bigint;
  }

  interface FastifyInstance {
    prometheus: FastifyPrometheusContext;
  }

  interface FastifyContextConfig {
    /** Set to `false` to skip HTTP metrics for this route */
    metrics?: boolean;
  }
}

export default fp(fastifyPrometheusPlugin, {
  fastify: '4.x || 5.x',
  name: 'fastify-prometheus-metrics',
});
