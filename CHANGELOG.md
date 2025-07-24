# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-07-24

### Added
- Initial release of Fastify Prometheus Metrics Plugin
- Automatic HTTP metrics collection (request duration, count, response size, error/success rates)
- Support for custom metrics (counters, gauges, histograms, summaries)
- Configurable histogram buckets and metric labels
- Route filtering (include/exclude specific routes)
- AWS CloudWatch integration for metric export
- TypeScript support with comprehensive type definitions
- Default Node.js metrics collection
- Prometheus-compatible metrics endpoint
- Comprehensive documentation and examples

### Features
- **HTTP Metrics**: Automatic collection of HTTP request metrics
- **Custom Metrics**: Support for business logic metrics
- **High Performance**: Minimal overhead metric collection
- **Configurable**: Highly customizable metric collection behavior
- **AWS Integration**: Export metrics to CloudWatch
- **TypeScript**: Full TypeScript support
- **Route Filtering**: Include/exclude routes from metrics
- **Prometheus Compatible**: Standard Prometheus format

### Configuration Options
- Customizable metrics endpoint
- Configurable histogram buckets
- Route filtering options
- Default labels for all metrics
- AWS CloudWatch integration settings
- Custom metric definitions

[Unreleased]: https://github.com/llevintza/aws-node-prometheus/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/llevintza/aws-node-prometheus/releases/tag/v1.0.0
