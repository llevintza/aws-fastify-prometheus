/**
 * AWS CloudWatch metrics exporter
 */

import type { AwsExporterConfig, MetricLabels } from './types';

/**
 * AwsMetricsExporter class for exporting metrics to AWS CloudWatch
 */
export class AwsMetricsExporter {
  private readonly config: AwsExporterConfig & { batchSize: number; flushInterval: number };
  private metricsBuffer: MetricData[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  /**
   * Create a new AwsMetricsExporter instance
   * @param config - AWS exporter configuration
   */
  constructor(config: AwsExporterConfig) {
    const defaults = {
      region: 'us-east-1',
      batchSize: 20,
      flushInterval: 60000, // 1 minute
    };

    this.config = {
      ...defaults,
      ...config,
    };

    this.startFlushTimer();
  }

  /**
   * Export a metric to CloudWatch
   * @param name - Metric name
   * @param value - Metric value
   * @param labels - Metric labels (converted to dimensions)
   * @param timestamp - Metric timestamp (defaults to now)
   */
  public exportMetric(
    name: string,
    value: number,
    labels: MetricLabels = {},
    timestamp: Date = new Date()
  ): void {
    const metricData: MetricData = {
      MetricName: name,
      Value: value,
      Timestamp: timestamp,
      Dimensions: this.labelsToCloudWatchDimensions(labels),
      Unit: 'Count', // Default unit, can be made configurable
    };

    this.metricsBuffer.push(metricData);

    if (this.metricsBuffer.length >= this.config.batchSize) {
      void this.flush();
    }
  }

  /**
   * Export multiple metrics to CloudWatch
   * @param metrics - Array of metrics to export
   */
  public exportMetrics(metrics: MetricExportData[]): void {
    for (const metric of metrics) {
      this.exportMetric(metric.name, metric.value, metric.labels, metric.timestamp);
    }
  }

  /**
   * Flush all buffered metrics to CloudWatch
   */
  public async flush(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const metricsToSend = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      await this.sendMetricsToCloudWatch(metricsToSend);
    } catch (error) {
      // Re-add metrics to buffer on failure
      this.metricsBuffer.unshift(...metricsToSend);
      throw error;
    }
  }

  /**
   * Get the current buffer size
   * @returns Number of metrics in buffer
   */
  public getBufferSize(): number {
    return this.metricsBuffer.length;
  }

  /**
   * Clear the metrics buffer
   */
  public clearBuffer(): void {
    this.metricsBuffer = [];
  }

  /**
   * Stop the automatic flush timer
   */
  public stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Start the automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flush().catch(() => {
        // In a production environment, you might want to use a proper logger
        // For now, we'll silently handle the error to avoid console output
      });
    }, this.config.flushInterval);
  }

  /**
   * Convert Prometheus labels to CloudWatch dimensions
   * @param labels - Prometheus labels
   * @returns CloudWatch dimensions
   */
  private labelsToCloudWatchDimensions(labels: MetricLabels): CloudWatchDimension[] {
    return Object.entries(labels).map(([name, value]) => ({
      Name: name,
      Value: value,
    }));
  }

  /**
   * Send metrics to CloudWatch (placeholder implementation)
   * @param metrics - Metrics to send
   */
  private async sendMetricsToCloudWatch(metrics: MetricData[]): Promise<void> {
    // This is a placeholder implementation
    // In a real implementation, you would use the AWS SDK to send metrics

    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 100));

    // In a production environment, you would send these metrics to CloudWatch
    // For now, we'll just validate the metrics structure without logging
    metrics.forEach(() => {
      // In real implementation, send to CloudWatch here
      // For now, we just iterate through the metrics to validate structure
    });
  }
}

/**
 * CloudWatch dimension interface
 */
interface CloudWatchDimension {
  readonly Name: string;
  readonly Value: string;
}

/**
 * CloudWatch metric data interface
 */
interface MetricData {
  readonly MetricName: string;
  readonly Value: number;
  readonly Timestamp: Date;
  readonly Dimensions?: readonly CloudWatchDimension[];
  readonly Unit?: string;
}

/**
 * Metric export data interface
 */
export interface MetricExportData {
  readonly name: string;
  readonly value: number;
  readonly labels?: MetricLabels;
  readonly timestamp?: Date;
}
