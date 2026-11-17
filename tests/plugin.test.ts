/**
 * Tests for the Fastify Prometheus Plugin
 */

import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { trace } from '@opentelemetry/api';
import Fastify from 'fastify';
import { Registry } from 'prom-client';

import fastifyPrometheusPlugin from '../src/index';
import { elapsedMs, prefixMetricName } from '../src/metric-utils';

async function waitFor(
  condition: () => boolean | Promise<boolean>,
  deadline = Date.now() + 2000
): Promise<void> {
  if (await condition()) {
    return;
  }
  if (Date.now() > deadline) {
    throw new Error('Timed out waiting for condition');
  }
  await new Promise(resolve => setTimeout(resolve, 10));
  return waitFor(condition, deadline);
}

describe('Fastify Prometheus Plugin', () => {
  let registry: Registry;

  beforeEach(() => {
    // Create a new registry for each test to avoid metric conflicts
    registry = new Registry();
  });

  afterEach(() => {
    // Clear the registry after each test
    registry.clear();
  });

  test('should register plugin successfully', async () => {
    const fastify = Fastify();

    await expect(
      fastify.register(fastifyPrometheusPlugin, {
        register: registry,
      })
    ).resolves.not.toThrow();

    await fastify.close();
  });

  test('should expose metrics endpoint', async () => {
    const fastify = Fastify();

    await fastify.register(fastifyPrometheusPlugin, {
      endpoint: '/metrics',
      register: registry,
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/metrics',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/plain/);

    await fastify.close();
  });

  test(
    'should collect HTTP metrics',
    async () => {
      const fastify = Fastify();

      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
      });

      fastify.get('/test', () => ({ message: 'test' }));

      // Make a request to generate metrics
      await fastify.inject({
        method: 'GET',
        url: '/test',
      });

      // Check if metrics are collected
      const metricsResponse = await fastify.inject({
        method: 'GET',
        url: '/metrics',
      });

      const metricsText = metricsResponse.payload;
      expect(metricsText).toContain('http_requests_total');
      expect(metricsText).toContain('http_request_duration_ms');

      await fastify.close();
    },
    20 * 1000
  );

  test('should support custom metrics', async () => {
    const fastify = Fastify();

    await fastify.register(fastifyPrometheusPlugin, {
      register: registry,
      customMetrics: [
        {
          type: 'counter',
          name: 'test_counter',
          help: 'Test counter metric',
          labels: ['label1'],
        },
      ],
    });

    // Use custom metric
    fastify.prometheus.incrementCounter('test_counter', { label1: 'value1' });

    const metricsResponse = await fastify.inject({
      method: 'GET',
      url: '/metrics',
    });

    expect(metricsResponse.payload).toContain('test_counter');

    await fastify.close();
  });

  test('should exclude routes from metrics', async () => {
    const fastify = Fastify();

    await fastify.register(fastifyPrometheusPlugin, {
      register: registry,
      excludeRoutes: ['/excluded'],
    });

    fastify.get('/included', () => ({ message: 'included' }));
    fastify.get('/excluded', () => ({ message: 'excluded' }));

    // Make requests
    await fastify.inject({ method: 'GET', url: '/included' });
    await fastify.inject({ method: 'GET', url: '/excluded' });

    const metricsResponse = await fastify.inject({
      method: 'GET',
      url: '/metrics',
    });

    const metricsText = metricsResponse.payload;
    expect(metricsText).toContain('route="/included"');
    expect(metricsText).not.toContain('route="/excluded"');

    await fastify.close();
  });

  test(
    'should support custom histogram buckets',
    async () => {
      const fastify = Fastify();

      const customBuckets = [10, 50, 100, 500, 1000];

      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        httpMetrics: {
          requestDuration: {
            enabled: true,
            name: 'http_request_duration_ms',
            help: 'Duration of HTTP requests in milliseconds',
            labels: ['method', 'route', 'status_code'],
            buckets: customBuckets,
          },
        },
      });

      fastify.get('/test', async () => {
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 20));
        return { message: 'test' };
      });

      await fastify.inject({ method: 'GET', url: '/test' });

      const metricsResponse = await fastify.inject({
        method: 'GET',
        url: '/metrics',
      });

      const metricsText = metricsResponse.payload;

      // Check if custom buckets are present
      customBuckets.forEach(bucket => {
        expect(metricsText).toContain(`le="${bucket}"`);
      });

      await fastify.close();
    },
    20 * 1000
  );

  test('should handle plugin context methods', async () => {
    const fastify = Fastify();

    await fastify.register(fastifyPrometheusPlugin, {
      register: registry,
      customMetrics: [
        {
          type: 'gauge',
          name: 'test_gauge',
          help: 'Test gauge',
        },
        {
          type: 'histogram',
          name: 'test_histogram',
          help: 'Test histogram',
          config: { buckets: [1, 5, 10] },
        },
      ],
    });

    // Test gauge
    fastify.prometheus.setGauge('test_gauge', 42);

    // Test histogram
    fastify.prometheus.observeHistogram('test_histogram', 7);

    const metricsText = await fastify.prometheus.getMetrics();

    expect(metricsText).toContain('test_gauge 42');
    expect(metricsText).toContain('test_histogram');

    await fastify.close();
  });

  describe('high-resolution request timing', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('records sub-millisecond durations', async () => {
      // Each hrtime reading advances the fake clock by 0.25 ms
      let fakeNow = 1_000_000_000n;
      jest.spyOn(process.hrtime, 'bigint').mockImplementation(() => {
        fakeNow += 250_000n;
        return fakeNow;
      });

      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
      });
      fastify.get('/fast', () => ({ ok: true }));

      await fastify.inject({ method: 'GET', url: '/fast' });

      const metricsText = await registry.getSingleMetricAsString('http_request_duration_ms');
      expect(metricsText).toContain(
        'http_request_duration_ms_sum{method="GET",route="/fast",status_code="200"} 0.25'
      );

      await fastify.close();
    });
  });

  describe('in-flight gauge', () => {
    const gaugeValue = async (
      name = 'http_requests_in_flight',
      method = 'GET'
    ): Promise<number> => {
      const data = await registry.getSingleMetric(name)?.get();
      return data?.values.find(v => v.labels['method'] === method)?.value ?? 0;
    };

    test('falls back to onResponse when onRequestAbort is unsupported', async () => {
      const fastify = Fastify();
      const originalAddHook = fastify.addHook.bind(fastify);
      try {
        // Simulate an older Fastify 4.x that rejects the onRequestAbort hook name
        jest.spyOn(fastify, 'addHook').mockImplementation(((name: string, ...rest: unknown[]) => {
          if (name === 'onRequestAbort') {
            throw new Error('onRequestAbort hook not supported!');
          }
          return (originalAddHook as (...args: unknown[]) => unknown)(name, ...rest);
        }) as typeof fastify.addHook);
        const warn = jest.spyOn(fastify.log, 'warn');

        await fastify.register(fastifyPrometheusPlugin, {
          register: registry,
          enableDefaultMetrics: false,
          httpMetrics: { inFlight: { enabled: true } },
        });
        fastify.get('/test', () => ({ ok: true }));
        await fastify.inject({ method: 'GET', url: '/test' });

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[1]).toMatch(/onRequestAbort hook unsupported/);
        expect(await gaugeValue()).toBe(0);
      } finally {
        jest.restoreAllMocks();
        await fastify.close();
      }
    });

    test('is not registered by default', async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, { register: registry });
      fastify.get('/test', () => ({ ok: true }));
      await fastify.inject({ method: 'GET', url: '/test' });

      const metricsText = await fastify.prometheus.getMetrics();
      expect(metricsText).not.toContain('http_requests_in_flight');
      expect(metricsText).toContain('http_request_duration_ms');

      await fastify.close();
    });

    test('tracks concurrent requests and returns to 0', async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        httpMetrics: { inFlight: { enabled: true } },
      });

      const release: Array<() => void> = [];
      fastify.get('/slow', async () => {
        await new Promise<void>(resolve => release.push(resolve));
        return { ok: true };
      });

      const pending = [
        fastify.inject({ method: 'GET', url: '/slow' }),
        fastify.inject({ method: 'GET', url: '/slow' }),
        fastify.inject({ method: 'GET', url: '/slow' }),
      ];

      await waitFor(() => release.length === 3);
      expect(await gaugeValue()).toBe(3);

      release.forEach(resolve => resolve());
      await Promise.all(pending);

      expect(await gaugeValue()).toBe(0);

      await fastify.close();
    });

    test('uses a custom name and skips excluded routes', async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        excludeRoutes: ['/health'],
        httpMetrics: { inFlight: { enabled: true, name: 'busy_requests', help: 'Busy' } },
      });

      let gaugeDuringHealth = -1;
      fastify.get('/health', async () => {
        gaugeDuringHealth = await gaugeValue('busy_requests');
        return { ok: true };
      });

      await fastify.inject({ method: 'GET', url: '/health' });

      expect(gaugeDuringHealth).toBe(0);
      expect(await gaugeValue('busy_requests')).toBe(0);

      await fastify.close();
    });

    test('honours the per-route metrics: false opt-out', async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        httpMetrics: { inFlight: { enabled: true } },
      });

      let gaugeDuringPing = -1;
      fastify.get('/ping', { config: { metrics: false } }, async () => {
        gaugeDuringPing = await gaugeValue();
        return 'pong';
      });

      await fastify.inject({ method: 'GET', url: '/ping' });

      expect(gaugeDuringPing).toBe(0);
      expect(await gaugeValue()).toBe(0);

      await fastify.close();
    });

    test('filters unmatched URLs like the HTTP counters do', async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        excludeRoutes: ['/ignored'],
        unmatchedRouteLabel: '__unmatched__',
        httpMetrics: {
          requestCount: {
            enabled: true,
            name: 'http_requests_total',
            help: 'Total number of HTTP requests',
            labels: ['method', 'route', 'status_code'],
          },
          inFlight: { enabled: true },
        },
      });

      const seen: Record<string, number> = {};
      fastify.setNotFoundHandler(async (request, reply) => {
        seen[request.url] = await gaugeValue();
        return reply.code(404).send('not found');
      });

      await fastify.inject({ method: 'GET', url: '/ignored/x' });
      await fastify.inject({ method: 'GET', url: '/other' });

      // Filtering runs on the raw URL before the unmatched label is applied
      expect(seen).toEqual({ '/ignored/x': 0, '/other': 1 });
      expect(await gaugeValue()).toBe(0);

      const counter = await registry.getSingleMetric('http_requests_total')?.get();
      expect(counter?.values).toHaveLength(1);
      expect(counter?.values[0]?.labels['route']).toBe('__unmatched__');

      await fastify.close();
    });

    test("ignores the query string on unmatched URLs in routeMatch 'exact'", async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        routeMatch: 'exact',
        excludeRoutes: ['/ignored'],
        httpMetrics: { inFlight: { enabled: true } },
      });

      const seen: Record<string, number> = {};
      fastify.setNotFoundHandler(async (request, reply) => {
        seen[request.url] = await gaugeValue();
        return reply.code(404).send('not found');
      });

      await fastify.inject({ method: 'GET', url: '/ignored?probe=1' });
      await fastify.inject({ method: 'GET', url: '/ignored/x?probe=1' });

      expect(seen).toEqual({ '/ignored?probe=1': 0, '/ignored/x?probe=1': 1 });
      expect(await gaugeValue()).toBe(0);

      await fastify.close();
    });

    test('returns to 0 after an aborted request without double-decrementing', async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        httpMetrics: { inFlight: { enabled: true } },
      });

      let entered = false;
      let release: () => void = () => undefined;
      fastify.get('/hang', async () => {
        entered = true;
        await new Promise<void>(resolve => {
          release = resolve;
        });
        return { ok: true };
      });

      await fastify.listen({ port: 0, host: '127.0.0.1' });
      const { port } = fastify.server.address() as AddressInfo;

      const clientRequest = http.get({ host: '127.0.0.1', port, path: '/hang' });
      clientRequest.on('error', () => undefined);

      try {
        await waitFor(() => entered);
        expect(await gaugeValue()).toBe(1);

        clientRequest.destroy();
        await waitFor(async () => (await gaugeValue()) === 0);

        // Let the handler finish; a late onResponse must not push the gauge below 0
        release();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(await gaugeValue()).toBe(0);
      } finally {
        clientRequest.destroy();
        release();
        await fastify.close();
      }
    });
  });

  describe('metric prefix', () => {
    test('prefixes HTTP and custom metric names', async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        prefix: 'myapp_',
        httpMetrics: {
          requestCount: {
            enabled: true,
            name: 'http_requests_total',
            help: 'Total number of HTTP requests',
            labels: ['method', 'route', 'status_code'],
          },
          inFlight: { enabled: true },
        },
        customMetrics: [{ type: 'counter', name: 'jobs_total', help: 'Jobs' }],
      });
      fastify.get('/test', () => ({ ok: true }));

      await fastify.inject({ method: 'GET', url: '/test' });
      // Context methods keep using the unprefixed name
      fastify.prometheus.incrementCounter('jobs_total');

      const metricsText = (await fastify.inject({ method: 'GET', url: '/metrics' })).payload;
      expect(metricsText).toContain('myapp_http_requests_total{method="GET",route="/test"');
      expect(metricsText).toContain('myapp_http_requests_in_flight');
      expect(metricsText).toContain('myapp_jobs_total 1');
      expect(metricsText).not.toMatch(/^http_requests_total/m);

      await fastify.close();
    });

    test('keeps default metric names when no prefix is set', async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
      });
      fastify.get('/test', () => ({ ok: true }));
      await fastify.inject({ method: 'GET', url: '/test' });

      const names = registry.getMetricsAsArray().map(m => m.name);
      expect(names.sort()).toEqual(
        [
          'http_errors_total',
          'http_request_duration_ms',
          'http_requests_total',
          'http_response_size_bytes',
          'http_success_total',
        ].sort()
      );

      await fastify.close();
    });
  });

  describe('metric-utils helpers', () => {
    test('elapsedMs returns fractional milliseconds', () => {
      expect(elapsedMs(1_000_000n, 1_250_000n)).toBe(0.25);
      expect(elapsedMs(0n, 12_345_678n)).toBeCloseTo(12.345678, 9);
      expect(elapsedMs(process.hrtime.bigint())).toBeGreaterThanOrEqual(0);
    });

    test('prefixMetricName prepends only a non-empty prefix', () => {
      expect(prefixMetricName('requests', 'app_')).toBe('app_requests');
      expect(prefixMetricName('requests', '')).toBe('requests');
      expect(prefixMetricName('requests')).toBe('requests');
    });
  });
  describe('OpenMetrics output and tracing exemplars', () => {
    const TRACE_ID = '0af7651916cd43dd8448eb211c80319c';
    const SPAN_ID = 'b7ad6b7169203331';

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should serve OpenMetrics with the OpenMetrics content type', async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        openMetrics: true,
      });

      const response = await fastify.inject({ method: 'GET', url: '/metrics' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe(Registry.OPENMETRICS_CONTENT_TYPE);
      expect(response.body).toContain('# EOF');

      await fastify.close();
    });

    test('should keep Prometheus text format 0.0.4 by default', async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, { register: registry });

      const response = await fastify.inject({ method: 'GET', url: '/metrics' });

      expect(response.headers['content-type']).toBe(Registry.PROMETHEUS_CONTENT_TYPE);
      expect(response.body).not.toContain('# EOF');

      await fastify.close();
    });

    test('should reject exemplars without openMetrics at registration', async () => {
      const fastify = Fastify();

      await expect(
        fastify.register(fastifyPrometheusPlugin, { register: registry, exemplars: true })
      ).rejects.toThrow('the `exemplars` option requires `openMetrics: true`');

      await fastify.close();
    });

    test('should attach exemplars from a custom extractor', async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        openMetrics: true,
        exemplars: request => ({ trace_id: TRACE_ID, span_id: SPAN_ID, method: request.method }),
      });
      fastify.get('/test', () => ({ ok: true }));

      await fastify.inject({ method: 'GET', url: '/test' });
      const body = (await fastify.inject({ method: 'GET', url: '/metrics' })).body;

      const exemplar = `# {trace_id="${TRACE_ID}",span_id="${SPAN_ID}",method="GET"}`;
      expect(body).toMatch(
        new RegExp(`http_requests_total\\{[^}]*route="/test"[^}]*\\} 1 ${escapeRegExp(exemplar)}`)
      );
      expect(body).toMatch(
        new RegExp(
          `http_request_duration_ms_bucket\\{[^}]*route="/test"[^}]*\\} 1 ${escapeRegExp(exemplar)}`
        )
      );

      await fastify.close();
    });

    test('should attach the active OpenTelemetry span by default', async () => {
      jest
        .spyOn(trace, 'getActiveSpan')
        .mockReturnValue(
          trace.wrapSpanContext({ traceId: TRACE_ID, spanId: SPAN_ID, traceFlags: 1 })
        );
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        openMetrics: true,
        exemplars: true,
      });
      fastify.get('/test', () => ({ ok: true }));

      await fastify.inject({ method: 'GET', url: '/test' });
      const response = await fastify.inject({ method: 'GET', url: '/metrics' });

      expect(response.headers['content-type']).toBe(Registry.OPENMETRICS_CONTENT_TYPE);
      expect(response.body).toContain(`# {trace_id="${TRACE_ID}",span_id="${SPAN_ID}"}`);

      await fastify.close();
    });

    test('should attach exemplars to prefixed metrics with float-ms durations', async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        openMetrics: true,
        prefix: 'myapp_',
        exemplars: () => ({ trace_id: TRACE_ID }),
      });
      fastify.get('/test', () => ({ ok: true }));

      await fastify.inject({ method: 'GET', url: '/test' });
      const body = (await fastify.inject({ method: 'GET', url: '/metrics' })).body;

      const exemplar = escapeRegExp(`# {trace_id="${TRACE_ID}"}`);
      expect(body).toMatch(
        new RegExp(`myapp_http_requests_total\\{[^}]*route="/test"[^}]*\\} 1 ${exemplar} 1 `)
      );
      // The histogram exemplar value is the observed duration in (fractional) milliseconds
      expect(body).toMatch(
        new RegExp(`myapp_http_request_duration_ms_bucket\\{[^}]*\\} 1 ${exemplar} \\d+(\\.\\d+)? `)
      );
      expect(body).not.toMatch(/^http_requests_total/m);

      await fastify.close();
    });

    test('should use the span that was active when the request started', async () => {
      // Tracing instrumentations may end or detach the span before onResponse runs
      jest
        .spyOn(trace, 'getActiveSpan')
        .mockReturnValueOnce(
          trace.wrapSpanContext({ traceId: TRACE_ID, spanId: SPAN_ID, traceFlags: 1 })
        )
        .mockReturnValue(undefined);
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        openMetrics: true,
        exemplars: true,
      });
      fastify.get('/test', () => ({ ok: true }));

      await fastify.inject({ method: 'GET', url: '/test' });
      const body = (await fastify.inject({ method: 'GET', url: '/metrics' })).body;

      const exemplar = `# {trace_id="${TRACE_ID}",span_id="${SPAN_ID}"}`;
      expect(body).toMatch(
        new RegExp(`http_requests_total\\{[^}]*route="/test"[^}]*\\} 1 ${escapeRegExp(exemplar)}`)
      );

      await fastify.close();
    });

    test('should extract again in onResponse when nothing was captured in onRequest', async () => {
      let handled = false;
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        openMetrics: true,
        exemplars: () => (handled ? { trace_id: TRACE_ID } : undefined),
      });
      fastify.get('/test', () => {
        handled = true;
        return { ok: true };
      });

      await fastify.inject({ method: 'GET', url: '/test' });
      const body = (await fastify.inject({ method: 'GET', url: '/metrics' })).body;

      expect(body).toContain(`# {trace_id="${TRACE_ID}"}`);

      await fastify.close();
    });

    test('should drop invalid or failing exemplars without breaking metrics', async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        openMetrics: true,
        exemplars: request => {
          const traceId = request.headers['x-trace-id'];
          if (traceId === 'throw') {
            throw new Error('extractor failure');
          }
          if (traceId === 'astral') {
            // 70 code points but 132 UTF-16 code units: prom-client would reject it
            return { trace_id: '\u{1F600}'.repeat(62) };
          }
          return typeof traceId === 'string' ? { trace_id: traceId } : undefined;
        },
      });
      fastify.get('/test', () => ({ ok: true }));

      const oversized = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-trace-id': 'a'.repeat(200) },
      });
      const astral = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-trace-id': 'astral' },
      });
      const failing = await fastify.inject({
        method: 'GET',
        url: '/test',
        headers: { 'x-trace-id': 'throw' },
      });
      await fastify.inject({ method: 'GET', url: '/test', headers: { 'x-trace-id': TRACE_ID } });
      const body = (await fastify.inject({ method: 'GET', url: '/metrics' })).body;

      expect(oversized.statusCode).toBe(200);
      expect(astral.statusCode).toBe(200);
      expect(failing.statusCode).toBe(200);
      expect(body).not.toContain('undefined');
      expect(body).not.toContain('# {}');
      expect(body).not.toContain('a'.repeat(200));
      expect(body).not.toContain('\u{1F600}');
      expect(body).toMatch(/http_requests_total\{[^}]*route="\/test"[^}]*\} 4 # \{trace_id=/);
      expect(body).toMatch(/http_request_duration_ms_count\{[^}]*route="\/test"[^}]*\} 4\n/);

      await fastify.close();
    });

    test('should record metrics without exemplars when no span is active', async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        openMetrics: true,
        exemplars: true,
      });
      fastify.get('/test', () => ({ ok: true }));

      await fastify.inject({ method: 'GET', url: '/test' });
      const body = (await fastify.inject({ method: 'GET', url: '/metrics' })).body;

      expect(body).toMatch(/http_requests_total\{[^}]*route="\/test"[^}]*\} 1\n/);
      expect(body).not.toContain('trace_id');

      await fastify.close();
    });

    test('should accept manual calls on exemplar-enabled HTTP metrics', async () => {
      const fastify = Fastify();
      await fastify.register(fastifyPrometheusPlugin, {
        register: registry,
        enableDefaultMetrics: false,
        openMetrics: true,
        exemplars: () => undefined,
      });

      fastify.prometheus.incrementCounter('http_requests_total', { method: 'GET' }, 2);
      fastify.prometheus.incrementCounter('http_requests_total');
      fastify.prometheus.observeHistogram('http_request_duration_ms', 12, { method: 'GET' });
      fastify.prometheus.observeHistogram('http_request_duration_ms', 3);
      fastify.prometheus.recordHttpRequest({
        method: 'POST',
        route: '/manual',
        statusCode: 201,
        duration: 5,
        labels: { method: 'POST', route: '/manual', status_code: '201' },
      });

      const metricsText = await fastify.prometheus.getMetrics();

      expect(metricsText).toContain('http_requests_total{method="GET"} 2');
      expect(metricsText).toContain('http_requests_total 1');
      expect(metricsText).toContain('http_request_duration_ms_count{method="GET"} 1');
      expect(metricsText).toContain('http_request_duration_ms_count 1');
      expect(metricsText).toContain(
        'http_requests_total{method="POST",route="/manual",status_code="201"} 1'
      );

      await fastify.close();
    });
  });
});

