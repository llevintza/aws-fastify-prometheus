/**
 * Tests for the Fastify Prometheus Plugin
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
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
