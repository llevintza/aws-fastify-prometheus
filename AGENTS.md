# AGENTS.md

Instructions for AI coding agents (Claude Code, Cursor, Grok Build, Grok CLI,
GitHub Copilot, Codex, Gemini CLI, and so on) and for human contributors working
in this repository. This file is the single source of truth. Tool-specific files
only point here, so edit this file, not them.

## Project

`@llevintza/fastify-prometheus-metrics` is a TypeScript Fastify plugin (Fastify
4 and 5 peer range) that collects Prometheus metrics with `prom-client`, exposes
them on a `/metrics` route, and can also export them to AWS CloudWatch. It is
published to **GitHub Packages** (`npm.pkg.github.com`) by semantic-release.
Node `>=22` is supported, and dev and CI use Node 24 (`.nvmrc`). The package
manager is Yarn 4 through corepack.

Known gap: `AwsMetricsExporter.sendMetricsToCloudWatch` is still a placeholder
that sends nothing. The feature backlog lives in GitHub issues labelled
`enhancement`.

## Commands

```sh
corepack enable && yarn install   # also installs husky git hooks via "prepare"
yarn build            # tsc -> dist/
yarn type-check       # tsc --noEmit
yarn lint             # ESLint (src, tests)
yarn format:check     # Prettier check (yarn format to write)
yarn test             # Jest (ts-jest); yarn test:coverage for thresholds
yarn madge --circular --extensions ts src/   # CI fails on circular imports
```

Before finishing any change, `yarn lint`, `yarn format:check`, `yarn type-check`
and `yarn test:coverage` must all pass. Coverage must stay at or above the
thresholds in `jest.config.js`.

## Layout

```
src/
  index.ts                 # public exports: plugin (default), classes, types
  plugin.ts                # the Fastify plugin: hooks, /metrics route, fastify.prometheus decorator
  types.ts                 # option/config types (public API surface)
  interfaces.ts            # metric interfaces used by the class API
  prometheus-metrics.ts    # PrometheusMetrics class (standalone registry wrapper)
  metrics-collector.ts     # MetricsCollector: creates prom-client metrics
  aws-metrics-exporter.ts  # buffered CloudWatch exporter (send is a placeholder)
  fastify.d.ts             # module augmentation
tests/plugin.test.ts       # Jest tests via fastify.inject
examples/                  # basic.ts, advanced.ts
docs/                      # branching, release, Dependabot, security docs
```

## Code conventions

- Strict TypeScript. Use `import type` for type-only imports. Don't use `any`.
  Anything added to the public API is added to `src/types.ts` and exported from
  `src/index.ts`.
- Changes to the plugin's behaviour are **opt-in** unless Leo explicitly
  approves a breaking change. A breaking change means a `feat!:` or
  `BREAKING CHANGE:` commit and a major release.
- Tests use `fastify.inject` and a fresh `prom-client` `Registry` per test (pass
  it as `register`), so they never touch the global registry.
- Formatting is enforced by Prettier (`.prettierrc.js`: single quotes,
  semicolons, `es5` trailing commas, 100 columns, and 80 columns with prose wrap
  for Markdown) and by EditorConfig. Fix lint errors. Don't disable a rule
  inline without stating why.
- Update `README.md` whenever options, metrics or the public API change.

## Git workflow

- Never commit directly to `main`. Branch, then open a PR.
- Branch names follow `<type>/<short-kebab-description>` with a Conventional
  Commits type, for example `feat/in-flight-gauge` or `fix/route-cardinality`.
- **Squash merging is disabled** (PRs merge with a merge commit), so **every
  commit on a branch lands on `main`** and is read by semantic-release. Every
  commit must be a valid Conventional Commit, and the PR title should be one
  too.
- Releases: merging to `main` triggers the CI `Release` job
  (`yarn semantic-release`), which publishes to GitHub Packages. `feat` gives a
  minor release, `fix`/`perf` a patch, and `!`/`BREAKING CHANGE` a major.
  `chore`, `docs`, `test` and `ci` don't release. See
  `docs/BRANCHING_STRATEGY.md` and `docs/RELEASE_GUIDE.md`.
- CI tokens: workflows use purpose-specific **classic** PATs only (for example
  `XOON_NPM_PUBLISH_TOKEN`). Never introduce `secrets.GITHUB_TOKEN` or
  fine-grained PATs, because GitHub Packages rejects them.

## Conventional Commits (enforced)

```
<type>(<optional-scope>): <subject>

<optional body>

<optional footer(s)>
```

- **type**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
  `ci`, `chore`, `revert`.
- **scope** (optional): a lower-case area, for example `plugin`, `routes`,
  `otel`, `cloudwatch`, `deps`.
- **subject**: imperative mood, lower-case start, no trailing period. The header
  can be at most 100 characters, and body/footer lines at most 100
  (`.commitlintrc.js`).
