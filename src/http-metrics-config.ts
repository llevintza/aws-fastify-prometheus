/**
 * Option-merging helpers for the Fastify plugin's HTTP metrics config
 */

import type { HttpMetricsConfig } from './types';

/**
 * Copy `base`, then overwrite it with every field of `overrides` that is not `undefined`.
 * Arrays (`buckets`, `labels`) are replaced, not concatenated. Neither input is mutated.
 */
function mergeDefined<T extends object>(base: T | undefined, overrides: T | undefined): T {
  const merged = { ...base } as T;
  if (overrides !== undefined) {
    for (const key of Object.keys(overrides) as (keyof T)[]) {
      const value = overrides[key];
      if (value !== undefined) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

/**
 * Deep-merge user HTTP metrics options onto the defaults, one metric at a time and field by
 * field. A metric the user doesn't mention keeps its default config; a metric they mention
 * keeps every default field they leave out. `enabled: false` turns a default metric off.
 */
export function mergeHttpMetrics(
  defaults: HttpMetricsConfig,
  overrides?: HttpMetricsConfig
): HttpMetricsConfig {
  const merged: HttpMetricsConfig = {};
  const keys = new Set([...Object.keys(defaults), ...Object.keys(overrides ?? {})]) as Set<
    keyof HttpMetricsConfig
  >;

  for (const key of keys) {
    const base = defaults[key];
    const override = overrides?.[key];
    if (base !== undefined || override !== undefined) {
      Object.assign(merged, { [key]: mergeDefined<object>(base, override) });
    }
  }

  return merged;
}
