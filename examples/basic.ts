/**
 * Basic usage example of the Fastify Prometheus Plugin
 */

import Fastify from 'fastify';
import fastifyPrometheusPlugin from '../src/index';

async function buildApp() {
  const fastify = Fastify({
    logger: true,
  });

  // Register the Prometheus plugin with minimal configuration
  await fastify.register(fastifyPrometheusPlugin, {
    endpoint: '/metrics',
  });

  // Sample routes
  fastify.get('/', async (request, reply) => {
    return { message: 'Hello World!' };
  });

  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    return { id, name: `User ${id}`, email: `user${id}@example.com` };
  });

  fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return fastify;
}

async function start() {
  try {
    const app = await buildApp();
    
    await app.listen({ port: 3000, host: '0.0.0.0' });
    
    console.log('🚀 Server running on http://localhost:3000');
    console.log('📊 Metrics available at http://localhost:3000/metrics');
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

export default buildApp;
