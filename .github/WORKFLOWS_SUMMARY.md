# GitHub Actions workflows

Overview of CI/CD for this repo. Deep release/Dependabot rules:
[docs/RELEASE_GUIDE.md](../docs/RELEASE_GUIDE.md). Branching:
[docs/BRANCHING_STRATEGY.md](../docs/BRANCHING_STRATEGY.md).

## Design principles

- **`ci.yml` is the PR quality gate.** Type-check, lint/format/madge, yarn
  audit, build, Node 22/24/26 tests + coverage, package validation, then release
  on `main`.
- **PRs are a billboard**, not a report dump. CI posts a short upserted pointer
  comment linking to the workflow run Summary and Artifacts.
- **Detail lives on the Actions run** (`GITHUB_STEP_SUMMARY` + artifacts).
- **Security SAST/secrets** run in `security.yml` (CodeQL, Semgrep, TruffleHog).
  Dependency audit on PRs is owned by CI; weekly schedule may attach a deeper
  audit artifact from `security.yml`.
- **Dependabot behavior SSOT is the automation** (`dependabot.yml`, stack /
  auto-merge workflows, stack script, contract analyzer). This hub and
  [RELEASE_GUIDE.md](../docs/RELEASE_GUIDE.md) stay thin; CI **Dependabot Docs
  Sync** fails PRs that change automation without touching a hub.

## Workflows

| Workflow              | File                        | When                          | Role                                               |
| --------------------- | --------------------------- | ----------------------------- | -------------------------------------------------- |
| CI/CD                 | `ci.yml`                    | PR + push to `main`           | Quality gates + semantic-release                   |
| Security Analysis     | `security.yml`              | PR + push to `main` + weekly  | CodeQL, Semgrep, TruffleHog; weekly audit artifact |
| Dependabot Stack      | `dependabot-stack.yml`      | Dependabot PR events + manual | Rebase/retarget/link stacked Dependabot PRs        |
| Dependabot Auto-Merge | `dependabot-auto-merge.yml` | After CI success on a PR      | Auto-merge confident stack-bottom patches (\*)     |

(\*) The update type is the highest `update-type` in the Dependabot commit
message metadata (the PR body has none).

The stack script uses only REST (`gh api`), so its PAT needs no `read:org`. It
holds out of the stack, and never rebases or force-pushes, any PR with a commit
not authored by `dependabot[bot]` (same gate as auto-merge). It retargets each
base before pushing and rolls the base back if the push fails. The two copies of
that author/committer jq rule sit between `foreign-commit-gate` markers, and CI
(**Dependabot Docs Sync** job) fails if they differ.

Native stacks go through the Stacks REST API (no gh extension). GitHub refuses a
base change for a PR inside a native stack (HTTP 422), so the script unstacks
only a stack holding a PR whose base must change, then retargets, pushes and
relinks (create, or `add` when the old stack is a prefix). A stack that already
matches the plan is left alone. Security updates sort to the bottom: the
security groups plus any single security PR (`security-update`: GHSA reference
or Dependabot's security-update footer).

The stack workflow's concurrency group is on the job, not the workflow, so a
skipped non-Dependabot `pull_request_target` run can no longer cancel a pending
Dependabot run or dispatch; dry-run dispatches use a separate group.

Dependabot scope: version updates cover **direct** dependencies only
(transitives move with their direct parent). Dependabot alerts and security
updates are enabled; security PRs land in `security-patch-minor` /
`security-major` (npm) and `actions-security-*` groups, split so one major never
holds a patch.

Retired (function folded elsewhere or replaced by Dependabot):

- `code-quality.yml` — duplicated lint/build; bundle size now in CI build
  Summary
- `dependency-check.yml` — overlapped Dependabot; no weekly issue spam

## CI/CD jobs (`ci.yml`)

| Job                   | Purpose                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| Setup                 | No-op status check required by ruleset; real install is per-job composite |
| TypeScript Type Check | `yarn type-check`                                                         |
| Lint & Format Check   | ESLint, Prettier, madge circular check                                    |
| Security Audit        | Soft `yarn npm audit` + `ci-audit-report` artifact                        |
| Build                 | `yarn build`, verify `dist/`, bundle size in Summary, `build-artifacts`   |
| Test (Node 22/24/26)  | `yarn test:coverage` + thresholds; `test-results-node-*`                  |
| Package Validation    | package.json + import smoke test on downloaded `dist/`                    |
| Dependabot Docs Sync  | PR-only: fail if Dependabot automation changed without a hub update       |
| PR Checks             | Upserts short PR comment; full table in Summary (`!cancelled()`)          |
| Release               | `yarn semantic-release` on `main` push only                               |
| CI Success            | Aggregates gate results for branch protection                             |

Shared setup:
[`.github/actions/setup-node-yarn`](actions/setup-node-yarn/action.yml).

## Security Analysis (`security.yml`)

| Check             | Notes                                                             |
| ----------------- | ----------------------------------------------------------------- |
| CodeQL            | Uploads to Security → Code scanning                               |
| Semgrep           | Pinned `semgrep/semgrep:1.110.0`; tool errors fail, findings soft |
| TruffleHog        | Action + scanner `version: 3.99.9`; verified secrets only         |
| Weekly yarn audit | Schedule only → `security-reports` artifact                       |

PR comment: short pointer (`<!-- ci-report:security -->`), not vuln lists.

## Required checks (branch protection)

Mirror the live `main-branch-protection` ruleset contexts (names must match job
`name:` fields):

1. Setup
2. CI Success
3. TypeScript Type Check
4. Lint & Format Check
5. Security Audit
6. Build
7. Test (Node.js 22)
8. Test (Node.js 24)
9. Package Validation
10. PR Checks
11. Security Vulnerability Scan (from Security Analysis)

**Not** required by the ruleset today: Test (Node.js 26) (still runs in CI).
**Setup** stays as a cheap no-op until the ruleset drops that context; real
Node/Yarn install is `.github/actions/setup-node-yarn` in each job.

## Coverage thresholds

From `jest.config.js`: branches 40 / functions 24 / lines 45 / statements 45.

## Secrets

| Secret                                 | Used for                                     |
| -------------------------------------- | -------------------------------------------- |
| `XOON_NPM_PUBLISH_TOKEN`               | semantic-release / GitHub Packages publish   |
| `CODE_QUALITY_REPORT_TOKEN`            | Upsert short CI/Security PR pointer comments |
| `GH_TOKEN` (or publish token fallback) | Dependabot stack push/retarget (`repo` only) |

Prefer classic PATs with least privilege. Do not use fine-grained PATs for
Packages publish.
