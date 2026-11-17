# Release Guide

Operator guide for `@llevintza/fastify-prometheus-metrics`. Stable releases
publish only from `main` via CI.

## How a stable release fires

1. Merge to `main` (feature/fix PRs, or Dependabot commits the contract analyzer
   can score — plus a human merge subject when a held row needs a raise).
2. [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs the usual
   checks (type-check, lint, audit, build, test, package-validation).
3. When those jobs succeed **and** the event is a push to `main`, the `Release`
   job runs `yarn semantic-release`.
4. semantic-release analyzes commits since the last tag, bumps the version,
   updates `CHANGELOG.md` and `package.json`, publishes to GitHub Packages,
   creates a GitHub Release, and pushes a `chore(release): … [skip ci]` commit.

**Secrets / env (high level):** the release job uses a publish token
(`XOON_NPM_PUBLISH_TOKEN`) as `GITHUB_TOKEN` and `NODE_AUTH_TOKEN` for checkout,
GitHub Releases, and the GitHub Packages registry (`npm.pkg.github.com`, scope
`@llevintza`). `HUSKY=0` skips local git hooks on the generated release commit.

## How to overview a release

| Where                             | What to check                                                   |
| --------------------------------- | --------------------------------------------------------------- |
| Actions → CI/CD → **Release** job | Logs for analyze → version → publish                            |
| GitHub **Releases**               | Tag, notes, assets                                              |
| `CHANGELOG.md` on `main`          | Generated notes committed by semantic-release                   |
| GitHub Packages                   | `@llevintza/fastify-prometheus-metrics` on `npm.pkg.github.com` |

Install the stable package:

```bash
npm install @llevintza/fastify-prometheus-metrics
```

## Conventional commit rules

Version impact table and examples:
[BRANCHING_STRATEGY.md → Conventional commits](BRANCHING_STRATEGY.md#conventional-commits--version).
Dependabot `chore(deps)` commits are scored by the contract plugin below instead
of the type alone.

Config: [`.releaserc.js`](../.releaserc.js). Analyzer:
[`scripts/semantic-release-analyze-commits.js`](../scripts/semantic-release-analyze-commits.js).

## Contract-based dependency bumps

Dependabot commits stay `chore(deps)` / `chore(deps-dev)`. The custom
`analyzeCommits` plugin reads each Dependabot commit’s `updated-dependencies`
YAML and the `package.json` (and peer/`fp()`/`engines`) diff, then scores by
**what consumers of this package can observe** — not by the dependency’s own
major/minor/patch digit.

Summarized ranks (`none` < `patch` < `minor` < `major`; PR/release = max across
members):

| Rank      | When                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **none**  | GitHub Actions / pure devDependencies; lockfile-only (no `dependencies` / `peerDependencies` / `engines` change)                                       |
| **patch** | Encapsulated production bumps (`@aws-sdk/*`, `fastify-plugin`, prom-client patch/minor with no contract break, security fixes with no contract change) |
| **minor** | Peer/`fp()` **adds** a Fastify major while still accepting previous hosts; caller-visible behavior with contract intact                                |
| **major** | Peer/`fp()` drops a host major or raises floor; `engines.node` moves up; human-confirmed public-contract break                                         |
| **hold**  | `prom-client` `semver-major` or rename to `@prometheus-io/*` — automation publishes **nothing** until a human raise                                    |

The full decision table is implemented in
[`scripts/semantic-release-analyze-commits.js`](../scripts/semantic-release-analyze-commits.js).

## Stacked Dependabot PRs

Dependabot PRs are ordered into a stack. **Merge from the bottom** (the PR based
on `main`). After a merge, restack of the remaining chain is automated (stack
workflow). Do not rebase upper Dependabot branches by hand unless the workflow
reports a conflict.

Behavior details live in the automation files (workflows, stack script,
`dependabot.yml`, contract analyzer). When those change, update this guide
and/or [`.github/WORKFLOWS_SUMMARY.md`](../.github/WORKFLOWS_SUMMARY.md) in the
same PR — CI job **Dependabot Docs Sync** enforces it.

## Human raise for held rows

When automation holds a PR (especially prom-client majors / Prometheus client
rename), merge with an explicit conventional **subject** — never paste the
Dependabot PR body as the merge body (upstream changelogs can inject false
`BREAKING CHANGE` lines):

| Intent        | Merge subject                                                            |
| ------------- | ------------------------------------------------------------------------ |
| Package patch | `fix(deps): …`                                                           |
| Package minor | `feat(deps): …`                                                          |
| Package major | `feat(deps)!: …` plus a short maintainer-written `BREAKING CHANGE:` line |

Confident auto-merge rows leave the default `Merge pull request #N` headline;
the plugin scores the Dependabot commit trailer.

## Prereleases (config only — not published by CI today)

[`.releaserc.js`](../.releaserc.js) still lists:

- `feature/*` → prerelease `alpha`
- `release/*` → prerelease `beta`

**CI does not run `semantic-release` off `main`.** The `Release` job is gated to
`push` + `refs/heads/main` only. Pushing `feature/*` or `release/*` does **not**
publish alpha/beta packages through the current pipeline. Treat those branch
entries as unused config unless CI is extended later.

There is no CI publish path for `next`, `rc`, `hotfix`, `stable`, or `latest`
channels.

## Optional dry-run

Locally (with registry/auth env equivalent to CI if you need publish
simulation):

```bash
yarn semantic-release --dry-run
```

This analyzes commits and reports the next version without publishing or pushing
tags.

## Related docs

- [Branching Strategy](BRANCHING_STRATEGY.md) — trunk-based flow aligned with
  main-only publish
- [Development Guide](DEVELOPMENT.md)
- [Contributing](../CONTRIBUTING.md)
- Dependabot config: [`.github/dependabot.yml`](../.github/dependabot.yml)
- CI overview: [`.github/WORKFLOWS_SUMMARY.md`](../.github/WORKFLOWS_SUMMARY.md)
  (Dependabot docs-sync gate)
