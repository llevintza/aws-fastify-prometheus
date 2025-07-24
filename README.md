# Fastify Prometheus Metrics Plugin

A comprehensive Fastify plugin for collecting and exporting Prometheus metrics with optional AWS CloudWatch integration.

[![npm version](https://badge.fury.io/js/fastify-prometheus-metrics.svg)](https://badge.fury.io/js/fastify-prometheus-metrics)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

## Features

- 📊 **Automatic HTTP Metrics Collection**: Request duration, count, response size, error/success rates
- 🎯 **Customizable Metrics**: Define your own business logic metrics (counters, gauges, histograms, summaries)
- ⚡ **High Performance**: Minimal overhead with efficient metric collection
- 🔧 **Highly Configurable**: Customize histogram buckets, labels, and collection behavior
- ☁️ **AWS CloudWatch Integration**: Export metrics to CloudWatch for centralized monitoring
- 🛡️ **TypeScript First**: Full TypeScript support with comprehensive type definitions
- 🔍 **Route Filtering**: Include/exclude specific routes from metrics collection
- 📈 **Prometheus Compatible**: Standard Prometheus metrics format

## Installation

```bash
npm install fastify-prometheus-metrics
# or
yarn add fastify-prometheus-metrics
# or
pnpm add fastify-prometheus-metrics
```

> **Note for Contributors**: This project is maintained using Yarn, but users can install it with any package manager (npm, yarn, pnpm).

## Quick Start

### Basic Setup

```typescript
import Fastify from 'fastify';
import fastifyPrometheusPlugin from 'fastify-prometheus-metrics';

const fastify = Fastify();

// Register the plugin with default configuration
await fastify.register(fastifyPrometheusPlugin);

// Your routes
fastify.get('/hello', async (request, reply) => {
  return { hello: 'world' };
});

// Start the server
await fastify.listen({ port: 3000 });

// Metrics will be available at http://localhost:3000/metrics
```

### Advanced Configuration

```typescript
import Fastify from 'fastify';
import fastifyPrometheusPlugin from 'fastify-prometheus-metrics';

const fastify = Fastify();

await fastify.register(fastifyPrometheusPlugin, {
  // Metrics endpoint (default: '/metrics')
  endpoint: '/metrics',
  
  // Enable Node.js default metrics (default: true)
  enableDefaultMetrics: true,
  
  // Default metrics collection interval (default: 10000ms)
  defaultMetricsInterval: 5000,
  
  // Exclude routes from metrics collection
  excludeRoutes: ['/health', '/metrics'],
  
  // Only include specific routes (optional)
  includeRoutes: ['/api/*'],
  
  // Add default labels to all metrics
  defaultLabels: {
    service: 'my-api',
    version: '1.0.0',
  },
  
  // Configure HTTP metrics
  httpMetrics: {
    requestDuration: {
      enabled: true,
      name: 'http_request_duration_ms',
      help: 'Request duration in milliseconds',
      buckets: [1, 5, 15, 50, 100, 500, 1000, 5000], // Custom buckets
      labels: ['method', 'route', 'status_code'],
    },
    requestCount: {
      enabled: true,
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labels: ['method', 'route', 'status_code'],
    },
    responseSize: {
      enabled: true,
      buckets: [100, 1000, 10000, 100000], // Custom response size buckets
    },
    errorCount: { enabled: true },
    successCount: { enabled: true },
  },
  
  // Define custom metrics
  customMetrics: [
    {
      type: 'counter',
      name: 'business_operations_total',
      help: 'Total business operations performed',
      labels: ['operation_type', 'user_id'],
    },
    {
      type: 'histogram',
      name: 'database_query_duration_ms',
      help: 'Database query execution time',
      labels: ['query_type', 'table'],
      config: {
        buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
      },
    },
    {
      type: 'gauge',
      name: 'active_connections',
      help: 'Number of active database connections',
    },
  ],
  
  // AWS CloudWatch integration (optional)
  awsCloudWatch: {
    region: 'us-east-1',
    namespace: 'MyApp/API',
    batchSize: 20,
    flushInterval: 60000, // 1 minute
  },
});
```

## Using Custom Metrics

Once the plugin is registered, you can access custom metrics through the `fastify.prometheus` object:

```typescript
// In your route handlers
fastify.get('/api/users', async (request, reply) => {
  const startTime = Date.now();
  
  try {
    // Your business logic
    const users = await getUsersFromDatabase();
    
    // Increment success counter
    fastify.prometheus.incrementCounter('business_operations_total', {
      operation_type: 'get_users',
      user_id: request.user?.id || 'anonymous',
    });
    
    // Record database query time
    const queryTime = Date.now() - startTime;
    fastify.prometheus.observeHistogram('database_query_duration_ms', queryTime, {
      query_type: 'select',
      table: 'users',
    });
    
    return users;
  } catch (error) {
    // Handle errors...
    throw error;
  }
});

// Update gauge metrics
fastify.addHook('onReady', async () => {
  setInterval(() => {
    const activeConnections = getActiveConnectionCount();
    fastify.prometheus.setGauge('active_connections', activeConnections);
  }, 5000);
});
```

## Plugin API

The plugin adds a `prometheus` object to your Fastify instance with the following methods:

### `getMetrics(): Promise<string>`

Returns all metrics in Prometheus format.

```typescript
const metrics = await fastify.prometheus.getMetrics();
console.log(metrics);
```

### `clearMetrics(): void`

Clears all metrics from the registry.

```typescript
fastify.prometheus.clearMetrics();
```

### `incrementCounter(name: string, labels?: MetricLabels, value?: number): void`

Increments a counter metric.

```typescript
fastify.prometheus.incrementCounter('my_counter', { label: 'value' }, 1);
```

### `setGauge(name: string, value: number, labels?: MetricLabels): void`

Sets a gauge metric value.

```typescript
fastify.prometheus.setGauge('active_users', 42, { server: 'api-1' });
```

### `observeHistogram(name: string, value: number, labels?: MetricLabels): void`

Records a histogram observation.

```typescript
fastify.prometheus.observeHistogram('request_size', 1024, { endpoint: '/api/data' });
```

### `observeSummary(name: string, value: number, labels?: MetricLabels): void`

Records a summary observation.

```typescript
fastify.prometheus.observeSummary('processing_time', 150.5, { type: 'batch' });
```

## Default HTTP Metrics

The plugin automatically collects the following HTTP metrics:

| Metric Name | Type | Description | Labels |
|-------------|------|-------------|---------|
| `http_request_duration_ms` | Histogram | Request duration in milliseconds | `method`, `route`, `status_code` |
| `http_requests_total` | Counter | Total number of HTTP requests | `method`, `route`, `status_code` |
| `http_response_size_bytes` | Histogram | Response size in bytes | `method`, `route`, `status_code` |
| `http_errors_total` | Counter | Total number of HTTP errors (4xx, 5xx) | `method`, `route`, `status_code` |
| `http_success_total` | Counter | Total number of successful requests (2xx, 3xx) | `method`, `route`, `status_code` |

## AWS CloudWatch Integration

When AWS CloudWatch integration is enabled, metrics are automatically exported to CloudWatch in addition to being available at the Prometheus endpoint.

```typescript
await fastify.register(fastifyPrometheusPlugin, {
  awsCloudWatch: {
    region: 'us-east-1',
    namespace: 'MyApp/Production',
    batchSize: 20,          // Metrics per batch
    flushInterval: 60000,   // Flush every minute
    credentials: {          // Optional: custom credentials
      accessKeyId: 'your-access-key',
      secretAccessKey: 'your-secret-key',
    },
  },
});
```

## Configuration Options

### `FastifyPrometheusOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | `string` | `'/metrics'` | Metrics endpoint path |
| `enableDefaultMetrics` | `boolean` | `true` | Enable Node.js default metrics |
| `defaultMetricsInterval` | `number` | `10000` | Default metrics collection interval (ms) |
| `httpMetrics` | `HttpMetricsConfig` | See defaults | HTTP metrics configuration |
| `customMetrics` | `CustomMetricDefinition[]` | `[]` | Custom metrics definitions |
| `awsCloudWatch` | `AwsExporterConfig` | `undefined` | AWS CloudWatch integration |
| `excludeRoutes` | `string[]` | `['/health', '/healthcheck']` | Routes to exclude |
| `includeRoutes` | `string[]` | `undefined` | Routes to include (if specified, only these routes are included) |
| `defaultLabels` | `Record<string, string>` | `{}` | Default labels for all metrics |

## TypeScript Support

This plugin is written in TypeScript and provides comprehensive type definitions:

```typescript
import fastifyPrometheusPlugin, {
  FastifyPrometheusOptions,
  FastifyPrometheusContext,
  MetricLabels,
} from 'fastify-prometheus-metrics';

// Type-safe configuration
const config: FastifyPrometheusOptions = {
  endpoint: '/metrics',
  httpMetrics: {
    requestDuration: {
      enabled: true,
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
    },
  },
};

// Access the prometheus context with full type support
fastify.prometheus.incrementCounter('my_counter', { label: 'value' });
```

## Performance Considerations

- The plugin uses efficient metric collection with minimal performance overhead
- HTTP metrics are collected using Fastify hooks for optimal performance
- Default metrics collection can be disabled if not needed
- Route filtering helps reduce metric cardinality
- Histogram buckets should be carefully chosen to balance accuracy and performance

## Best Practices

1. **Metric Naming**: Follow Prometheus naming conventions (`snake_case`, descriptive names)
2. **Label Cardinality**: Keep the number of unique label combinations reasonable to avoid high cardinality
3. **Histogram Buckets**: Choose buckets that make sense for your use case
4. **Route Filtering**: Exclude health check and internal routes from metrics
5. **Custom Metrics**: Define custom metrics that provide business value

## Examples

Check out the [examples](./examples) directory for complete working examples:

- [Basic Setup](./examples/basic.ts)
- [Advanced Configuration](./examples/advanced.ts)
- [Custom Metrics](./examples/custom-metrics.ts)
- [AWS CloudWatch Integration](./examples/aws-integration.ts)

## Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Development Setup

This project uses Yarn for package management and development workflows.

#### Prerequisites

- **Node.js**: Version 20.0.0 or higher (we recommend using the latest LTS version)
- **Yarn**: Version 4.6.0 (managed via Corepack)

#### Getting Started

```bash
# Clone the repository
git clone https://github.com/llevintza/aws-node-prometheus.git
cd aws-node-prometheus

# If you use nvm, set the correct Node.js version
nvm use

# Enable Corepack to use the correct Yarn version
corepack enable

# Install dependencies
yarn install

# Run tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run linting
yarn lint

# Fix linting issues
yarn lint:fix

# Format code
yarn format

# Check formatting
yarn format:check

# Build the project
yarn build

# Build in watch mode
yarn build:watch

# Type checking
yarn type-check
```

### Scripts

- `yarn build` - Build the TypeScript project
- `yarn build:watch` - Build in watch mode
- `yarn clean` - Clean the dist directory
- `yarn dev` - Run development server
- `yarn test` - Run all tests
- `yarn test:watch` - Run tests in watch mode
- `yarn test:coverage` - Run tests with coverage
- `yarn lint` - Run ESLint
- `yarn lint:fix` - Fix ESLint issues
- `yarn format` - Format code with Prettier
- `yarn format:check` - Check code formatting

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/llevintza/aws-node-prometheus#readme)
- 🐛 [Issue Tracker](https://github.com/llevintza/aws-node-prometheus/issues)
- 💬 [Discussions](https://github.com/llevintza/aws-node-prometheus/discussions)

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a list of changes and version history.
