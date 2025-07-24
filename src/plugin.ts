/**
 * Fastify Prometheus Metrics Plugin
 */

import fp from 'fastify-plugin';
import { register, collectDefaultMetrics, Counter, Gauge, Histogram, Summary } from 'prom-client';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import type {
  FastifyPrometheusOptions,
  HttpRequestMetrics,
  MetricLabels,
  CustomMetricDefinition,
  HttpMetricsConfig,
  FastifyPrometheusContext,
} from './types';
import { AwsMetricsExporter } from './aws-metrics-exporter';

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
  const metricsRegistry = config.register || register;
  
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
  if (config.enableDefaultMetrics) {
    collectDefaultMetrics({
      register: metricsRegistry,
      timeout: config.defaultMetricsInterval,
    });
  }
  
  // Initialize HTTP metrics
  initializeHttpMetrics(config.httpMetrics!, metrics, metricsRegistry);
  
  // Initialize custom metrics
  if (config.customMetrics) {
    initializeCustomMetrics(config.customMetrics, metrics, metricsRegistry);
  }
  
  // Add metrics endpoint
  if (config.endpoint) {
    fastify.get(config.endpoint, async (request, reply) => {
      reply.type('text/plain');
      return metricsRegistry.metrics();
    });
  }
  
  // Add request tracking hooks
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.startTime = Date.now();
  });
  
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const route = request.routerPath || request.url;
    
    // Skip excluded routes
    if (config.excludeRoutes?.some(excludedRoute => route.includes(excludedRoute))) {
      return;
    }
    
    // Skip if only specific routes are included and this route is not included
    if (config.includeRoutes && !config.includeRoutes.some(includedRoute => route.includes(includedRoute))) {
      return;
    }
    
    const duration = request.startTime ? Date.now() - request.startTime : 0;
    const labels = {
      method: request.method,
      route,
      status_code: reply.statusCode.toString(),
    };
    
    // Record HTTP metrics
    recordHttpMetrics({
      method: request.method,
      route,
      statusCode: reply.statusCode,
      duration,
      responseSize: reply.getHeader('content-length') as number | undefined,
      labels,
    }, config.httpMetrics!, metrics, awsExporter);
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
      if (metric) {
        metric.inc(labels, value);
        
        if (awsExporter) {
          awsExporter.exportMetric(name, value, labels);
        }
      }
    },
    
    setGauge(name: string, value: number, labels?: MetricLabels): void {
      const metric = metrics.get(name) as Gauge;
      if (metric) {
        metric.set(labels, value);
        
        if (awsExporter) {
          awsExporter.exportMetric(name, value, labels);
        }
      }
    },
    
    observeHistogram(name: string, value: number, labels?: MetricLabels): void {
      const metric = metrics.get(name) as Histogram;
      if (metric) {
        metric.observe(labels, value);
        
        if (awsExporter) {
          awsExporter.exportMetric(name, value, labels);
        }
      }
    },
    
    observeSummary(name: string, value: number, labels?: MetricLabels): void {
      const metric = metrics.get(name) as Summary;
      if (metric) {
        metric.observe(labels, value);
        
        if (awsExporter) {
          awsExporter.exportMetric(name, value, labels);
        }
      }
    },
    
    recordHttpRequest(httpMetrics: HttpRequestMetrics): void {
      recordHttpMetrics(httpMetrics, config.httpMetrics!, metrics, awsExporter);
    },
  };
  
  // Decorate fastify instance with metrics context
  fastify.decorate('prometheus', context);
  
  // Cleanup on close
  fastify.addHook('onClose', async () => {
    if (awsExporter) {
      await awsExporter.flush();
      awsExporter.stop();
    }
  });
};

/**
 * Initialize HTTP metrics
 */
