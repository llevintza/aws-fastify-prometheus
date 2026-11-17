# Contributing

Thanks for contributing to `@llevintza/fastify-prometheus-metrics`.

## Quick links

- [Branching and Release Strategy](./docs/BRANCHING_STRATEGY.md) — trunk-based flow; CI publishes only from `main`
- [Release Guide](./docs/RELEASE_GUIDE.md) — how stable releases fire, Dependabot contract
- [Development Guide](./docs/DEVELOPMENT.md) — local setup and yarn commands
- [AGENTS.md](./AGENTS.md) — agent/contributor rules (SSOT for tooling)
- [Report a bug](https://github.com/llevintza/aws-fastify-prometheus/issues/new?template=bug_report.yml)
- [Request a feature](https://github.com/llevintza/aws-fastify-prometheus/issues/new?template=feature_request.yml)

## How to contribute

1. Fork (or clone) and branch from `main` using a Conventional Commits-style name
   (for example `feat/your-feature` or `fix/your-bug`). See
   [Branching Strategy](./docs/BRANCHING_STRATEGY.md).
2. Follow setup in [Development Guide](./docs/DEVELOPMENT.md).
3. Use [Conventional Commits](https://www.conventionalcommits.org/) on every
   commit (enforced by commitlint). Version impact table and examples:
   [Branching Strategy → Conventional commits](./docs/BRANCHING_STRATEGY.md#conventional-commits--version).
4. Open a PR into `main`. CI must be green. Do not expect alpha/beta publishes
   from feature branches — those channels are **not** wired; only `main`
   publishes (see [outdated channels](./docs/BRANCHING_STRATEGY.md#outdated--unused-channel-claims)).
5. After review and merge to `main`, semantic-release may publish a stable
   version. Details: [Release Guide](./docs/RELEASE_GUIDE.md).

## Coding standards

- TypeScript only for new code; match existing ESLint/Prettier style.
- Add tests for new behaviour; keep coverage at or above `jest.config.js`
  thresholds.
- Update `README.md` when options, metrics, or the public API change.
- Agent-oriented conventions live in [AGENTS.md](./AGENTS.md).

## Questions

Open an issue with the question label, or contact a maintainer.
