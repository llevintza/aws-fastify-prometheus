/**
 * Tests for the Fastify Prometheus Plugin
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { trace } from '@opentelemetry/api';
import Fastify from 'fastify';
import { Registry } from 'prom-client';

import fastifyPrometheusPlugin from '../src/index';

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
