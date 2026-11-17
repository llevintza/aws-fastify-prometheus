/**
 * Tests for the tracing exemplar helpers
 */

import { describe, test, expect, afterEach, jest } from '@jest/globals';
import { trace } from '@opentelemetry/api';

import {
  exemplarFromOtel,
  loadOtelApi,
  otelExemplarExtractor,
  resolveExemplarExtractor,
} from '../src/exemplars';
import type * as ExemplarsModule from '../src/exemplars';
import type { OtelTraceApi } from '../src/exemplars';

const TRACE_ID = '0af7651916cd43dd8448eb211c80319c';
const SPAN_ID = 'b7ad6b7169203331';

function fakeApi(spanContext?: { traceId: string; spanId: string }): OtelTraceApi {
  return {
    trace: {
      getActiveSpan: () =>
        spanContext === undefined ? undefined : { spanContext: () => spanContext },
    },
  };
}

describe('exemplar helpers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('exemplarFromOtel', () => {
    test('returns trace_id and span_id of the active span', () => {
      expect(exemplarFromOtel(fakeApi({ traceId: TRACE_ID, spanId: SPAN_ID }))).toEqual({
        trace_id: TRACE_ID,
        span_id: SPAN_ID,
      });
    });

    test('returns undefined without an active span', () => {
      expect(exemplarFromOtel(fakeApi())).toBeUndefined();
    });

    test('returns undefined for an invalid (all-zero) trace id', () => {
      const invalid = { traceId: '00000000000000000000000000000000', spanId: SPAN_ID };
      expect(exemplarFromOtel(fakeApi(invalid))).toBeUndefined();
    });

    test('returns undefined when the OpenTelemetry API is missing', () => {
      expect(exemplarFromOtel(null)).toBeUndefined();
    });
  });

  describe('otelExemplarExtractor', () => {
    test('reads the active span from @opentelemetry/api', () => {
      jest
        .spyOn(trace, 'getActiveSpan')
        .mockReturnValue(
          trace.wrapSpanContext({ traceId: TRACE_ID, spanId: SPAN_ID, traceFlags: 1 })
        );

      expect(loadOtelApi()).not.toBeNull();
      expect(otelExemplarExtractor({} as never)).toEqual({ trace_id: TRACE_ID, span_id: SPAN_ID });
    });

    test('returns undefined when no span is active', () => {
      expect(otelExemplarExtractor({} as never)).toBeUndefined();
    });

    test('does nothing when @opentelemetry/api is not installed', () => {
      jest.isolateModules(() => {
        jest.doMock('@opentelemetry/api', () => {
          throw new Error("Cannot find module '@opentelemetry/api'");
        });
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- fresh module copy
        const isolated = require('../src/exemplars') as typeof ExemplarsModule;

        expect(isolated.loadOtelApi()).toBeNull();
        expect(isolated.otelExemplarExtractor({} as never)).toBeUndefined();
      });
      jest.dontMock('@opentelemetry/api');
    });
  });

  describe('resolveExemplarExtractor', () => {
    test('returns undefined when exemplars are off', () => {
      expect(resolveExemplarExtractor({})).toBeUndefined();
      expect(resolveExemplarExtractor({ exemplars: false })).toBeUndefined();
    });

    test('throws when exemplars are enabled without openMetrics', () => {
      expect(() => resolveExemplarExtractor({ exemplars: true })).toThrow(
        'the `exemplars` option requires `openMetrics: true`'
      );
      expect(() => resolveExemplarExtractor({ exemplars: () => undefined })).toThrow(
        'requires `openMetrics: true`'
      );
    });

    test('returns the OpenTelemetry extractor for `true`', () => {
      expect(resolveExemplarExtractor({ exemplars: true, openMetrics: true })).toBe(
        otelExemplarExtractor
      );
    });

    test('returns a custom extractor unchanged', () => {
      const extractor = (): undefined => undefined;
      expect(resolveExemplarExtractor({ exemplars: extractor, openMetrics: true })).toBe(extractor);
    });
  });
});
