# Development Guide

This document provides information for developers who want to contribute to or work with the `@xoon/fastify-prometheus-metrics` plugin.

## Prerequisites

- **Node.js**: Version 20.0.0 or higher (latest LTS recommended)
- **Yarn**: Version 4.6.0 (managed via Corepack)

## Package Manager

This project is **maintained using Yarn**, but it's designed to work with any package manager. Users can install and use this package with npm, yarn, or pnpm.

### For Contributors (Using Yarn)

If you're contributing to this project, please use Yarn to ensure consistency:

```bash
# Set up the correct Node.js version (if using nvm)
nvm use

# Enable Corepack to use the correct Yarn version
corepack enable

# Install dependencies
yarn install

# Run tests
yarn test

# Build the project
yarn build

# Run linting
yarn lint
```

### For Users (Any Package Manager)

Users can install and use this package with their preferred package manager:

```bash
# npm
npm install fastify-prometheus-metrics

# yarn
yarn add fastify-prometheus-metrics

# pnpm
pnpm add fastify-prometheus-metrics
```

## Project Structure

```
├── src/                    # Source code
│   ├── plugin.ts          # Main Fastify plugin
│   ├── types.ts           # TypeScript definitions
│   ├── aws-metrics-exporter.ts  # AWS CloudWatch integration
│   ├── prometheus-metrics.ts    # Prometheus metrics handling
│   ├── metrics-collector.ts     # Metrics collection utilities
│   ├── fastify.d.ts       # Fastify type declarations
│   └── index.ts           # Main entry point
├── tests/                 # Test files
├── examples/              # Usage examples
├── docs/                  # Documentation
└── dist/                  # Compiled output (generated)
```

## Development Workflow

### 1. Setup

```bash
git clone https://github.com/llevintza/aws-node-prometheus.git
cd aws-node-prometheus
yarn install
```

### 2. Development Commands

| Command | Description |
|---------|-------------|
| `yarn build` | Compile TypeScript to JavaScript |
| `yarn build:watch` | Compile in watch mode |
| `yarn clean` | Remove compiled files |
| `yarn dev` | Run development server |
| `yarn test` | Run all tests |
| `yarn test:watch` | Run tests in watch mode |
| `yarn test:coverage` | Run tests with coverage |
| `yarn lint` | Run ESLint |
| `yarn lint:fix` | Fix linting issues |
| `yarn format` | Format code with Prettier |
| `yarn format:check` | Check code formatting |
| `yarn type-check` | Run TypeScript type checking |

### 3. Testing

We use Jest for testing:

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:coverage

# Run specific test file
yarn test tests/plugin.test.ts
```

### 4. Code Quality

The project uses several tools to maintain code quality:

- **ESLint**: For code linting
- **Prettier**: For code formatting
- **TypeScript**: For type checking
- **Husky**: For git hooks
- **lint-staged**: For pre-commit linting

### 5. Pre-commit Hooks

The project is configured with pre-commit hooks that will:

1. Run Prettier on staged files
2. Run ESLint on staged files
3. Fix issues automatically where possible

## Architecture

### Plugin Structure

The plugin is built using Fastify's plugin system:

1. **Main Plugin** (`plugin.ts`): Core plugin logic and registration
2. **Types** (`types.ts`): TypeScript definitions and interfaces
3. **AWS Exporter** (`aws-metrics-exporter.ts`): CloudWatch integration
4. **Prometheus Metrics** (`prometheus-metrics.ts`): Prometheus client wrapper
5. **Metrics Collector** (`metrics-collector.ts`): Collection utilities

### Key Features

- **Automatic HTTP Metrics**: Collects request duration, count, response size, etc.
- **Custom Metrics**: Supports counters, gauges, histograms, and summaries
- **Route Filtering**: Include/exclude specific routes
- **AWS Integration**: Export metrics to CloudWatch
- **TypeScript Support**: Full type definitions
- **High Performance**: Minimal overhead

## API Design

The plugin follows Fastify's plugin patterns:

```typescript
// Plugin registration
await fastify.register(fastifyPrometheusPlugin, options);

// Plugin API
fastify.prometheus.incrementCounter('my_counter');
fastify.prometheus.setGauge('my_gauge', 42);
fastify.prometheus.observeHistogram('my_histogram', 100);
```

## Configuration

The plugin is highly configurable:

```typescript
interface FastifyPrometheusOptions {
  endpoint?: string;
  enableDefaultMetrics?: boolean;
  httpMetrics?: HttpMetricsConfig;
  customMetrics?: CustomMetricDefinition[];
  awsCloudWatch?: AwsExporterConfig;
  // ... more options
}
```

## Publishing

The project uses semantic-release for automated publishing:

1. Commits follow conventional commit format
2. Releases are automated based on commit messages
3. Version numbers follow semantic versioning
4. Changelog is automatically generated

### Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Examples:
- `feat: add custom histogram buckets configuration`
- `fix: resolve memory leak in metric collection`
- `docs: update README with new examples`

## Troubleshooting

### Common Issues

1. **TypeScript Errors**: Run `yarn type-check` to see all type issues
2. **Test Failures**: Check if all dependencies are installed with `yarn install`
3. **Build Issues**: Clean and rebuild with `yarn clean && yarn build`
4. **Linting Errors**: Fix with `yarn lint:fix`

### Debug Mode

Set environment variables for debugging:

```bash
DEBUG=fastify-prometheus-metrics yarn dev
NODE_ENV=development yarn test
```

## Performance Considerations

- Metrics collection has minimal overhead (~1-2ms per request)
- Default metrics are collected every 10 seconds
- Histogram buckets should be chosen carefully
- Route filtering helps reduce metric cardinality

## Contributing Guidelines

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Use conventional commit messages
5. Ensure all checks pass before submitting PR

## Support

- 📖 [Documentation](https://github.com/llevintza/aws-node-prometheus#readme)
- 🐛 [Issue Tracker](https://github.com/llevintza/aws-node-prometheus/issues)
- 💬 [Discussions](https://github.com/llevintza/aws-node-prometheus/discussions)
