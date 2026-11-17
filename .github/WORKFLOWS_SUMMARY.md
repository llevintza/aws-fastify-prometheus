# GitHub Actions workflows

Overview of CI/CD for this repo. Deep release/Dependabot rules:
[docs/RELEASE_GUIDE.md](../docs/RELEASE_GUIDE.md). Branching:
[docs/BRANCHING_STRATEGY.md](../docs/BRANCHING_STRATEGY.md).

## Design principles

- **`ci.yml` is the PR quality gate.** Type-check, lint/format/madge, yarn audit,
  build, Node 22/24/26 tests + coverage, package validation, then release on
  `main`.
- **PRs are a billboard**, not a report dump. CI posts a short upserted pointer
  comment linking to the workflow run Summary and Artifacts.
- **Detail lives on the Actions run** (`GITHUB_STEP_SUMMARY` + artifacts).
- **Security SAST/secrets** run in `security.yml` (CodeQL, Semgrep, TruffleHog).
  Dependency audit on PRs is owned by CI; weekly schedule may attach a deeper
  audit artifact from `security.yml`.

## Workflows

| Workflow | File | When | Role |
| --- | --- | --- | --- |
| CI/CD | `ci.yml` | PR + push to `main` | Quality gates + semantic-release |
| Security Analysis | `security.yml` | PR + push to `main` + weekly | CodeQL, Semgrep, TruffleHog; weekly audit artifact |
| Dependabot Stack | `dependabot-stack.yml` | Dependabot PR events + manual | Rebase/retarget/link stacked Dependabot PRs |
| Dependabot Auto-Merge | `dependabot-auto-merge.yml` | After CI success on a PR | Auto-merge confident stack-bottom patches |

Retired (function folded elsewhere or replaced by Dependabot):

- `code-quality.yml` — duplicated lint/build; bundle size now in CI build Summary
- `dependency-check.yml` — overlapped Dependabot; no weekly issue spam

## CI/CD jobs (`ci.yml`)

| Job | Purpose |
| --- | --- |
| TypeScript Type Check | `yarn type-check` |
| Lint & Format Check | ESLint, Prettier, madge circular check |
| Security Audit | Soft `yarn npm audit` + `ci-audit-report` artifact |
| Build | `yarn build`, verify `dist/`, bundle size in Summary, `build-artifacts` |
| Test (Node 22/24/26) | `yarn test:coverage` + thresholds; `test-results-node-*` |
| Package Validation | package.json + import smoke test on downloaded `dist/` |
| PR Checks | Upserts short PR comment; full table in Summary (`if: always()`) |
| Release | `yarn semantic-release` on `main` push only |
| CI Success | Aggregates gate results for branch protection |

Shared setup: [`.github/actions/setup-node-yarn`](actions/setup-node-yarn/action.yml).

## Security Analysis (`security.yml`)

| Check | Notes |
| --- | --- |
| CodeQL | Uploads to Security → Code scanning |
| Semgrep | Pinned `semgrep/semgrep-action@v1`; continue-on-error |
| TruffleHog | Pinned release tag; verified secrets only |
| Weekly yarn audit | Schedule only → `security-reports` artifact |

PR comment: short pointer (`<!-- ci-report:security -->`), not vuln lists.

## Required checks (branch protection)

Keep these as required status checks (names must match job `name:` fields):

1. CI Success
2. TypeScript Type Check
3. Lint & Format Check
4. Security Audit
5. Build
6. Test (Node.js 22)
7. Test (Node.js 24)
8. Test (Node.js 26)
9. Package Validation
10. Security Vulnerability Scan (from Security Analysis)

Remove **Code Quality Analysis** from required checks if it was still listed
(workflow retired).

## Coverage thresholds

From `jest.config.js`: branches 40 / functions 24 / lines 45 / statements 45.

## Secrets

| Secret | Used for |
| --- | --- |
| `XOON_NPM_PUBLISH_TOKEN` | semantic-release / GitHub Packages publish |
| `CODE_QUALITY_REPORT_TOKEN` | Upsert short CI/Security PR pointer comments |
| `GH_TOKEN` (or publish token fallback) | Dependabot stack push/retarget |

Prefer classic PATs with least privilege. Do not use fine-grained PATs for
Packages publish.
