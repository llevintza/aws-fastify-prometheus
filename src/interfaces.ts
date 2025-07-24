/**
 * Interface definitions for Prometheus metric types
 */

import type { MetricLabels } from './types';

/**
 * Base interface for all metrics
 */
export interface BaseMetric {
  readonly name: string;
  readonly help: string;
  readonly labelNames: readonly string[];
}

/**
 * Counter metric interface
 * Counters can only increase in value
 */
export interface Counter extends BaseMetric {
  /**
   * Increment the counter by 1
   */
  inc(): void;

  /**
   * Increment the counter by the given value
   * @param value - The value to increment by (must be positive)
   */
  inc(value: number): void;

  /**
   * Increment the counter with labels
   * @param labels - The labels to apply
   * @param value - The value to increment by (defaults to 1)
   */
  inc(labels: MetricLabels, value?: number): void;

  /**
   * Get the current value of the counter
   */
  get(): number;

  /**
   * Reset the counter to 0
   */
  reset(): void;
}

/**
 * Gauge metric interface
 * Gauges can increase or decrease in value
 */
export interface Gauge extends BaseMetric {
  /**
   * Set the gauge to a specific value
   * @param value - The value to set
   */
  set(value: number): void;

  /**
   * Set the gauge with labels
   * @param labels - The labels to apply
   * @param value - The value to set
   */
  set(labels: MetricLabels, value: number): void;

  /**
   * Increment the gauge by 1
   */
  inc(): void;

  /**
   * Increment the gauge by the given value
   * @param value - The value to increment by
   */
  inc(value: number): void;

  /**
   * Increment the gauge with labels
   * @param labels - The labels to apply
   * @param value - The value to increment by (defaults to 1)
   */
  inc(labels: MetricLabels, value?: number): void;

  /**
   * Decrement the gauge by 1
   */
  dec(): void;

  /**
   * Decrement the gauge by the given value
   * @param value - The value to decrement by
   */
  dec(value: number): void;

  /**
   * Decrement the gauge with labels
   * @param labels - The labels to apply
   * @param value - The value to decrement by (defaults to 1)
   */
  dec(labels: MetricLabels, value?: number): void;

  /**
   * Get the current value of the gauge
   */
  get(): number;

  /**
   * Set the gauge to the current timestamp
   */
  setToCurrentTime(): void;
}

/**
 * Histogram metric interface
 * Histograms track distributions of values
 */
export interface Histogram extends BaseMetric {
  readonly buckets: readonly number[];

  /**
   * Observe a value
   * @param value - The value to observe
   */
  observe(value: number): void;

  /**
   * Observe a value with labels
   * @param labels - The labels to apply
   * @param value - The value to observe
   */
  observe(labels: MetricLabels, value: number): void;

  /**
   * Start a timer and return a function to end it
   */
  startTimer(): () => number;

  /**
   * Start a timer with labels
   * @param labels - The labels to apply
   */
  startTimer(labels: MetricLabels): () => number;

  /**
   * Reset the histogram
   */
  reset(): void;
}

/**
 * Summary metric interface
 * Summaries track distributions with configurable quantiles
 */
export interface Summary extends BaseMetric {
  readonly percentiles: readonly number[];

  /**
   * Observe a value
   * @param value - The value to observe
   */
  observe(value: number): void;

  /**
   * Observe a value with labels
   * @param labels - The labels to apply
   * @param value - The value to observe
   */
  observe(labels: MetricLabels, value: number): void;

  /**
   * Start a timer and return a function to end it
   */
  startTimer(): () => number;

  /**
   * Start a timer with labels
   * @param labels - The labels to apply
   */
  startTimer(labels: MetricLabels): () => number;

  /**
   * Reset the summary
   */
  reset(): void;
}
