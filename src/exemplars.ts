/**
 * Tracing exemplar helpers (OpenTelemetry trace/span ids attached to observations)
 */

import type { ExemplarExtractor, ExemplarLabels, FastifyPrometheusOptions } from './types';

/**
 * The slice of `@opentelemetry/api` the default extractor needs. Declared structurally so the
 * optional peer dependency is never needed at compile time or in the emitted typings.
 */
export interface OtelTraceApi {
  trace: {
    getActiveSpan(): { spanContext(): { traceId: string; spanId: string } } | undefined;
  };
}

const INVALID_TRACE_ID = /^0+$/;

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
 */
export function exemplarFromOtel(api: OtelTraceApi | null): ExemplarLabels | undefined {
  const spanContext = api?.trace.getActiveSpan()?.spanContext();
  if (spanContext === undefined || INVALID_TRACE_ID.test(spanContext.traceId)) {
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
