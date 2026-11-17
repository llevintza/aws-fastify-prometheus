/**
 * Option-merging helpers for the Fastify plugin's HTTP metrics config
 */

import type { HttpMetricsConfig } from './types';

/**
 * Copy `base`, then overwrite it with every field of `overrides` that is not `undefined` or
 * `null` (JavaScript callers may pass `null` for "unset"). Arrays (`buckets`, `labels`) are
 * replaced, not concatenated, and copied. Neither input is mutated or aliased.
 */
function mergeDefined<T extends object>(base: T | undefined, overrides: T | undefined): T {
  const merged = {} as T;
  for (const source of [base, overrides]) {
    if (source === undefined || source === null) {
      continue;
    }
    for (const key of Object.keys(source) as (keyof T)[]) {
      const value = source[key];
      if (value !== undefined && value !== null) {
        // Copy arrays so the merged config never aliases the defaults or the caller's options
        merged[key] = (Array.isArray(value) ? [...(value as unknown[])] : value) as T[keyof T];
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
  overrides?: HttpMetricsConfig | null
): HttpMetricsConfig {
  const merged: HttpMetricsConfig = {};
  const keys = new Set([...Object.keys(defaults), ...Object.keys(overrides ?? {})]) as Set<
    keyof HttpMetricsConfig
  >;

  for (const key of keys) {
    const base = defaults[key];
    const override = overrides?.[key] ?? undefined;
    if (base !== undefined || override !== undefined) {
      Object.assign(merged, { [key]: mergeDefined<object>(base, override) });
    }
  }

  return merged;
}
