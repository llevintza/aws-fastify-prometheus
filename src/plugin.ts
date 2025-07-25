/**
 * Fastify Prometheus Metrics Plugin
 */

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { register, collectDefaultMetrics, Counter, Gauge, Histogram, Summary } from 'prom-client';

import { AwsMetricsExporter } from './aws-metrics-exporter';
import type {
  FastifyPrometheusOptions,
  HttpRequestMetrics,
  MetricLabels,
  CustomMetricDefinition,
  HttpMetricsConfig,
  FastifyPrometheusContext,
} from './types';

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

  // Store metrics instances
  const metrics = new Map<string, Counter | Gauge | Histogram | Summary>();
  let awsExporter: AwsMetricsExporter | undefined;

  // Initialize AWS CloudWatch exporter if configured
  if (config.awsCloudWatch) {
    awsExporter = new AwsMetricsExporter(config.awsCloudWatch);
  }

  // Set default labels
  if (config.defaultLabels && Object.keys(config.defaultLabels).length > 0) {
    metricsRegistry.setDefaultLabels(config.defaultLabels);
  }

  // Enable default metrics collection
  if (config.enableDefaultMetrics === true) {
    collectDefaultMetrics({
      register: metricsRegistry,
    });
  }

  // Initialize HTTP metrics
  if (config.httpMetrics) {
    initializeHttpMetrics(config.httpMetrics, metrics, metricsRegistry);
  }

  // Initialize custom metrics
  if (config.customMetrics && config.customMetrics.length > 0) {
    initializeCustomMetrics(config.customMetrics, metrics, metricsRegistry);
  }

  // Add metrics endpoint
  if (typeof config.endpoint === 'string' && config.endpoint.length > 0) {
    fastify.route({
      method: 'GET',
      url: config.endpoint,
      handler: async (_request: FastifyRequest, reply: FastifyReply) => {
        void reply.type('text/plain');
        return metricsRegistry.metrics();
      },
    });
  }

  // Add request tracking hooks
  void fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.startTime = Date.now();

    return Promise.resolve();
  });

  void fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const route = request.routerPath ?? request.url;

    // Skip excluded routes
    if (
      config.excludeRoutes &&
      config.excludeRoutes.length > 0 &&
      config.excludeRoutes.some(excludedRoute => route.includes(excludedRoute))
    ) {
      return;
    }

    // Skip if only specific routes are included and this route is not included
    if (
      config.includeRoutes &&
      config.includeRoutes.length > 0 &&
      !config.includeRoutes.some(includedRoute => route.includes(includedRoute))
    ) {
      return;
    }

    const duration = typeof request.startTime === 'number' ? Date.now() - request.startTime : 0;
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
      recordHttpMetrics(metricsData, config.httpMetrics, metrics, awsExporter);
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
        if (labels && Object.keys(labels).length > 0) {
          metric.inc(labels, value);
        } else {
          metric.inc(value);
        }

        if (awsExporter !== undefined) {
          awsExporter.exportMetric(name, value, labels);
        }
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

        if (awsExporter !== undefined) {
          awsExporter.exportMetric(name, value, labels);
        }
      }
    },

    observeHistogram(name: string, value: number, labels?: MetricLabels): void {
      const metric = metrics.get(name) as Histogram;
      if (metric !== undefined) {
        if (labels && Object.keys(labels).length > 0) {
          metric.observe(labels, value);
        } else {
          metric.observe(value);
        }

        if (awsExporter !== undefined) {
          awsExporter.exportMetric(name, value, labels);
        }
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

        if (awsExporter !== undefined) {
          awsExporter.exportMetric(name, value, labels);
        }
      }
    },

    recordHttpRequest(httpMetrics: HttpRequestMetrics): void {
      if (config.httpMetrics) {
        recordHttpMetrics(httpMetrics, config.httpMetrics, metrics, awsExporter);
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
  registry: typeof register
): void {
  if (
    config.requestDuration?.enabled === true &&
    typeof config.requestDuration.name === 'string' &&
    config.requestDuration.name.length > 0 &&
    typeof config.requestDuration.help === 'string' &&
    config.requestDuration.help.length > 0
  ) {
    const metric = new Histogram({
      name: config.requestDuration.name,
      help: config.requestDuration.help,
      labelNames: config.requestDuration.labels ?? [],
      buckets: config.requestDuration.buckets ?? [0.1, 0.5, 1, 2, 5, 10],
      registers: [registry],
    });
    metrics.set(config.requestDuration.name, metric);
  }

  if (
    config.requestCount?.enabled === true &&
    typeof config.requestCount.name === 'string' &&
    config.requestCount.name.length > 0 &&
    typeof config.requestCount.help === 'string' &&
    config.requestCount.help.length > 0
  ) {
    const metric = new Counter({
      name: config.requestCount.name,
      help: config.requestCount.help,
      labelNames: config.requestCount.labels ?? [],
      registers: [registry],
    });
    metrics.set(config.requestCount.name, metric);
  }

  if (
    config.responseSize?.enabled === true &&
    typeof config.responseSize.name === 'string' &&
    config.responseSize.name.length > 0 &&
    typeof config.responseSize.help === 'string' &&
    config.responseSize.help.length > 0
  ) {
    const metric = new Histogram({
      name: config.responseSize.name,
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
      name: config.errorCount.name,
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
      name: config.successCount.name,
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
  registry: typeof register
): void {
  for (const metricDef of customMetrics) {
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
            name: metricDef.name,
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
            name: metricDef.name,
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
            name: metricDef.name,
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
            name: metricDef.name,
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
 * Record HTTP metrics
 */
function recordHttpMetrics(
  requestMetrics: HttpRequestMetrics,
  config: HttpMetricsConfig,
  metrics: Map<string, Counter | Gauge | Histogram | Summary>,
  awsExporter?: AwsMetricsExporter
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
      if (requestMetrics.labels && Object.keys(requestMetrics.labels).length > 0) {
        metric.observe(requestMetrics.labels, requestMetrics.duration);
      } else {
        metric.observe(requestMetrics.duration);
      }
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
      if (requestMetrics.labels && Object.keys(requestMetrics.labels).length > 0) {
        metric.inc(requestMetrics.labels);
      } else {
        metric.inc();
      }
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
  if (awsExporter !== undefined) {
    if (
      config.requestDuration?.enabled === true &&
      typeof config.requestDuration.name === 'string' &&
      config.requestDuration.name.length > 0
    ) {
      awsExporter.exportMetric(
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
      awsExporter.exportMetric(config.requestCount.name, 1, requestMetrics.labels);
    }

    if (
      config.responseSize?.enabled === true &&
      typeof config.responseSize.name === 'string' &&
      config.responseSize.name.length > 0 &&
      typeof requestMetrics.responseSize === 'number' &&
      requestMetrics.responseSize > 0
    ) {
      awsExporter.exportMetric(
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
      awsExporter.exportMetric(config.errorCount.name, 1, requestMetrics.labels);
    }

    if (
      config.successCount?.enabled === true &&
      typeof config.successCount.name === 'string' &&
      config.successCount.name.length > 0 &&
      isSuccess
    ) {
      awsExporter.exportMetric(config.successCount.name, 1, requestMetrics.labels);
    }
  }
}

// Extend FastifyRequest interface to include startTime
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }

  interface FastifyInstance {
    prometheus: FastifyPrometheusContext;
  }
}

export default fp(fastifyPrometheusPlugin, {
  fastify: '4.x',
  name: 'fastify-prometheus-metrics',
});
