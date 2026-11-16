## [2.0.0](https://github.com/llevintza/aws-fastify-prometheus/compare/v1.0.2...v2.0.0) (2026-11-16)

### ⚠ BREAKING CHANGES

* **engines:** minimum supported Node.js is now 22.0.0; Node 20 is no longer supported.

Co-authored-by: Claude Opus 4.8 <noreply@anthropic.com>

### Features

* **engines:** add Node.js 26 LTS to CI and the dev toolchain ([f066b69](https://github.com/llevintza/aws-fastify-prometheus/commit/f066b69167c8abb3c847836b25f36a08344035bf))
* **release:** bump versions from Dependabot contract impact ([a6dbe92](https://github.com/llevintza/aws-fastify-prometheus/commit/a6dbe92387f39c80d877036aca7b68daac129d71))
* **engines:** require node >=22 and target es2022 ([#185](https://github.com/llevintza/aws-fastify-prometheus/issues/185)) ([4feddd0](https://github.com/llevintza/aws-fastify-prometheus/commit/4feddd0c76898149a64cdb396ed25d6ab7e50106))

### Bug Fixes

* **ci:** accept app/dependabot as Dependabot PR author ([7ff5548](https://github.com/llevintza/aws-fastify-prometheus/commit/7ff554891788b41e1157ddbc676478184876e7e0))
* align plugin with Fastify 5 APIs after major bump ([fea8d75](https://github.com/llevintza/aws-fastify-prometheus/commit/fea8d756ea6d10cca0b09dd0b1edbbedb162e054))
* **ci:** auto-merge all Dependabot PRs after CI Success ([d5c03e1](https://github.com/llevintza/aws-fastify-prometheus/commit/d5c03e101d0e0313f25ec5c5c67e4ed6769683fb))
* **ci:** consolidate Dependabot auto-merge into one reliable workflow ([fe4f18f](https://github.com/llevintza/aws-fastify-prometheus/commit/fe4f18fb1f9e42c71615f346233fb7f43a7245ba))
* Implement code changes to enhance functionality and improve performance ([#16](https://github.com/llevintza/aws-fastify-prometheus/issues/16)) ([1cd8b43](https://github.com/llevintza/aws-fastify-prometheus/commit/1cd8b434acfa6d0ddb898b226cb7cfe0425f38be))
* **release:** keep husky output out of npm pack stdout ([7a17d5b](https://github.com/llevintza/aws-fastify-prometheus/commit/7a17d5bb17a9f87922f7d73796b7745e9cb29a71)), closes [#186](https://github.com/llevintza/aws-fastify-prometheus/issues/186)
* **release:** pin conventionalcommits preset to v9 for semantic-release ([627f3a4](https://github.com/llevintza/aws-fastify-prometheus/commit/627f3a4168c3d5d3d4b5865ac203079c6eece75d))
* **ci:** resolve auto-merge conflict onto workflow_run ([8b5d028](https://github.com/llevintza/aws-fastify-prometheus/commit/8b5d0281ea8ed3d594516dd783c6fc7d8721baa4))
* **ci:** run Dependabot auto-merge based on PR author ([844d4a4](https://github.com/llevintza/aws-fastify-prometheus/commit/844d4a463c015b4587b94dac7e0276700ec70319))
* **ci:** set GH_REPO for Dependabot gh commands without checkout ([c16ef4d](https://github.com/llevintza/aws-fastify-prometheus/commit/c16ef4d8b2554b8add8c195e5818bd5f9fa5c45e))
* **ci:** trigger Dependabot auto-merge via workflow_run ([6c5497c](https://github.com/llevintza/aws-fastify-prometheus/commit/6c5497caa109acbdd42d221401f7d3bc7cecb66c))
* **ci:** wait long enough for CI Success to appear ([9bd9869](https://github.com/llevintza/aws-fastify-prometheus/commit/9bd98697ddf145b3a18c00c48a32d4565e425240))

### Documentation

* add research backing for dep-aware package semver ([8a7596a](https://github.com/llevintza/aws-fastify-prometheus/commit/8a7596a9f0bd4d527296f0bf074c02619b28eeeb))
* document main-only releases and stacked Dependabot flow ([c32cf9e](https://github.com/llevintza/aws-fastify-prometheus/commit/c32cf9e628437ac6d0084791e48efea806692148))

### Miscellaneous Chores

* **deps-dev)(deps-dev:** bump @commitlint/config-conventional from 18.6.3 to 19.8.1 ([#23](https://github.com/llevintza/aws-fastify-prometheus/issues/23)) ([ff59380](https://github.com/llevintza/aws-fastify-prometheus/commit/ff59380f49b769518ca4945fc3ecf264f288d797))
* **deps-dev)(deps-dev:** bump @jest/globals from 29.7.0 to 30.0.5 ([#11](https://github.com/llevintza/aws-fastify-prometheus/issues/11)) ([ad25a39](https://github.com/llevintza/aws-fastify-prometheus/commit/ad25a3901f86e901e6bb98a21f9c6391fa0dc43d))
* **deps)(deps:** bump @jridgewell/sourcemap-codec from 1.5.4 to 1.6.0 ([1678b19](https://github.com/llevintza/aws-fastify-prometheus/commit/1678b194bc7eb511e5c61e6126c554a64e24236a))
* **deps-dev)(deps-dev:** bump @types/jest from 29.5.14 to 30.0.0 ([#29](https://github.com/llevintza/aws-fastify-prometheus/issues/29)) ([19f7de5](https://github.com/llevintza/aws-fastify-prometheus/commit/19f7de534199361ebf35fab30d053ce375c03667))
* **deps-dev:** bump @types/node from 22.17.0 to 24.2.1 in the node-ecosystem group ([#33](https://github.com/llevintza/aws-fastify-prometheus/issues/33)) ([6c9561f](https://github.com/llevintza/aws-fastify-prometheus/commit/6c9561fb46579283e760a840069c08f65c523831))
* **deps-dev)(deps-dev:** bump @typescript-eslint/eslint-plugin ([#19](https://github.com/llevintza/aws-fastify-prometheus/issues/19)) ([578ffad](https://github.com/llevintza/aws-fastify-prometheus/commit/578ffad1fcdfe743ece90e4bf96922d3064ce24c))
* **ci)(deps:** bump actions/checkout ([3eeab04](https://github.com/llevintza/aws-fastify-prometheus/commit/3eeab049a0a6ee1289630e9fdf17c2e432ef9cc6))
* **ci)(deps:** bump actions/download-artifact from 4 to 5 ([#25](https://github.com/llevintza/aws-fastify-prometheus/issues/25)) ([56e3deb](https://github.com/llevintza/aws-fastify-prometheus/commit/56e3deb5be589c59622a5fe8e9e8a38cd84e5687))
* **deps)(deps:** bump caniuse-lite from 1.0.30001731 to 1.0.30001751 ([d16fcf1](https://github.com/llevintza/aws-fastify-prometheus/commit/d16fcf1e1846d61d4771d6b37449f775fcf538f8))
* **ci)(deps:** bump codecov/codecov-action from 4 to 5 ([#22](https://github.com/llevintza/aws-fastify-prometheus/issues/22)) ([bd64377](https://github.com/llevintza/aws-fastify-prometheus/commit/bd6437714bd69f58185d641c85281c1f1dcb013d))
* **ci)(deps:** bump codecov/codecov-action from 5 to 7 ([e0f4f3a](https://github.com/llevintza/aws-fastify-prometheus/commit/e0f4f3a8ed6531d9a347efa901926fae9bac59a9))
* **deps)(deps:** bump electron-to-chromium from 1.5.194 to 1.5.240 ([c79345c](https://github.com/llevintza/aws-fastify-prometheus/commit/c79345cdbf6ecc3087b3f8b3b3055555fa52e04e))
* **deps-dev)(deps-dev:** bump eslint from 8.57.1 to 9.32.0 ([#13](https://github.com/llevintza/aws-fastify-prometheus/issues/13)) ([b946507](https://github.com/llevintza/aws-fastify-prometheus/commit/b9465077e37e6028967903e314c6f2b3aea8f307))
* **deps-dev)(deps-dev:** bump eslint-config-prettier ([#28](https://github.com/llevintza/aws-fastify-prometheus/issues/28)) ([176dcde](https://github.com/llevintza/aws-fastify-prometheus/commit/176dcdedf4f563131508b8d5250df583d5b9dbb9))
* **deps)(deps:** bump fastify-plugin from 4.5.1 to 5.0.1 ([#20](https://github.com/llevintza/aws-fastify-prometheus/issues/20)) ([c8ed7fa](https://github.com/llevintza/aws-fastify-prometheus/commit/c8ed7fa95dae3f927b357c3ea3bdcf4bab6fe367))
* **deps)(deps:** bump fastify-plugin ([52f3197](https://github.com/llevintza/aws-fastify-prometheus/commit/52f319792ea290914afde4f6bb24e5281bb3a422))
* **deps)(deps:** bump fs-extra from 11.3.0 to 11.3.2 ([045cd23](https://github.com/llevintza/aws-fastify-prometheus/commit/045cd23bbe2e18f9938ff94ac815e8faaeb61bc9))
* **ci)(deps:** bump github/codeql-action from 3 to 4 ([4cd6ac6](https://github.com/llevintza/aws-fastify-prometheus/commit/4cd6ac6abf3075e6df0801dbc0621410561c55e6))
* **deps-dev)(deps-dev:** bump husky from 8.0.3 to 9.1.7 ([#12](https://github.com/llevintza/aws-fastify-prometheus/issues/12)) ([f9970c2](https://github.com/llevintza/aws-fastify-prometheus/commit/f9970c2789500199fbf7e3b3615301dc53b46566))
* **deps)(deps:** bump istanbul-reports from 3.1.7 to 3.2.0 ([522ea73](https://github.com/llevintza/aws-fastify-prometheus/commit/522ea73ef50a3bc2745cd4b13058703d3ddfe475))
* **deps)(deps:** bump jsonfile from 6.1.0 to 6.2.0 ([721300b](https://github.com/llevintza/aws-fastify-prometheus/commit/721300b412872485f45f4729fd28b817f3042195))
* **deps-dev)(deps-dev:** bump rimraf from 5.0.10 to 6.0.1 ([#27](https://github.com/llevintza/aws-fastify-prometheus/issues/27)) ([471e3ee](https://github.com/llevintza/aws-fastify-prometheus/commit/471e3eea28eb6629d7af534a6a06bee26289cab8))
* **deps)(deps:** bump spdx-license-ids from 3.0.21 to 3.0.22 ([ee5f063](https://github.com/llevintza/aws-fastify-prometheus/commit/ee5f06325ce9de11f353dcdbdc510358dd56f29b))
* **deps)(deps:** bump the aws-ecosystem group across 1 directory with 13 updates ([c8bef3e](https://github.com/llevintza/aws-fastify-prometheus/commit/c8bef3eb213e59b38566595c095821d95e2ddeb6))
* **ci)(deps:** bump the dependency-actions group with 2 updates ([f5ca902](https://github.com/llevintza/aws-fastify-prometheus/commit/f5ca902c887de1f9d6946e8e8fd1220a9d7d4c2f))
* **ci)(deps:** bump the dependency-actions group with 2 updates ([17c8d19](https://github.com/llevintza/aws-fastify-prometheus/commit/17c8d1909ff99a594c6412c1fc026db13375521e))
* **deps)(deps:** bump the fastify-ecosystem group across 1 directory with 7 updates ([ce54d12](https://github.com/llevintza/aws-fastify-prometheus/commit/ce54d1251d372b0d54cca3b4a0b2092804258706))
* **deps)(deps:** bump the fastify-ecosystem-major group with 5 updates ([012b317](https://github.com/llevintza/aws-fastify-prometheus/commit/012b317ab6ddc8c2e98cfa3942410ccd4f8693db))
* **ci)(deps:** bump the github-actions-official group across 1 directory with 5 updates ([bc4e1e0](https://github.com/llevintza/aws-fastify-prometheus/commit/bc4e1e0911a1b52ccf241d943afaeada3bbe09f6))
* **ci)(deps:** bump the github-actions-official group with 5 updates ([7738b13](https://github.com/llevintza/aws-fastify-prometheus/commit/7738b1330d84453eddb78b6331f93cde0e83faa4))
* **deps-dev)(deps-dev:** bump the jest-testing group across 1 directory with 3 updates ([a8d6538](https://github.com/llevintza/aws-fastify-prometheus/commit/a8d6538cafb3fc5a906e24479159ddfd9d29933a))
* **deps-dev)(deps-dev:** bump the jest-testing group across 1 directory with 4 updates ([78c1f0f](https://github.com/llevintza/aws-fastify-prometheus/commit/78c1f0f64e35b80fe6cf60903b9c1992c64d396a))
* **deps-dev)(deps-dev:** bump the linting-formatting group across 1 directory with 3 updates ([7792428](https://github.com/llevintza/aws-fastify-prometheus/commit/77924289dcdbaabd8f4f70d06e9945711efa004f))
* **deps)(deps:** bump the production-dependencies group across 1 directory with 19 updates ([#14](https://github.com/llevintza/aws-fastify-prometheus/issues/14)) ([30f2b0e](https://github.com/llevintza/aws-fastify-prometheus/commit/30f2b0e2f2a5c28ae60bcd6b25ac10c074acd96a))
* **deps)(deps:** bump the production-dependencies group with 6 updates ([#21](https://github.com/llevintza/aws-fastify-prometheus/issues/21)) ([c9b193a](https://github.com/llevintza/aws-fastify-prometheus/commit/c9b193ae524b6b90beec174612341a5b3317b799))
* **deps-dev)(deps-dev:** bump the typescript-ecosystem group across 1 directory with 2 updates ([575019f](https://github.com/llevintza/aws-fastify-prometheus/commit/575019f958c7cce1d60fc3d7c066e14c0322999f))
* **deps-dev)(deps-dev:** bump ts-jest from 29.4.0 to 29.4.1 in the development-dependencies group ([#18](https://github.com/llevintza/aws-fastify-prometheus/issues/18)) ([5b13045](https://github.com/llevintza/aws-fastify-prometheus/commit/5b1304599011a306b6c8de9341c1698cba04b8e4))
* **deps)(deps:** bump yaml from 2.8.0 to 2.8.1 ([4fff2e9](https://github.com/llevintza/aws-fastify-prometheus/commit/4fff2e96c561b3f9bfb8160d60f625a117d10b57))
* drop intermediary research artifacts from the PR ([a490682](https://github.com/llevintza/aws-fastify-prometheus/commit/a4906827c6542dacab50cafe75034ea2117bd5bd))
* **deps-dev:** stack build-utilities bumps on the lint update ([b869c0c](https://github.com/llevintza/aws-fastify-prometheus/commit/b869c0cfd0abbf728e427d4e28d96fa60ea4aac8))
* **deps-dev:** stack lint bumps on the typescript-eslint update ([ebaffe5](https://github.com/llevintza/aws-fastify-prometheus/commit/ebaffe5c250b98eb1a0f5b7d47c20f7bbbfa16fe))
* sync yarn.lock with Fastify 5 peerDependency ([4f081ee](https://github.com/llevintza/aws-fastify-prometheus/commit/4f081ee663878a5e2fec7047acdd3aa0fa42046c))
* **deps-dev:** update eslint-plugin-jest to version 28.0.0 ([#17](https://github.com/llevintza/aws-fastify-prometheus/issues/17)) ([f05f018](https://github.com/llevintza/aws-fastify-prometheus/commit/f05f018c0f8ba047db11ba2cd9682014e1d716b8))

### Continuous Integration

* **dependabot:** disable auto-rebase and catch leftover dependency PRs ([85cc86d](https://github.com/llevintza/aws-fastify-prometheus/commit/85cc86d770cd6a8b2bcab96f1ab861c06f3ed13f))
* Implement enhanced Dependabot workflows for automated PR management ([#31](https://github.com/llevintza/aws-fastify-prometheus/issues/31)) ([72558b7](https://github.com/llevintza/aws-fastify-prometheus/commit/72558b7b235ad4724c0ef84a7ae8dcdb8fa0a931))
* **security:** let TruffleHog derive the scan range from the event ([6a59599](https://github.com/llevintza/aws-fastify-prometheus/commit/6a5959999ee181ce89bdd0158002b9d07a0c7408))
* **dependabot:** link the chained PRs into a native GitHub stack ([fb02c17](https://github.com/llevintza/aws-fastify-prometheus/commit/fb02c17a17b6bea97f96eb2ca91ecf8f05ad1398))
* **dependabot:** merge only the stack bottom when the bump is confident ([a1f46b9](https://github.com/llevintza/aws-fastify-prometheus/commit/a1f46b9ad5ea712e30ae3f9baf557213a6f572bd))
* re-trigger after Dependabot author-check fix ([9dbbd66](https://github.com/llevintza/aws-fastify-prometheus/commit/9dbbd66803d87aeec5c9d02a95915aa82f8f45a3))
* re-trigger CI and Dependabot auto-merge after workflow fix ([b30d1b4](https://github.com/llevintza/aws-fastify-prometheus/commit/b30d1b43c39495ed5d0e97d885354611a467e2a1))
* re-trigger CI for workflow_run Dependabot auto-merge ([8f8b232](https://github.com/llevintza/aws-fastify-prometheus/commit/8f8b232d30ac7937ad85af1fe42ae302a101ca45))
* re-trigger Dependabot auto-merge after discovery-timeout fix ([d634d22](https://github.com/llevintza/aws-fastify-prometheus/commit/d634d229f18ada2895d4cdba5103ccf0b2bb8d4b))
* **dependabot:** retarget open PRs into a merge-from-bottom stack ([7db7069](https://github.com/llevintza/aws-fastify-prometheus/commit/7db7069e74af17659638c9f4ec31cd070c57009b))
* run madge from a locked devDependency instead of npx ([aa634bd](https://github.com/llevintza/aws-fastify-prometheus/commit/aa634bd0a9637a55034ed58d4501d4ae01d9c147))
* skip husky hooks during semantic-release commit ([#186](https://github.com/llevintza/aws-fastify-prometheus/issues/186)) ([6c1d784](https://github.com/llevintza/aws-fastify-prometheus/commit/6c1d784dae4e2e72a1144694e239785508a12468))

## [1.0.2](https://github.com/llevintza/aws-fastify-prometheus/compare/v1.0.1...v1.0.2) (2025-08-01)


### Bug Fixes

* update links in documentation to reflect repository name change ([#15](https://github.com/llevintza/aws-fastify-prometheus/issues/15)) ([73b8d7e](https://github.com/llevintza/aws-fastify-prometheus/commit/73b8d7ef018ed359088a6dcaa425045470259007))

## [1.0.1](https://github.com/llevintza/aws-fastify-prometheus/compare/v1.0.0...v1.0.1) (2025-07-30)


### Bug Fixes

* update RELEASE_GUIDE.md to align with simplified 3-branch strategy ([afdad51](https://github.com/llevintza/aws-fastify-prometheus/commit/afdad51a8253dac9c429e2ae17ef06fc0c86f4b8))

# Changelog

All notable changes to this project will be documented in this file. This file is automatically generated by [semantic-release](https://github.com/semantic-release/semantic-release).

> **Note**: This project follows semantic versioning and uses conventional commits for automated releases. See our [Branching Strategy](./docs/BRANCHING_STRATEGY.md) for details.

## 1.0.0 (2025-07-28)

### 🚀 Features

* **release**: Simplified branching strategy to 3 branches (main/release/*/feature/*) ([9c5c4bb](https://github.com/llevintza/aws-fastify-prometheus/commit/9c5c4bb1d1e59bf37bf1d254961d8afe56e17b7c))
* **docs**: Comprehensive branching and version control documentation ([8238792](https://github.com/llevintza/aws-fastify-prometheus/commit/82387928b11847792c62ddc895e7807e0d294c57))

### 📚 Documentation Updates

* **branching**: Added detailed workflow guide with commit message examples
* **readme**: Updated installation instructions for 3-branch strategy
* **contributing**: Enhanced contributor guidance with conventional commits
* **release**: Clean version control system with manual and automatic options

### 🔄 Migration Notes

**Breaking Changes in Release Strategy**:
- Simplified from 8-branch to 3-branch strategy
- New branch patterns: `main` → stable, `release/*` → beta, `feature/*` → alpha
- Enhanced commit message support for granular version control
- Updated documentation across all markdown files

## 1.0.0 (2025-07-28) - Previous Release

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