- **breaking**: `!` after the type/scope and/or a `BREAKING CHANGE:` footer.

Enforcement: `.husky/commit-msg` runs commitlint, and `.husky/pre-commit` runs
lint-staged (Prettier and ESLint). Don't bypass hooks with `--no-verify`. If a
hook fails, fix the cause and make a new commit.

## Agent roles and PR workflow

Work is split across agents with fixed roles:

- **Orchestrator**: the agent Leo talks to. It plans the work and splits it into
  self-contained tasks, dispatches them to Orca orchestration workers
  (`orca orchestration worker-start`), then aggregates the results and reports
  back. It does not edit repo files itself. In this repo it asks before deciding
  scope, versions, tooling or model (it recommends a default and recommends a
  cheaper model for mechanical work).
- **Implementer** (worker): one task, one branch, one PR. The checks under
  Commands must pass before it opens the PR.
- **PR Reviewer** (worker): watches each open PR until it is merged. It reads
  every PR comment, review comment, inline thread and CI check, and handles
  feedback from the Tech Coordinator, Leo or anyone else. It pushes fixes as new
  commits on the same branch (no force-push), replies to each thread with what
  changed or why not, resolves the threads it has handled, and fixes failing
  checks. It escalates to the Orchestrator when feedback is ambiguous or
  conflicts with `AGENTS.md`.
- **Arbiter** (approver persona, worker): an independent final reviewer that did
  not write or fix the code. It signs off only when CI is green, no threads are
  unresolved, and the change follows `AGENTS.md` and does what the PR says. It
  posts exactly one verdict comment per review round: `[Arbiter] ✅ Signed off`
  with a short rationale, or `[Arbiter] ❌ Changes requested` with a numbered
  list for the PR Reviewer to handle before the Arbiter reviews again. The
  Arbiter never pushes code.
- **Tech Coordinator**: Leo's GrokBot. It may leave review feedback and merge
  PRs.

### Identity rule

Every agent, including the Tech Coordinator GrokBot, acts through Leo's own
GitHub account. GitHub's "Approve" review is therefore unavailable (an author
can't approve their own PR), and comment authors can't be told apart. So:

- Every PR comment or reply an agent writes starts with its role tag in
  brackets: `[Implementer]`, `[PR Reviewer]`, `[Arbiter]` or
  `[Tech Coordinator]`.
- A comment with no tag is from Leo and takes priority.
- The Arbiter's `✅ Signed off` comment is the approval of record. Use
  `gh pr comment` or `gh pr review --comment`, never `--approve`.
- Locally, prefix `gh` calls with
  `GH_TOKEN="$(gh auth token --user llevintza)"`. The default gh account can't
  see Leo's private repos.

### Merging

Agents never merge. Leo or the Tech Coordinator merges once the Arbiter has
signed off on the latest commit. Any commit pushed after sign-off needs a fresh
Arbiter verdict.

## Agent memory (shared Obsidian vault)

All agents (Claude Code, Cursor, Grok Build, Grok CLI) share one memory store at
`~/obsidian/agent-memory/`. Skip this section if that path doesn't exist (cloud
runners).

- **Read**: at the start of any task that may depend on past context, read
  `_global/GLOBAL.md` (cross-repo facts) and `aws-fastify-prometheus/MEMORY.md`
  (this repo's hub). Follow hub → `_index-*.md` → note.
- **Write**: one fact per note, flat in `aws-fastify-prometheus/`, named
  `<type>_<slug>.md` (type is `user`, `feedback`, `project` or `reference`) with
  frontmatter `name`, `aliases: [<slug>]`, `description` and `metadata.type`.
  Add one pointer line to the matching `_index-*.md`, never to the hub. Update
  an existing note rather than duplicating it. A fact that holds in every repo
  goes in `_global/` with a line in `GLOBAL.md`.
- Claude Code writes there natively (`autoMemoryDirectory` in
  `.claude/settings.json`). The vault is its own private git repo. Never copy
  its content into this repo.

## Agent tooling

The repo is agent-agnostic. `AGENTS.md` holds every rule, and each tool is wired
to it without duplicating content:

| Tool                                         | How it picks up these rules                     |
| -------------------------------------------- | ----------------------------------------------- |
| Cursor, Codex, Copilot, Grok Build, Grok CLI | Read `AGENTS.md` natively                       |
| Claude Code                                  | `CLAUDE.md` contains only `@AGENTS.md` (import) |
| Gemini CLI                                   | `.gemini/settings.json` sets `context.fileName` |

When adding support for another tool, add a thin pointer or config that leads to
`AGENTS.md`. Never copy rules into tool-specific files, or they will drift.
Don't add an `AGENTS.override.md`.

For Claude Code, `.claude/settings.json` also sets `autoMemoryDirectory` to the
shared vault (see Agent memory above).
