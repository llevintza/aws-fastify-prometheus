/**
 * Tracing exemplar helpers (OpenTelemetry trace/span ids attached to observations)
 */

import type { FastifyRequest } from 'fastify';

import type { ExemplarExtractor, ExemplarLabels, FastifyPrometheusOptions } from './types';

/**
 * The slice of `@opentelemetry/api` the default extractor needs. Declared structurally so the
 * optional peer dependency is never needed at compile time or in the emitted typings.
 */
export interface OtelTraceApi {
  trace: {
    getActiveSpan():
      { spanContext(): { traceId: string; spanId: string; traceFlags: number } } | undefined;
  };
}

const INVALID_TRACE_ID = /^0+$/;
/** W3C trace-context `sampled` flag */
const TRACE_FLAG_SAMPLED = 0x01;
/** OpenMetrics: the combined length of exemplar label names and values is at most 128 */
const MAX_EXEMPLAR_LABEL_CHARS = 128;
const LABEL_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

let otelApi: OtelTraceApi | null | undefined;

/**
 * Lazily loads `@opentelemetry/api`. Returns `null` (once, then cached) when it isn't installed.
 */
export function loadOtelApi(): OtelTraceApi | null {
  if (otelApi === undefined) {
    try {
      // A runtime require keeps the peer dependency optional: nothing fails if it is absent.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      otelApi = require('@opentelemetry/api') as OtelTraceApi;
    } catch {
      otelApi = null;
    }
  }
  return otelApi;
}

/**
 * Reads `trace_id`/`span_id` from the active span of the given OpenTelemetry API, if any.
 * Unsampled spans are skipped: their traces are not recorded, so the exemplar could not be opened.
 */
export function exemplarFromOtel(api: OtelTraceApi | null): ExemplarLabels | undefined {
  const spanContext = api?.trace.getActiveSpan()?.spanContext();
  if (
    spanContext === undefined ||
    INVALID_TRACE_ID.test(spanContext.traceId) ||
    (spanContext.traceFlags & TRACE_FLAG_SAMPLED) === 0
  ) {
    return undefined;
  }
  return { trace_id: spanContext.traceId, span_id: spanContext.spanId };
}

/**
 * Default exemplar extractor: the active OpenTelemetry span's `trace_id` and `span_id`.
 * Records nothing when `@opentelemetry/api` isn't installed or no span is active.
 */
export const otelExemplarExtractor: ExemplarExtractor = () => exemplarFromOtel(loadOtelApi());

/**
 * Returns the labels when they form a valid OpenMetrics exemplar label set, otherwise `undefined`.
 * prom-client leaves a broken exemplar in the exposition (failing every later scrape) when it
 * rejects a label set, so anything invalid is dropped before it reaches prom-client.
 */
export function sanitizeExemplarLabels(labels: unknown): ExemplarLabels | undefined {
  if (typeof labels !== 'object' || labels === null || Array.isArray(labels)) {
    return undefined;
  }
  const entries = Object.entries(labels);
  if (entries.length === 0) {
    return undefined;
  }
  const result: ExemplarLabels = {};
  let length = 0;
  for (const [name, value] of entries) {
    if (!LABEL_NAME.test(name) || typeof value !== 'string') {
      return undefined;
    }
    length += [...name].length + [...value].length;
    result[name] = value;
  }
  return length <= MAX_EXEMPLAR_LABEL_CHARS ? result : undefined;
}

/**
 * Runs an extractor and sanitizes its result. A throwing extractor yields no exemplar instead of
 * failing the request hook.
 */
export function safeExtractExemplar(
  extractor: ExemplarExtractor,
  request: FastifyRequest
): ExemplarLabels | undefined {
  try {
    return sanitizeExemplarLabels(extractor(request));
  } catch {
    return undefined;
  }
}

/**
 * Validates the `openMetrics`/`exemplars` options and returns the extractor to use, if any.
 * Throws when exemplars are requested without OpenMetrics output.
 */
export function resolveExemplarExtractor(
  options: Pick<FastifyPrometheusOptions, 'openMetrics' | 'exemplars'>
): ExemplarExtractor | undefined {
  const { exemplars, openMetrics } = options;
  if (exemplars === undefined || exemplars === false) {
    return undefined;
  }
  if (openMetrics !== true) {
    throw new Error(
      'fastify-prometheus-metrics: the `exemplars` option requires `openMetrics: true` ' +
        '(exemplars are only part of the OpenMetrics exposition format)'
    );
  }
  return exemplars === true ? otelExemplarExtractor : exemplars;
}
