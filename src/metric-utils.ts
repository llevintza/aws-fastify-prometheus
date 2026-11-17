/**
 * Small pure helpers used by the Fastify plugin.
 */

const NANOSECONDS_PER_MILLISECOND = 1_000_000;

/**
 * Milliseconds (as a float, sub-millisecond precision) elapsed between two
 * `process.hrtime.bigint()` readings.
 */
export function elapsedMs(start: bigint, end: bigint = process.hrtime.bigint()): number {
  return Number(end - start) / NANOSECONDS_PER_MILLISECOND;
}

/**
 * Prepend `prefix` to a metric name. An empty or missing prefix leaves the name unchanged.
 */
export function prefixMetricName(name: string, prefix?: string): string {
  return typeof prefix === 'string' && prefix.length > 0 ? `${prefix}${name}` : name;
}
