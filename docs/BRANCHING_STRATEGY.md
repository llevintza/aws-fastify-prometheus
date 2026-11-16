# Branching and Release Strategy

Trunk-based development with automated semantic versioning. **CI publishes only from `main`.**

## Branch types

| Branch | Purpose | CI publishes? |
|--------|---------|---------------|
| `main` | Production trunk | **Yes** — stable release via `yarn semantic-release` |
| `feature/*` (or other short-lived PR branches) | Development | No — merge to `main` to release |
| `release/*` | Optional stabilization (if used) | **No** today — `.releaserc.js` would treat these as `beta` prereleases if semantic-release ran, but the CI `Release` job is main-only |
| Dependabot stack branches | Dependency updates | No until merged (bottom of stack → `main`) |

### Outdated / unused channel claims

Older docs described auto-published **alpha**, **RC**, **beta**, **next**, **hotfix**, **stable**, and **latest** npm tags. Those step-by-step channels are **not wired in CI**. Only `main` → stable is live. See [RELEASE_GUIDE.md](RELEASE_GUIDE.md).

## How releases work

1. Merge to `main`.
2. CI runs checks; on success the `Release` job runs `yarn semantic-release`.
3. Package publishes to GitHub Packages; GitHub Release + `CHANGELOG.md` update.

Details, secrets overview, Dependabot contract bumps, and dry-run: [RELEASE_GUIDE.md](RELEASE_GUIDE.md).

## Conventional commits → version

| Commit | Version impact |
|--------|----------------|
| `feat:` | minor |
| `fix:` | patch |
| `perf:` | minor (see `.releaserc.js` for patch rules too) |
| `feat!:` / `fix!:` / `BREAKING CHANGE:` on feat/fix/perf/refactor | major |
| `chore:` / `test:` / `ci:` | no release (Dependabot production bumps scored by the contract analyzer instead) |

Manual scopes: `(major)`, `(minor)`, `(patch)`, `(no-release)`.

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Examples:

```bash
git commit -m "feat: add custom histogram buckets"
# → minor

git commit -m "fix: resolve memory leak in metrics collection"
# → patch

git commit -m "feat!: remove deprecated metrics endpoints

BREAKING CHANGE: Deprecated endpoints are gone; migrate to the current API."
# → major
```

## Dependency updates

- Dependabot PRs are stacked; **merge from the bottom** (base `main`); restack is automated.
- Package version for dep bumps follows the **consumer-contract** table (not the dependency’s own digit). Hold prom-client majors for a human `fix(deps)` / `feat(deps)` / `feat(deps)!:` merge subject.
- Full rules: [RELEASE_GUIDE.md](RELEASE_GUIDE.md) and [`scripts/semantic-release-analyze-commits.js`](../scripts/semantic-release-analyze-commits.js).

## Branch naming

- Features / fixes: `feature/<description>` or conventional short-lived names
- Prefer small PRs into `main`; urgent fixes are normal PRs with `fix:` — there is no separate hotfix publish channel

## Install

```bash
# Stable (only channel CI publishes)
npm install @llevintza/fastify-prometheus-metrics
```

GitHub Packages:

```bash
echo "@llevintza:registry=https://npm.pkg.github.com" >> ~/.npmrc
```

## Related

- [Release Guide](RELEASE_GUIDE.md)
- [Contributing](../CONTRIBUTING.md)
- [CHANGELOG.md](../CHANGELOG.md)
