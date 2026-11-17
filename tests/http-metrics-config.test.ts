/**
 * Unit tests for the httpMetrics deep-merge helper
 */

import { describe, test, expect } from '@jest/globals';

import { mergeHttpMetrics } from '../src/http-metrics-config';
import type { HttpMetricsConfig } from '../src/types';

const defaults: HttpMetricsConfig = {
  requestDuration: {
    enabled: true,
    name: 'duration',
    help: 'Duration',
    buckets: [1, 2, 3],
    labels: ['method', 'route', 'status_code'],
  },
  requestCount: { enabled: true, name: 'count', help: 'Count', labels: ['method'] },
  inFlight: { enabled: false, name: 'in_flight', help: 'In flight' },
};

describe('mergeHttpMetrics', () => {
  test('returns a copy of the defaults when there are no overrides', () => {
    const merged = mergeHttpMetrics(defaults);
    expect(merged).toEqual(defaults);
    expect(merged).not.toBe(defaults);
    expect(merged.requestCount).not.toBe(defaults.requestCount);
    expect(merged.requestDuration?.buckets).not.toBe(defaults.requestDuration?.buckets);
    expect(merged.requestDuration?.labels).not.toBe(defaults.requestDuration?.labels);
    expect(mergeHttpMetrics(defaults, {})).toEqual(defaults);
  });

  test('a partial httpMetrics keeps the metrics it does not mention', () => {
    const merged = mergeHttpMetrics(defaults, { inFlight: { enabled: true } });
    expect(merged.requestDuration).toEqual(defaults.requestDuration);
    expect(merged.requestCount).toEqual(defaults.requestCount);
    expect(merged.inFlight).toEqual({ enabled: true, name: 'in_flight', help: 'In flight' });
  });

  test('a partial metric config keeps the fields it does not set', () => {
    const merged = mergeHttpMetrics(defaults, { requestDuration: { buckets: [10, 20] } });
    expect(merged.requestDuration).toEqual({
      enabled: true,
      name: 'duration',
      help: 'Duration',
      buckets: [10, 20],
      labels: ['method', 'route', 'status_code'],
    });
  });

  test('arrays replace the default rather than being concatenated', () => {
    const labels = ['route'];
    const merged = mergeHttpMetrics(defaults, { requestCount: { labels } });
    expect(merged.requestCount?.labels).toEqual(['route']);
    expect(merged.requestCount?.labels).not.toBe(labels);
  });

  test('enabled: false turns a default metric off', () => {
    const merged = mergeHttpMetrics(defaults, { requestCount: { enabled: false } });
    expect(merged.requestCount).toEqual({ ...defaults.requestCount, enabled: false });
  });

  test('undefined values do not erase defaults', () => {
    const overrides = {
      requestCount: { name: undefined, help: 'New help' },
      requestDuration: undefined,
    } as unknown as HttpMetricsConfig;
    const merged = mergeHttpMetrics(defaults, overrides);
    expect(merged.requestCount).toEqual({ ...defaults.requestCount, help: 'New help' });
    expect(merged.requestDuration).toEqual(defaults.requestDuration);
  });

  test('null values from JavaScript callers are treated as unset', () => {
    const overrides = {
      requestCount: { name: null, help: 'New help' },
      requestDuration: null,
    } as unknown as HttpMetricsConfig;
    const merged = mergeHttpMetrics(defaults, overrides);
    expect(merged.requestCount).toEqual({ ...defaults.requestCount, help: 'New help' });
    expect(merged.requestDuration).toEqual(defaults.requestDuration);
    expect(mergeHttpMetrics(defaults, null)).toEqual(defaults);
  });

  test('keeps metrics that only exist in the overrides', () => {
    const merged = mergeHttpMetrics({}, { errorCount: { enabled: true, name: 'errors' } });
    expect(merged).toEqual({ errorCount: { enabled: true, name: 'errors' } });
  });

  test('does not mutate its inputs', () => {
    const overrides: HttpMetricsConfig = { requestCount: { help: 'Changed' } };
    const snapshot = JSON.stringify(defaults);
    mergeHttpMetrics(defaults, overrides);
    expect(JSON.stringify(defaults)).toBe(snapshot);
    expect(overrides).toEqual({ requestCount: { help: 'Changed' } });
  });
});
