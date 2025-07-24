/**
 * Advanced configuration example with custom metrics and AWS integration
 */

import Fastify from 'fastify';
import fastifyPrometheusPlugin from '../src/index';

async function buildApp() {
  const fastify = Fastify({
    logger: true,
  });

  // Register the Prometheus plugin with advanced configuration
  await fastify.register(fastifyPrometheusPlugin, {
    endpoint: '/metrics',
    enableDefaultMetrics: true,
    defaultMetricsInterval: 5000,
    
    // Exclude health checks from metrics
    excludeRoutes: ['/health', '/metrics'],
    
    // Add default labels to all metrics
    defaultLabels: {
      service: 'my-api',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    },
    
    // Configure HTTP metrics with custom buckets
    httpMetrics: {
      requestDuration: {
        enabled: true,
        name: 'http_request_duration_ms',
        help: 'HTTP request duration in milliseconds',
        buckets: [1, 5, 15, 50, 100, 200, 300, 400, 500, 1000, 2000, 5000],
        labels: ['method', 'route', 'status_code'],
      },
      requestCount: {
        enabled: true,
        name: 'http_requests_total',
        help: 'Total number of HTTP requests',
        labels: ['method', 'route', 'status_code'],
      },
      responseSize: {
        enabled: true,
        name: 'http_response_size_bytes',
        help: 'HTTP response size in bytes',
        buckets: [100, 1000, 10000, 100000, 1000000],
        labels: ['method', 'route', 'status_code'],
      },
      errorCount: {
        enabled: true,
        name: 'http_errors_total',
        help: 'Total number of HTTP errors',
        labels: ['method', 'route', 'status_code', 'error_type'],
      },
      successCount: {
        enabled: true,
        name: 'http_success_total',
        help: 'Total number of successful HTTP requests',
        labels: ['method', 'route', 'status_code'],
      },
    },
    
    // Define custom business metrics
    customMetrics: [
      {
        type: 'counter',
        name: 'business_operations_total',
        help: 'Total business operations performed',
        labels: ['operation_type', 'user_type', 'status'],
      },
      {
        type: 'histogram',
        name: 'database_query_duration_ms',
        help: 'Database query execution time in milliseconds',
        labels: ['query_type', 'table', 'operation'],
        config: {
          buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
        },
      },
      {
        type: 'gauge',
        name: 'active_connections_total',
        help: 'Number of active database connections',
        labels: ['pool', 'database'],
      },
      {
        type: 'summary',
        name: 'cache_hit_ratio',
        help: 'Cache hit ratio summary',
        labels: ['cache_type', 'key_pattern'],
        config: {
          percentiles: [0.5, 0.9, 0.95, 0.99],
          maxAgeSeconds: 600,
          ageBuckets: 5,
        },
      },
    ],
    
    // AWS CloudWatch integration (uncomment to enable)
    /*
    awsCloudWatch: {
      region: process.env.AWS_REGION || 'us-east-1',
      namespace: 'MyApp/Production',
      batchSize: 20,
      flushInterval: 60000, // 1 minute
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    },
    */
  });

  // Simulate database connection pool monitoring
  let activeConnections = 0;
  setInterval(() => {
    // Simulate connection count changes
    activeConnections = Math.floor(Math.random() * 20) + 5;
    fastify.prometheus.setGauge('active_connections_total', activeConnections, {
      pool: 'main',
      database: 'users',
    });
  }, 5000);

  // Routes with custom metrics
  fastify.get('/', async (request, reply) => {
    return { message: 'Hello World!', timestamp: new Date().toISOString() };
  });

  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const startTime = Date.now();
    
    try {
      // Simulate database query
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 10));
      
      // Record database query metrics
      const queryDuration = Date.now() - startTime;
      fastify.prometheus.observeHistogram('database_query_duration_ms', queryDuration, {
        query_type: 'select',
        table: 'users',
        operation: 'find_by_id',
      });
      
      // Record business operation
      fastify.prometheus.incrementCounter('business_operations_total', {
        operation_type: 'user_lookup',
        user_type: 'registered',
        status: 'success',
      });
      
      // Simulate cache hit ratio
      const cacheHit = Math.random() > 0.3; // 70% cache hit rate
      fastify.prometheus.observeSummary('cache_hit_ratio', cacheHit ? 1 : 0, {
        cache_type: 'redis',
        key_pattern: 'user:*',
      });
      
      return {
        id,
        name: `User ${id}`,
        email: `user${id}@example.com`,
        cached: cacheHit,
      };
    } catch (error) {
      // Record failed operation
      fastify.prometheus.incrementCounter('business_operations_total', {
        operation_type: 'user_lookup',
        user_type: 'registered',
        status: 'error',
      });
      
      throw error;
    }
  });

  fastify.post('/users', async (request, reply) => {
    const startTime = Date.now();
    
    try {
      // Simulate user creation
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));
      
      const queryDuration = Date.now() - startTime;
      fastify.prometheus.observeHistogram('database_query_duration_ms', queryDuration, {
        query_type: 'insert',
        table: 'users',
        operation: 'create',
      });
      
      fastify.prometheus.incrementCounter('business_operations_total', {
        operation_type: 'user_creation',
        user_type: 'new',
        status: 'success',
      });
      
      reply.status(201);
      return { id: Date.now(), message: 'User created successfully' };
    } catch (error) {
      fastify.prometheus.incrementCounter('business_operations_total', {
        operation_type: 'user_creation',
        user_type: 'new',
        status: 'error',
      });
      
      throw error;
    }
  });

  // Batch operation endpoint
  fastify.post('/users/batch', async (request, reply) => {
    const body = request.body as { users?: any[] };
    const users = body.users || [];
    const startTime = Date.now();
    
    try {
      // Simulate batch processing
      await new Promise(resolve => setTimeout(resolve, users.length * 10 + 100));
      
      const processingTime = Date.now() - startTime;
      fastify.prometheus.observeHistogram('database_query_duration_ms', processingTime, {
        query_type: 'batch_insert',
        table: 'users',
        operation: 'batch_create',
      });
      
      fastify.prometheus.incrementCounter('business_operations_total', {
        operation_type: 'batch_processing',
        user_type: 'bulk',
        status: 'success',
      }, users.length);
      
      return { processed: users.length, duration: processingTime };
    } catch (error) {
      fastify.prometheus.incrementCounter('business_operations_total', {
        operation_type: 'batch_processing',
        user_type: 'bulk',
        status: 'error',
      });
      
      throw error;
    }
  });

  // Health check (excluded from metrics)
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      connections: activeConnections,
    };
  });

  // Custom metrics endpoint for debugging
  fastify.get('/debug/metrics', async (request, reply) => {
    const metrics = await fastify.prometheus.getMetrics();
    reply.type('text/plain');
    return metrics;
  });

  return fastify;
}

async function start() {
  try {
    const app = await buildApp();
    
    await app.listen({ port: 3000, host: '0.0.0.0' });
    
    console.log('🚀 Server running on http://localhost:3000');
    console.log('📊 Metrics available at http://localhost:3000/metrics');
    console.log('🔍 Debug metrics at http://localhost:3000/debug/metrics');
    console.log('🏥 Health check at http://localhost:3000/health');
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

export default buildApp;