function initializeHttpMetrics(
  config: HttpMetricsConfig,
  metrics: Map<string, Counter | Gauge | Histogram | Summary>,
  registry: typeof register
): void {
  if (config.requestDuration?.enabled) {
    const metric = new Histogram({
      name: config.requestDuration.name!,
      help: config.requestDuration.help!,
      labelNames: config.requestDuration.labels!,
      buckets: config.requestDuration.buckets!,
      registers: [registry],
    });
    metrics.set(config.requestDuration.name!, metric);
  }
  
  if (config.requestCount?.enabled) {
    const metric = new Counter({
      name: config.requestCount.name!,
      help: config.requestCount.help!,
      labelNames: config.requestCount.labels!,
      registers: [registry],
    });
    metrics.set(config.requestCount.name!, metric);
  }
  
  if (config.responseSize?.enabled) {
    const metric = new Histogram({
      name: config.responseSize.name!,
      help: config.responseSize.help!,
      labelNames: config.responseSize.labels!,
      buckets: config.responseSize.buckets!,
      registers: [registry],
    });
    metrics.set(config.responseSize.name!, metric);
  }
  
  if (config.errorCount?.enabled) {
    const metric = new Counter({
      name: config.errorCount.name!,
      help: config.errorCount.help!,
      labelNames: config.errorCount.labels!,
      registers: [registry],
    });
    metrics.set(config.errorCount.name!, metric);
  }
  
  if (config.successCount?.enabled) {
    const metric = new Counter({
      name: config.successCount.name!,
      help: config.successCount.help!,
      labelNames: config.successCount.labels!,
      registers: [registry],
    });
    metrics.set(config.successCount.name!, metric);
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
        metric = new Counter({
          name: metricDef.name,
          help: metricDef.help,
          labelNames: metricDef.labels,
          registers: [registry],
        });
        break;
        
      case 'gauge':
        metric = new Gauge({
          name: metricDef.name,
          help: metricDef.help,
          labelNames: metricDef.labels,
          registers: [registry],
        });
        break;
        
      case 'histogram':
        metric = new Histogram({
          name: metricDef.name,
          help: metricDef.help,
          labelNames: metricDef.labels,
          buckets: metricDef.config?.buckets,
          registers: [registry],
        });
        break;
        
      case 'summary':
        metric = new Summary({
          name: metricDef.name,
          help: metricDef.help,
          labelNames: metricDef.labels,
          percentiles: metricDef.config?.percentiles,
          maxAgeSeconds: metricDef.config?.maxAgeSeconds,
          ageBuckets: metricDef.config?.ageBuckets,
          registers: [registry],
        });
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
  if (config.requestDuration?.enabled) {
    const metric = metrics.get(config.requestDuration.name!) as Histogram;
    if (metric) {
      metric.observe(requestMetrics.labels, requestMetrics.duration);
    }
  }
  
  // Record request count
  if (config.requestCount?.enabled) {
    const metric = metrics.get(config.requestCount.name!) as Counter;
    if (metric) {
      metric.inc(requestMetrics.labels);
    }
  }
  
  // Record response size
  if (config.responseSize?.enabled && requestMetrics.responseSize) {
    const metric = metrics.get(config.responseSize.name!) as Histogram;
    if (metric) {
      metric.observe(requestMetrics.labels, requestMetrics.responseSize);
    }
  }
  
  // Record error count
  if (config.errorCount?.enabled && isError) {
    const metric = metrics.get(config.errorCount.name!) as Counter;
    if (metric) {
      metric.inc(requestMetrics.labels);
    }
  }
  
  // Record success count
  if (config.successCount?.enabled && isSuccess) {
    const metric = metrics.get(config.successCount.name!) as Counter;
    if (metric) {
      metric.inc(requestMetrics.labels);
    }
  }
  
  // Export to AWS CloudWatch
  if (awsExporter) {
    if (config.requestDuration?.enabled) {
      awsExporter.exportMetric(config.requestDuration.name!, requestMetrics.duration, requestMetrics.labels);
    }
    
    if (config.requestCount?.enabled) {
      awsExporter.exportMetric(config.requestCount.name!, 1, requestMetrics.labels);
    }
    
    if (config.responseSize?.enabled && requestMetrics.responseSize) {
      awsExporter.exportMetric(config.responseSize.name!, requestMetrics.responseSize, requestMetrics.labels);
    }
    
    if (config.errorCount?.enabled && isError) {
      awsExporter.exportMetric(config.errorCount.name!, 1, requestMetrics.labels);
    }
    
    if (config.successCount?.enabled && isSuccess) {
      awsExporter.exportMetric(config.successCount.name!, 1, requestMetrics.labels);
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
