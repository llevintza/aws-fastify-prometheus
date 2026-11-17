# Development Guide

Local setup for `@llevintza/fastify-prometheus-metrics`. For branching, commits,
and releases, see [BRANCHING_STRATEGY.md](BRANCHING_STRATEGY.md) and
[RELEASE_GUIDE.md](RELEASE_GUIDE.md). Agent rules: [AGENTS.md](../AGENTS.md).

## Prerequisites

- **Node.js** ≥ 22 (CI matrices 22, 24, 26; see `.nvmrc`)
- **Yarn** 4 via Corepack
- **Git**

## Setup (contributors)

```bash
git clone https://github.com/llevintza/aws-fastify-prometheus.git
cd aws-fastify-prometheus
nvm use   # optional
corepack enable
yarn install
```

## Commands

| Command | Description |
| --- | --- |
| `yarn build` | Compile TypeScript → `dist/` |
| `yarn type-check` | `tsc --noEmit` |
| `yarn lint` / `yarn lint:fix` | ESLint |
| `yarn format` / `yarn format:check` | Prettier |
| `yarn test` / `yarn test:watch` / `yarn test:coverage` | Jest |
| `yarn madge --circular --extensions ts src/` | Circular import check (CI) |

Single test / by name:

```bash
yarn test tests/plugin.test.ts
yarn test -t "should collect HTTP metrics"
```

This is a library: there is no long-running app server. `yarn dev` only executes
`src/index.ts` (re-exports).

Before finishing a change: `yarn lint`, `yarn format:check`, `yarn type-check`,
and `yarn test:coverage` must pass.

## Install the published package (consumers)

Published to GitHub Packages. Configure the `@llevintza` scope, then:

```bash
npm install @llevintza/fastify-prometheus-metrics
# or: yarn add / pnpm add
```

npm:

```bash
echo "@llevintza:registry=https://npm.pkg.github.com" >> ~/.npmrc
```

## Layout

```
src/           # plugin, types, class API, CloudWatch exporter
tests/         # Jest (ts-jest)
examples/      # usage samples
docs/          # branching, release, security notes
dist/          # build output
```

Architecture (two independent metrics APIs, request metrics flow): see
[AGENTS.md](../AGENTS.md).

## Pre-commit

Husky runs lint-staged (Prettier + ESLint) and commitlint. Do not bypass with
`--no-verify`.

## Troubleshooting

- Type errors: `yarn type-check`
- Test failures: `yarn install` then `yarn test`
- Build: `yarn clean && yarn build`
- Lint: `yarn lint:fix`
