## 1.0.0-rc.1 (2025-07-28)


### Features

* add hotfix and release branch configurations to .releaserc.js ([9c5c4bb](https://github.com/llevintza/aws-fastify-prometheus/commit/9c5c4bb1d1e59bf37bf1d254961d8afe56e17b7c))
* update release branch configurations in .releaserc.js ([8238792](https://github.com/llevintza/aws-fastify-prometheus/commit/82387928b11847792c62ddc895e7807e0d294c57))

## [1.0.0-alpha.8](https://github.com/llevintza/aws-fastify-prometheus/compare/v1.0.0-alpha.7...v1.0.0-alpha.8) (2025-07-28)


### Features

* trigger CI pipeline to test updated package scope and GitHub PAT configuration ([2a7c87e](https://github.com/llevintza/aws-fastify-prometheus/commit/2a7c87e6426288e6a03d139f9469fb70190e9d98))
* trigger CI pipeline to test updated package scope and GitHub PAT configuration ([c3e3f56](https://github.com/llevintza/aws-fastify-prometheus/commit/c3e3f56a7f798865910ea48d2eabaf020f34ff77))

## [1.0.0-alpha.7](https://github.com/llevintza/aws-fastify-prometheus/compare/v1.0.0-alpha.6...v1.0.0-alpha.7) (2025-07-28)


### Bug Fixes

* update package scope from [@xoon](https://github.com/xoon) to [@llevintza](https://github.com/llevintza) and adjust related configurations ([1124219](https://github.com/llevintza/aws-fastify-prometheus/commit/112421971860a0dbaf67c3668e92b6495ede38da))
* update package scope from [@xoon](https://github.com/xoon) to [@llevintza](https://github.com/llevintza) in yarn.lock and add fastify-prometheus-metrics dependencies ([cdad31d](https://github.com/llevintza/aws-fastify-prometheus/commit/cdad31d10e8e5204fa6bed718211a8cb642e3015))

## [1.0.0-alpha.4](https://github.com/llevintza/aws-fastify-prometheus/compare/v1.0.0-alpha.3...v1.0.0-alpha.4) (2025-07-25)


### Bug Fixes

* update GitHub Actions to use GH_TOKEN instead of GITHUB_TOKEN ([e242c0a](https://github.com/llevintza/aws-fastify-prometheus/commit/e242c0a0d4184c72efe05a1dfbb4d879750e9932))

## [1.0.0-alpha.3](https://github.com/llevintza/aws-fastify-prometheus/compare/v1.0.0-alpha.2...v1.0.0-alpha.3) (2025-07-25)


### Bug Fixes

* update GitHub Actions permissions and use GITHUB_TOKEN for package publishing ([7a2bcc7](https://github.com/llevintza/aws-fastify-prometheus/commit/7a2bcc7fc00cbd8a5b5604fc539b25454251db49))

## [1.0.0-alpha.2](https://github.com/llevintza/aws-fastify-prometheus/compare/v1.0.0-alpha.1...v1.0.0-alpha.2) (2025-07-25)


### Features

* trigger initial alpha release for GitHub Packages publishing ([b32b221](https://github.com/llevintza/aws-fastify-prometheus/commit/b32b2216233e982df783e174cba71ae6a048b854))

## 1.0.0-alpha.1 (2025-07-25)


### Features

* add fastify-prometheus-metrics workspace dependency and update configuration ([d6b1ff7](https://github.com/llevintza/aws-fastify-prometheus/commit/d6b1ff72701cdddd5bbe09e2bec62f00c8e7b736))
* update package name and configuration for GitHub Packages ([48f1f5f](https://github.com/llevintza/aws-fastify-prometheus/commit/48f1f5f219d332ac504dc08f8c296275d0c249d0))


### Bug Fixes

* update GitHub token reference in CI workflow ([b284543](https://github.com/llevintza/aws-fastify-prometheus/commit/b284543ab2782daff5347b1861e3cc4af2548f8a))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Package name changed from `fastify-prometheus-metrics` to `@xoon/fastify-prometheus-metrics`
- Publishing configuration updated to use GitHub Packages with `@xoon` scope
- Documentation updated to reflect new package name and installation instructions
- Added automated CI/CD pipeline with semantic-release for GitHub Packages
- Implemented trunk-based development with prerelease support
- Initial release will be `0.0.1-alpha` version
- Created comprehensive branching and release strategy documentation
- Updated contributing guidelines for trunk-based development workflow

### Added
- Branching strategy documentation (`docs/BRANCHING_STRATEGY.md`)
- Support for alpha releases from `feature/*` branches
- Support for beta releases from `release/*` branches
- Automated semantic versioning and publishing

## [0.0.0] - 2025-07-24

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

[Unreleased]: https://github.com/llevintza/aws-fastify-prometheus/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/llevintza/aws-fastify-prometheus/releases/tag/v1.0.0
