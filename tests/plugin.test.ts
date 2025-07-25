/**
 * Tests for the Fastify Prometheus Plugin
 */

import { test } from '@jest/globals';
import Fastify from 'fastify';

import fastifyPrometheusPlugin from '../src/index';

describe('Fastify Prometheus Plugin', () => {
  test('should register plugin successfully', async () => {
    const fastify = Fastify();

    await expect(fastify.register(fastifyPrometheusPlugin)).resolves.not.toThrow();

    await fastify.close();
  });

  test('should expose metrics endpoint', async () => {
    const fastify = Fastify();

    await fastify.register(fastifyPrometheusPlugin, {
      endpoint: '/metrics',
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/metrics',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/plain/);

    await fastify.close();
  });

  test('should collect HTTP metrics', async () => {
    const fastify = Fastify();

    await fastify.register(fastifyPrometheusPlugin);

    fastify.get('/test', async () => ({ message: 'test' }));

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
  });

  test('should support custom metrics', async () => {
    const fastify = Fastify();

    await fastify.register(fastifyPrometheusPlugin, {
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
      excludeRoutes: ['/excluded'],
    });

    fastify.get('/included', async () => ({ message: 'included' }));
    fastify.get('/excluded', async () => ({ message: 'excluded' }));

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

  test('should support custom histogram buckets', async () => {
    const fastify = Fastify();

    const customBuckets = [10, 50, 100, 500, 1000];

    await fastify.register(fastifyPrometheusPlugin, {
      httpMetrics: {
        requestDuration: {
          enabled: true,
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
  });

  test('should handle plugin context methods', async () => {
    const fastify = Fastify();

    await fastify.register(fastifyPrometheusPlugin, {
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