describe('Route matching and cardinality guard', () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry();
  });

  afterEach(() => {
    registry.clear();
  });

  const routeLabels = (metricsText: string): string[] =>
    metricsText
      .split('\n')
      .filter(line => line.startsWith('http_requests_total{'))
      .map(line => /route="([^"]*)"/.exec(line)?.[1] ?? '');

  test('uses raw URLs for unmatched requests by default', async () => {
    const fastify = Fastify();
    await fastify.register(fastifyPrometheusPlugin, { register: registry });

    await fastify.inject({ method: 'GET', url: '/nope/1' });
    await fastify.inject({ method: 'GET', url: '/nope/2' });

    const labels = routeLabels(await fastify.prometheus.getMetrics());
    expect(labels).toEqual(expect.arrayContaining(['/nope/1', '/nope/2']));

    await fastify.close();
  });

  test('collapses unmatched requests into unmatchedRouteLabel', async () => {
    const fastify = Fastify();
    await fastify.register(fastifyPrometheusPlugin, {
      register: registry,
      unmatchedRouteLabel: '__unmatched__',
    });
    fastify.get('/users/:id', () => ({ ok: true }));

    await Promise.all(
      ['/wp-login.php', '/a/b?c=d', '/random/123', '/.env'].map(url =>
        fastify.inject({ method: 'GET', url })
      )
    );
    await fastify.inject({ method: 'GET', url: '/users/7' });

    const labels = routeLabels(await fastify.prometheus.getMetrics());
    expect(new Set(labels)).toEqual(new Set(['__unmatched__', '/users/:id']));
    expect(await fastify.prometheus.getMetrics()).toContain(
      'http_requests_total{method="GET",route="__unmatched__",status_code="404"} 4'
    );

    await fastify.close();
  });

  test('filters unmatched requests on the raw URL before applying unmatchedRouteLabel', async () => {
    const fastify = Fastify();
    await fastify.register(fastifyPrometheusPlugin, {
      register: registry,
      includeRoutes: [/^\/api\//],
      unmatchedRouteLabel: '__unmatched__',
    });
    fastify.get('/api/users', () => ({ ok: true }));

    await Promise.all(
      ['/api/missing/1', '/api/missing/2', '/web/missing', '/api/users'].map(url =>
        fastify.inject({ method: 'GET', url })
      )
    );

    const metricsText = await fastify.prometheus.getMetrics();
    expect(new Set(routeLabels(metricsText))).toEqual(new Set(['__unmatched__', '/api/users']));
    expect(metricsText).toContain(
      'http_requests_total{method="GET",route="__unmatched__",status_code="404"} 2'
    );

    await fastify.close();
  });

  test("routeMatch 'exact' ignores the query string on unmatched URLs", async () => {
    const fastify = Fastify();
    await fastify.register(fastifyPrometheusPlugin, {
      register: registry,
      routeMatch: 'exact',
      excludeRoutes: ['/wp-login.php'],
    });

    // No '#fragment' case here: light-my-request drops fragments before the plugin sees the URL.
    // Fragment stripping is covered by the matchesRoute unit tests in route-filter.test.ts.
    await fastify.inject({ method: 'GET', url: '/wp-login.php?redirect=1' });
    await fastify.inject({ method: 'GET', url: '/wp-login.phpx?redirect=1' });

    expect(routeLabels(await fastify.prometheus.getMetrics())).toEqual([
      '/wp-login.phpx?redirect=1',
    ]);

    await fastify.close();
  });

  test('default substring mode still matches against the raw URL with its query string', async () => {
    const fastify = Fastify();
    await fastify.register(fastifyPrometheusPlugin, {
      register: registry,
      excludeRoutes: ['?debug'],
    });

    await fastify.inject({ method: 'GET', url: '/nope?debug=1' });
    await fastify.inject({ method: 'GET', url: '/nope?x=1' });

    expect(routeLabels(await fastify.prometheus.getMetrics())).toEqual(['/nope?x=1']);

    await fastify.close();
  });

  test('a substring exclude does not match the unmatchedRouteLabel value', async () => {
    const fastify = Fastify();
    await fastify.register(fastifyPrometheusPlugin, {
      register: registry,
      excludeRoutes: ['unmatched'],
      unmatchedRouteLabel: '__unmatched__',
    });

    await fastify.inject({ method: 'GET', url: '/api/missing' });

    expect(await fastify.prometheus.getMetrics()).toContain(
      'http_requests_total{method="GET",route="__unmatched__",status_code="404"} 1'
    );

    await fastify.close();
  });

  test('default substring matching excludes /healthcare via /health', async () => {
    const fastify = Fastify();
    await fastify.register(fastifyPrometheusPlugin, { register: registry });
    fastify.get('/healthcare', () => ({ ok: true }));

    await fastify.inject({ method: 'GET', url: '/healthcare' });

    expect(routeLabels(await fastify.prometheus.getMetrics())).not.toContain('/healthcare');

    await fastify.close();
  });

  test("routeMatch 'exact' keeps /healthcare while excluding /health", async () => {
    const fastify = Fastify();
    await fastify.register(fastifyPrometheusPlugin, { register: registry, routeMatch: 'exact' });
    fastify.get('/health', () => ({ ok: true }));
    fastify.get('/healthcare', () => ({ ok: true }));

    await fastify.inject({ method: 'GET', url: '/health' });
    await fastify.inject({ method: 'GET', url: '/healthcare' });

    const labels = routeLabels(await fastify.prometheus.getMetrics());
    expect(labels).toContain('/healthcare');
    expect(labels).not.toContain('/health');

    await fastify.close();
  });

  test('RegExp and function matchers filter requests', async () => {
    const fastify = Fastify();
    await fastify.register(fastifyPrometheusPlugin, {
      register: registry,
      includeRoutes: [/^\/api\//, (route: string) => route === '/special'],
      excludeRoutes: [/\/internal$/, (route: string) => route.endsWith('/secret')],
    });
    fastify.get('/api/users', () => ({ ok: true }));
    fastify.get('/api/internal', () => ({ ok: true }));
    fastify.get('/api/secret', () => ({ ok: true }));
    fastify.get('/special', () => ({ ok: true }));
    fastify.get('/other', () => ({ ok: true }));

    await Promise.all(
      ['/api/users', '/api/internal', '/api/secret', '/special', '/other'].map(url =>
        fastify.inject({ method: 'GET', url })
      )
    );

    expect(new Set(routeLabels(await fastify.prometheus.getMetrics()))).toEqual(
      new Set(['/api/users', '/special'])
    );

    await fastify.close();
  });

  test('per-route config { metrics: false } suppresses metrics', async () => {
    const fastify = Fastify();
    await fastify.register(fastifyPrometheusPlugin, { register: registry });
    fastify.get('/quiet', { config: { metrics: false } }, () => ({ ok: true }));
    fastify.get('/loud', { config: { metrics: true } }, () => ({ ok: true }));

    await fastify.inject({ method: 'GET', url: '/quiet' });
    await fastify.inject({ method: 'GET', url: '/loud' });

    const labels = routeLabels(await fastify.prometheus.getMetrics());
    expect(labels).toContain('/loud');
    expect(labels).not.toContain('/quiet');

    await fastify.close();
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
