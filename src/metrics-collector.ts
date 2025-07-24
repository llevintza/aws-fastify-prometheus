/**
 * Metrics collector implementation
 */

import {
  Counter as PromCounter,
  Gauge as PromGauge,
  Histogram as PromHistogram,
  Summary as PromSummary,
  Registry,
} from 'prom-client';

import type { MetricConfig, MetricLabels, CollectorOptions } from './types';
import type { Counter, Gauge, Histogram, Summary } from './interfaces';

/**
 * MetricsCollector class for creating and managing metrics
 */
export class MetricsCollector {
  private readonly registry: Registry;
  private readonly options: Required<CollectorOptions>;

  /**
   * Create a new MetricsCollector instance
   * @param registry - Prometheus registry
   * @param options - Collector options
   */
  constructor(registry: Registry, options: CollectorOptions = {}) {
    this.registry = registry;
    this.options = {
      enabled: true,
      interval: 10000,
      labels: {},
      filters: [],
      ...options,
    };
  }

  /**
   * Create a counter metric
   * @param config - Metric configuration
   * @returns Counter instance
   */
  public createCounter(config: MetricConfig): Counter {
    const counter = new PromCounter({
      name: this.buildMetricName(config.name),
      help: config.help,
      labelNames: config.labelNames as string[],
      registers: [this.registry],
    });

    return counter as Counter;
  }

  /**
   * Create a gauge metric
   * @param config - Metric configuration
   * @returns Gauge instance
   */
  public createGauge(config: MetricConfig): Gauge {
    const gauge = new PromGauge({
      name: this.buildMetricName(config.name),
      help: config.help,
      labelNames: config.labelNames as string[],
      registers: [this.registry],
    });

    return gauge as Gauge;
  }

  /**
   * Create a histogram metric
   * @param config - Metric configuration
   * @returns Histogram instance
   */
  public createHistogram(config: MetricConfig): Histogram {
    const histogram = new PromHistogram({
      name: this.buildMetricName(config.name),
      help: config.help,
      labelNames: config.labelNames as string[],
      buckets: config.buckets,
      registers: [this.registry],
    });

    return histogram as Histogram;
  }

  /**
   * Create a summary metric
   * @param config - Metric configuration
   * @returns Summary instance
   */
  public createSummary(config: MetricConfig): Summary {
    const summary = new PromSummary({
      name: this.buildMetricName(config.name),
      help: config.help,
      labelNames: config.labelNames as string[],
      percentiles: config.percentiles,
      maxAgeSeconds: config.maxAgeSeconds,
      ageBuckets: config.ageBuckets,
      registers: [this.registry],
    });

    return summary as Summary;
  }

  /**
   * Check if collector is enabled
   * @returns True if enabled
   */
  public isEnabled(): boolean {
    return this.options.enabled;
  }

  /**
   * Get collector options
   * @returns Collector options
   */
  public getOptions(): Required<CollectorOptions> {
    return { ...this.options };
  }

  /**
   * Update collector options
   * @param options - New options to merge
   */
  public updateOptions(options: Partial<CollectorOptions>): void {
    Object.assign(this.options, options);
  }

  /**
   * Build metric name with prefix if configured
   * @param name - Base metric name
   * @returns Full metric name
   */
  private buildMetricName(name: string): string {
    const prefix = this.options.labels.prefix as string | undefined;
    return prefix ? `${prefix}_${name}` : name;
  }

  /**
   * Apply default labels to metric labels
   * @param labels - Metric-specific labels
   * @returns Merged labels
   */
  private applyDefaultLabels(labels: MetricLabels = {}): MetricLabels {
    return { ...this.options.labels, ...labels };
  }

  /**
   * Check if metric should be collected based on filters
   * @param metricName - Name of the metric
   * @returns True if metric should be collected
   */
  private shouldCollectMetric(metricName: string): boolean {
    if (this.options.filters.length === 0) {
      return true;
    }

    return this.options.filters.some(filter => {
      if (filter.startsWith('!')) {
        // Exclusion filter
        const pattern = filter.slice(1);
        return !metricName.includes(pattern);
      }
      // Inclusion filter
      return metricName.includes(filter);
    });
  }
}
