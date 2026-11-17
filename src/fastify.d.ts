/**
 * TypeScript declaration file for Fastify Prometheus Metrics Plugin
 */

import type { FastifyPrometheusContext } from './types';

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * Prometheus metrics context with methods for custom metrics
     */
    prometheus: FastifyPrometheusContext;
  }

  interface FastifyRequest {
    /**
     * Request start time (`process.hrtime.bigint()`) for duration calculation
     * @internal
     */
    startTime?: bigint;
  }
}
