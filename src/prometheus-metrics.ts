/**
 * Main Prometheus metrics class
 */

import { register, collectDefaultMetrics, Registry } from 'prom-client';

import type { Counter, Gauge, Histogram, Summary } from './interfaces';
import { MetricsCollector } from './metrics-collector';
import type { PrometheusConfig, MetricConfig, MetricLabels } from './types';

/**
 * PrometheusMetrics class for managing Prometheus metrics collection
 */
export class PrometheusMetrics {
  private readonly registry: Registry;
  private readonly collector: MetricsCollector;
  private readonly config: Required<PrometheusConfig>;

  /**
   * Create a new PrometheusMetrics instance
   * @param config - Configuration options
   */
  constructor(config: PrometheusConfig = {}) {
    this.config = {
      defaultLabels: {},
      prefix: '',
      register: true,
      collectDefaultMetrics: true,
      timeout: 5000,
      ...config,
    };

    this.registry = this.config.register ? register : new Registry();
    this.collector = new MetricsCollector(this.registry);

    if (this.config.collectDefaultMetrics) {
      collectDefaultMetrics({
        register: this.registry,
        prefix: this.config.prefix,
        labels: this.config.defaultLabels,
      });
    }

    // Set default labels if provided
    if (Object.keys(this.config.defaultLabels).length > 0) {
      this.registry.setDefaultLabels(this.config.defaultLabels);
    }
  }

  /**
   * Create a counter metric
   * @param config - Metric configuration
   * @returns Counter instance
   */
  public createCounter(config: MetricConfig): Counter {
    if (config.type !== 'counter') {
      throw new Error('Metric type must be "counter"');
    }
    return this.collector.createCounter(config);
  }

  /**
   * Create a gauge metric
   * @param config - Metric configuration
   * @returns Gauge instance
   */
  public createGauge(config: MetricConfig): Gauge {
    if (config.type !== 'gauge') {
      throw new Error('Metric type must be "gauge"');
    }
    return this.collector.createGauge(config);
  }

  /**
   * Create a histogram metric
   * @param config - Metric configuration
   * @returns Histogram instance
   */
  public createHistogram(config: MetricConfig): Histogram {
    if (config.type !== 'histogram') {
      throw new Error('Metric type must be "histogram"');
    }
    return this.collector.createHistogram(config);
  }

  /**
   * Create a summary metric
   * @param config - Metric configuration
   * @returns Summary instance
   */
  public createSummary(config: MetricConfig): Summary {
    if (config.type !== 'summary') {
      throw new Error('Metric type must be "summary"');
    }
    return this.collector.createSummary(config);
  }

  /**
   * Get metrics in Prometheus format
   * @returns Promise resolving to metrics string
   */
  public async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get metrics as JSON
   * @returns Promise resolving to metrics JSON
   */
  public async getMetricsAsJSON(): Promise<unknown> {
    return this.registry.getMetricsAsJSON();
  }

  /**
   * Clear all metrics
   */
  public clear(): void {
    this.registry.clear();
  }

  /**
   * Get the registry instance
   * @returns The Prometheus registry
   */
  public getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Register a custom metric
   * @param metric - The metric to register
   */
  public register(metric: Counter | Gauge | Histogram | Summary): void {
    this.registry.registerMetric(metric as never);
  }

  /**
   * Remove a metric from the registry
   * @param metric - The metric to remove
   */
  public unregister(metric: Counter | Gauge | Histogram | Summary): void {
    this.registry.removeSingleMetric(metric.name);
  }

  /**
   * Set default labels for all metrics
   * @param labels - Default labels to set
   */
  public setDefaultLabels(labels: MetricLabels): void {
    this.registry.setDefaultLabels(labels);
  }

  /**
   * Reset all metrics to their initial values
   */
  public resetMetrics(): void {
    this.registry.resetMetrics();
  }
}
