# Classification heuristics for dependency-aware package semver

Scope: how `@llevintza/fastify-prometheus-metrics` (published 1.0.2) should map a Dependabot update onto a package release of `none`, `patch`, `minor`, or `major`. The user baseline to beat is: dependency patch/minor → package patch; dependency major → package minor; substantial incompatibility → package major.

Public contract used below, taken from the local checkout (not from a dependency’s own semver):

- Default export is `fp(fastifyPrometheusPlugin, { fastify: '4.x || 5.x', name: 'fastify-prometheus-metrics' })`. Peer is `fastify: ^4.0.0 || ^5.0.0`. `engines.node` is `>=22.0.0`. Published `files` are `dist`, `README.md`, and `LICENSE`.
- Exported runtime: plugin, `AwsMetricsExporter`, `PrometheusMetrics`, `MetricsCollector`. Exported options include `FastifyPrometheusOptions.register?: typeof register` imported from `prom-client`.
- Decorator `fastify.prometheus.getMetrics(): Promise<string>` and the metrics route both return `metricsRegistry.metrics()`. Scrape text is therefore part of the contract, not only TypeScript signatures.
- `@aws-sdk/client-cloudwatch` is a production dependency (`^3.859.0`) but `src/aws-metrics-exporter.ts` never imports it. `sendMetricsToCloudWatch` is a placeholder. CloudWatch shapes in that file are local interfaces.

Rank order used everywhere: `none < patch < minor < major`.

## For this package specifically, which dependency majors are likely package-major vs package-minor?

### Takeaway

Do not map a dependency major onto a package minor. For this plugin, a `prom-client` major or a Fastify peer-range narrowing is the dependency major most likely to be a package major; a `fastify-plugin` major and an `@aws-sdk/client-cloudwatch` major are package patch unless the public contract above actually changes. A dependency major is a package minor only when this package starts exposing new backward-compatible behavior from that upgrade.

### Cited Findings

- SemVer: major means a backward-incompatible public-API change; minor means backward-compatible functionality (and may be used for substantial private improvements); patch means a backward-compatible bug fix. Updating one’s own dependencies without changing the public API “would be considered compatible.” Whether that compatible bump is patch or minor “depends on whether you updated your dependencies in order to fix a bug or introduce new functionality.” Extra code is expected for the minor case. — [SemVer 2.0.0, items 6–8 and the dependency FAQ](https://semver.org/#what-should-i-do-if-i-update-my-own-dependencies-without-changing-the-public-api)
- npm: a breaking change to a package dependency should increment the package major. Patch is a backward-compatible bug fix, minor is backward-compatible new functionality, major is a break. — [About semantic versioning | npm Docs](https://docs.npmjs.com/about-semantic-versioning/)
- A maintainer write-up of npm practice: a normal dependency bump is a package patch unless the package wraps the dependency’s API and that API changed, or the package gains substantial new behavior (then minor). A devDependency bump usually does not change the package version. Widening a peer range is a package minor; moving a peer to a new major (dropping the old one) is a package major; a peer minor/patch bump follows that same level. — [Semantic Versioning of Npm Packages After a Dependency Update](https://8hob.io/posts/semantic-versioning-npm-packages-after-dependency-update/)
- Raising the minimum Node.js version is a breaking change and should be a major. — [nodejs/package-maintenance versioning.md](https://github.com/nodejs/package-maintenance/blob/main/docs/versioning.md)
- This package is 1.0.2, so the `x > 0` SemVer rules apply, not the 0.y.z “anything may change” rule. Production dependencies are only `@aws-sdk/client-cloudwatch`, `fastify-plugin`, and `prom-client`. `fastify` is a peer (`^4 || ^5`) and a devDependency. — [local package.json](file:///Users/llevintza/orca/workspaces/aws-fastify-prometheus/dependabot-stacked-prs/package.json)
- `prom-client` states that it follows SemVer. Historical breaks that would have touched this plugin’s contract: v13.0.0 made `registry.metrics()`, `getMetricsAsJSON()`, `getMetricsAsArray()`, and `getSingleMetricAsString()` async; v14.0.0 changed `linearBuckets` so it no longer propagates rounding errors; v15.0.0 dropped Node 10, 12, 14, 17, and 19 and added OpenMetrics and exemplars. — [prometheus/client_js CHANGELOG.md](https://github.com/prometheus/client_js/blob/main/CHANGELOG.md); [v13.0.0](https://github.com/siimon/prom-client/releases/tag/v13.0.0); [v15.0.0](https://github.com/siimon/prom-client/releases/tag/v15.0.0)
- On 2026-08-24 the same changelog’s 0.16.0 renamed the package from `prom-client` to `@prometheus-io/client` and listed breaks: cluster/worker IPC message names, Node 16/18/20/21/23 dropped, metric storage moved to `LabelMap` for subclasses, counter exemplars report the value instead of the delta, and TypeScript `MetricType` changed from a numeric enum to a string union. Unreleased notes say gauges will no longer initialize to zero. — [prometheus/client_js CHANGELOG.md](https://github.com/prometheus/client_js/blob/main/CHANGELOG.md)
- This plugin’s metrics route and `getMetrics(): Promise<string>` both return `metricsRegistry.metrics()`. Options type the registry as `typeof register` from `prom-client`. The plugin imports `Counter`, `Gauge`, `Histogram`, `Summary`, `register`, and `collectDefaultMetrics`. — [local plugin.ts, types.ts, index.ts](file:///Users/llevintza/orca/workspaces/aws-fastify-prometheus/dependabot-stacked-prs/src/plugin.ts)
- `fastify-plugin` documents the `fastify` option as metadata Fastify checks at register time (`{ fastify: '5.x' }`). Its README still says the v4 line covers Fastify v4, and the v2/v3 lines cover Fastify v3. It does not say v5 or v6 is tied to a Fastify major. — [fastify/fastify-plugin README](https://github.com/fastify/fastify-plugin/)
- `fastify-plugin` v6.0.0 (2026-06-09) notes are devDependency bumps, CI, license, entry-point/project-structure refactor, and “removed interface deprecated.” v6.0.1 (2026-10-10) includes a behavior fix that throws a `TypeError` when the plugin is nullish and a fix that does not mutate the options object. v5.0.1 updated Fastify as a devDependency to `^5.0.0`, which does not by itself set the consumer’s peer range. A separate 2026 review concluded `fastify-plugin@6` declares no `peerDependencies` and that the range passed to `fp()` is what Fastify validates. — [v6.0.0](https://github.com/fastify/fastify-plugin/releases/tag/v6.0.0); [v6.0.1](https://github.com/fastify/fastify-plugin/releases/tag/v6.0.1); [v5.0.1](https://github.com/fastify/fastify-plugin/releases/tag/v5.0.1); [opena2a commit b20a51b](https://github.com/opena2a-org/agent-identity-management/commit/b20a51bfbf17acb89595400c157d5da0a82af47b)
- An Apollo Server Fastify integration maintainer treated “peer becomes `fastify@^5` only” as a major of that integration. The shipped v3 major was justified because Fastify 5 forced a higher Node floor and TypeScript 5.4, not merely because the peer number changed. — [apollo-server-integration-fastify#296](https://github.com/apollo-server-integrations/apollo-server-integration-fastify/issues/296)
- AWS SDK for JavaScript v3 releases “usually happen once per weekday” and “each release increments the minor version, e.g. 3.200.0 -> 3.201.0.” Node floors have moved inside 3.x: `>=20` at 3.968.0, `>=18` at 3.723.0, `>=16` at 3.567.0. In 2026 the README added a TypeScript support sunset table (SDK support for TypeScript `<=5.5` ends 2027-01-04). Modular client commands and clients are documented as public/stable, but “public interfaces such as client configuration are also subject to change in exceptional cases.” — [aws-sdk-js-v3 README](https://github.com/aws/aws-sdk-js-v3/blob/main/README.md)
- AWS staff on the SDK repo: breaking changes have shipped without a major bump; “we are not releasing changes in adherence to semver,” because the org maintenance policy was read as forbidding a major while the product is still “v3.” Issue #5821 proposes detaching the product name “v3” from the major component so unavoidable breaks (Node drops, peer-dep moves) can be majors. The org policy itself says a major is for changed public interfaces, behaviors, or semantics. — [aws-sdk-js-v3#5818](https://github.com/aws/aws-sdk-js-v3/issues/5818); [aws-sdk-js-v3#5821](https://github.com/aws/aws-sdk-js-v3/issues/5821); [AWS SDKs and Tools maintenance policy](https://docs.aws.amazon.com/sdkref/latest/guide/maint-policy.html); [aws-sdk-js-v3#4153](https://github.com/aws/aws-sdk-js-v3/issues/4153)
- This exporter does not construct `CloudWatchClient`. The class is still a public export, but its config type is the plugin’s `AwsExporterConfig`, not an AWS SDK type. — [local aws-metrics-exporter.ts and index.ts](file:///Users/llevintza/orca/workspaces/aws-fastify-prometheus/dependabot-stacked-prs/src/aws-metrics-exporter.ts)

### Inferences

- Replace the baseline “dependency major → package minor” with a contract test. The dependency’s own major/minor/patch is an input signal, not the output.
- `prom-client` major → package major when any of these change: `register`’s type as used by `FastifyPrometheusOptions.register`, the return of `metrics()` versus `getMetrics(): Promise<string>`, scrape text (names, labels, exemplar values, gauge zero), or the Node floor above this package’s `engines`. v13-style async `metrics()` and the unreleased “gauges no longer initialize to zero” are package-major if they land, because the route and `getMetrics` pass that output through. v15’s Node drop (nothing above 19) would not by itself be a package major while `engines` stays `>=22`; OpenMetrics/exemplars are package minor only if the default text format stays valid for existing scrapers, and package major if the default body changes incompatibly. The 2026 rename to `@prometheus-io/client` is not a semver bump Dependabot can apply in place; switching packages is a package major because callers pass a `prom-client` registry into a public option.
- `prom-client` major → package minor only for a major whose changelog is additive and whose breaks are outside this contract (for example a Node floor this package already exceeds, with identical types and identical scrape text). That is the uncommon case. Do not use package minor as the default for a prom-client major.
- `fastify` peer major → package major when the allowed set shrinks (`^4 || ^5` becomes `^5` only, or the `fp()` metadata `4.x || 5.x` drops `4.x`). → package minor when a new major is added and every previously allowed major remains. → `none` when only the devDependency install moves and both the peer range and the `fp()` string stay put. A Fastify major that also forces `engines` upward is a package major even if the plugin code still runs, same pattern as the Apollo integration.
- `fastify-plugin` major → package patch when this package’s `fp(plugin, { fastify, name })` call still typechecks and register-time behavior is unchanged. v6’s release notes do not show a Fastify-major coupling. Escalate to package major only if the wrapped default-export type or registration behavior changes (v6 removed a deprecated interface; that is a type-diff check, not an automatic package major). Do not treat “fastify-ecosystem-major” as a package major.
- `@aws-sdk/client-cloudwatch` major, minor, or patch → package patch while the SDK stays off the public type surface and the placeholder exporter’s behavior stays the same. It becomes package major only if `AwsExporterConfig`, `exportMetric`, or a real client call starts requiring callers to change. It becomes package minor only if the upgrade adds caller-visible exporter behavior. AWS’s own minor cadence is not evidence of compatibility: minors have raised Node floors and shipped breaks. This package’s `>=22` already satisfies the documented 3.968 floor of Node 20; a later SDK release that drops Node 22 would be a package major because it forces `engines` up.
- “Substantial non-compat → package major” in the baseline is the right outcome, but “substantial” means a break in the contract listed at the top, not a large diff and not the dependency’s major digit.

### Gaps

- No official Fastify document found that says which `fastify-plugin` major supports which Fastify major for v5 and v6. The README’s coupling note stops at v4. The “v6 has no peerDependencies” claim is from a third-party commit, not from fastify-plugin’s release notes.
- No type-diff was run between `fastify-plugin` 5 and 6 against this package’s default export, so “removed interface deprecated” in v6.0.0 might or might not change emitted `.d.ts`.
- The fetched AWS README still describes a minor-increment cadence inside 3.x. Resolution of issue #5821 (whether a 4.0.0 exists by November 2026) was not confirmed.
- v15’s default exposition format versus OpenMetrics was not verified, so the patch-vs-minor call for “exemplars added but text format kept” is not fully sourced.
- `@prometheus-io/client` 0.16.0 lists dropped Node versions but the fetched breaking section does not state the new minimum. Whether Node 22 remains supported is not explicit there.
- Dependabot’s behavior when the same package is both a peerDependency and a devDependency (does one PR edit both ranges?) was not confirmed in the docs fetched.

## How should grouped updates take the max severity across members?

### Takeaway

A grouped Dependabot PR has no single semver level. Classify each member on the contract rules above, then set the PR’s package release to the maximum rank. Max is taken over those classifications, not over the dependencies’ own major/minor/patch digits. If the max is `major` only because one member breaks the contract, split any security fix that could have shipped as a patch so the current release line is not blocked.

### Cited Findings

- With `groups`, every update that matches a rule is combined into one pull request. If a dependency matches more than one rule, it is included only in the first group. Dependencies that match no rule stay as individual PRs. `applies-to` defaults to version updates, not security updates. `update-types` may list `patch`, `minor`, and `major` together. `dependency-type` is `development` or `production` only. — [Dependabot options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
- GitHub’s examples group minor+patch and leave majors as separate PRs, or ignore majors entirely. They do not define how a mixed group should be versioned by the package that receives the PR. A version-update group and a security-update group are separate when `applies-to` is set; omitting `applies-to` means the group is version updates only. — [Optimizing PR creation for version updates](https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/optimizing-pr-creation-version-updates)
- If a grouped version-update PR contains a vulnerable package, Dependabot security updates still try to open a separate PR “to ensure you have visibility into package vulnerabilities.” — [dependabot-core discussion #10645](https://github.com/dependabot/dependabot-core/discussions/10645), quoting GitHub docs
- Grouped security updates are opt-in (`applies-to: security-updates`, or the repository/org setting). Rules are applied in file order; first match wins. — [Configuring Dependabot security updates](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-security-updates)
- Apache’s Dependabot guidance: a grouped PR is all-or-nothing, so one update that breaks the build holds every other fix in that PR. Isolate a critical fix by narrowing `patterns` or by giving that dependency its own group. — [Apache Dependabot guidance](https://infra.apache.org/dependabot.html)
- `@semantic-release/commit-analyzer`: if one commit matches several rules, the highest release type wins (`major` > `minor` > `patch`). Commits that match nothing, including default `chore`, get no release type. — [semantic-release/commit-analyzer](https://github.com/semantic-release/commit-analyzer)
- This repo’s groups that list `major` together with `minor` and `patch`: `aws-ecosystem`, `node-ecosystem`, `linting-formatting`, `typescript-ecosystem`, `jest-testing`, `build-utilities`, and the three GitHub Actions groups. `fastify-ecosystem-major` is major-only; `fastify-ecosystem` is minor+patch; `monitoring-tools` is minor+patch for `prom-client` and does not include majors. `security-critical` is `dependency-type: production` and `update-types: [major]`, and it excludes `fastify*`, `@fastify/*`, `@aws-sdk/*`, and `prom-client`. No group sets `applies-to`. — [local dependabot.yml](file:///Users/llevintza/orca/workspaces/aws-fastify-prometheus/dependabot-stacked-prs/.github/dependabot.yml)

### Inferences

- Automation algorithm: `release(PR) = max(classify(member))` with `none < patch < minor < major`. A member classified `none` does not pull the max down, and a member whose dependency semver is major does not raise the max unless `classify` says so. An `aws-ecosystem` PR full of SDK majors is still package `patch` while the CloudWatch client stays unused. A `fastify-ecosystem-major` PR is package `major` only if the Fastify peer range or `fp()` metadata shrinks, or `fastify-plugin` breaks the wrapped export; otherwise it is `patch` (plugin helper) or `none` (dev-only Fastify install).
- Do not encode the group name as the severity. `security-critical` as configured cannot match the only three production dependencies, because each is excluded. It is not a CVSS bucket. `monitoring-tools` never contains a prom-client major; that major arrives as its own PR and must be classified from the changelog, not from the group.
- Because groups are first-match and `applies-to` is unset, these groups do not bundle security updates. A vuln inside a grouped version PR still gets a second PR. Classify that security PR on its own; do not inherit the version-group’s rank.
- When the max is `major` and another member is a security fix that would have been `patch`, do not ship only the major. Apache’s all-or-nothing note is the reason to split: the patch must be releasable on the current major so existing `^1.x` installs take the fix. The major PR keeps the breaking member.
- semantic-release’s “highest matching rule wins” is the right rollup precedent for one commit that represents the group. Dependabot will not compute that rollup. The classifier has to, and it has to put the result in the commit type (see the devDependency question): this file’s `commit-message.prefix` is `chore(deps)` for production, and default commit-analyzer assigns `chore` no release.

### Gaps

- Dependabot’s PR title convention for a mixed major+minor group was not fetched from a live PR, so title text cannot be used as a severity source. The docs only say the updates are combined.
- A 2024 comment on commit-analyzer claimed `release: false` outranks `major`. The current README still says the highest of major/minor/patch wins, and that a `release: false` rule can suppress a breaking commit when the scope matches. Those two statements were not reconciled against the current source. Do not implement override as `release: false` without a test against the installed commit-analyzer.
- No GitHub doc found that tells a library which package semver to publish for a grouped PR. The max rule is a policy built from SemVer plus commit-analyzer, not a Dependabot feature.

## Should security-critical majors always be package major, or only when API surface changes?

### Takeaway

Only when the public contract changes. A security fix that leaves exports, peer range, engines, and scrape text compatible is a package patch, including when the fixed dependency version is a major. Forcing those fixes to package major strands every consumer on `^1.x`.

### Cited Findings

- SemVer patch is a backward-compatible bug fix. A dependency update that does not change the public API is compatible; a bug fix is the patch case. Major is reserved for an incompatible public API. — [SemVer 2.0.0](https://semver.org/#what-should-i-do-if-i-update-my-own-dependencies-without-changing-the-public-api)
- npm recommends a major specifically when the change breaks a package dependency, meaning consumers can no longer take the upgrade under the compatibility promise, not when the motivation is a CVE. — [About semantic versioning | npm Docs](https://docs.npmjs.com/about-semantic-versioning/)
- The normal-dependency default in maintainer practice is a patch, with a major only if the wrapped API changed. — [8 Hobbies dependency-update semver](https://8hob.io/posts/semantic-versioning-npm-packages-after-dependency-update/)
- semantic-release’s default table has no severity dimension: breaking change → major, `feat` → minor, `fix` and `perf` → patch. `chore` does not release. The project states that only changes that alter the published package trigger a release. — [semantic-release FAQ](https://semantic-release.org/support/faq/)
- Dependabot security updates are a separate stream from version updates. Grouping is optional and can be limited by `update-types`, so a security fix can be restricted to patch/minor or allowed to jump majors. GitHub still opens the security PR even if a version-update group already touches that package. — [Configuring Dependabot security updates](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-security-updates); [discussion #10645](https://github.com/dependabot/dependabot-core/discussions/10645)
- This package’s `security-critical` group selects production majors and then excludes every current production dependency. It is not wired to advisory severity. — [local dependabot.yml](file:///Users/llevintza/orca/workspaces/aws-fastify-prometheus/dependabot-stacked-prs/.github/dependabot.yml)
- AWS SDK minors have contained breaking changes while the major stayed at 3, and staff said those releases were not semver. A “security” bump inside `@aws-sdk/*` therefore cannot be trusted to be non-breaking just because the major digit did not move, nor to be breaking just because a future major digit does. — [aws-sdk-js-v3#5818](https://github.com/aws/aws-sdk-js-v3/issues/5818); [README release cadence](https://github.com/aws/aws-sdk-js-v3/blob/main/README.md)

### Inferences

- Rank is a function of contract delta, not of CVSS and not of the dependency major. Advisory severity can change review urgency and whether to split a group; it does not add a rank.
- Security fix, contract unchanged (typical AWS SDK bump while the client is unimported; prom-client patch that fixes a crash but keeps `metrics()` and scrape text): package patch. Publish it as `fix(deps)` so `^1.0.2` consumers receive it. Leaving it as `chore(deps)` publishes nothing, which is the wrong outcome for a production security fix.
- Security fix whose only non-vulnerable release is a dependency major, but this package can absorb it without a contract change (fastify-plugin major, or AWS major that the placeholder never calls): still package patch. Record the dependency major in the changelog. Do not open a 2.0.0 solely so the lockfile can move.
- Security fix that cannot be absorbed: prom-client major that changes `typeof register` or scrape output, Fastify peer range that drops v4, or any bump that raises `engines` above `>=22`. That PR is a package major because of the contract break. Consumers who stay on 1.x do not get the fix automatically. The practical consequence is a second patch release on 1.x when a compatible fix exists; when it does not, the advisory should say that the fix requires 2.x.
- “API surface” here includes behavior consumers observe, not only TypeScript exports: `getMetrics` / the scrape route, peer install range, and `engines`. A gauge that stops emitting zero, or exemplars that change from delta to value, is an API break even if no exported function signature changes.

### Gaps

- No maintainer guide found that requires a backport release when a security fix only exists in a new major. The backport recommendation above is an inference from SemVer’s caret compatibility, not a cited policy.
- No source found that maps CVSS or GitHub advisory severity onto SemVer. Absence of that mapping is consistent with SemVer, but it is not an explicit “do not do this” sentence in the SemVer spec.
- Whether any current advisory actually affects `@aws-sdk/client-cloudwatch` 3.859.0, `prom-client` 15.1.0, or `fastify-plugin` 6.0.1 was not looked up.

## How should CI/devDependency bumps (eslint, jest, typescript, semantic-release) affect the published package version—if at all?

### Takeaway

They should not change the published version. eslint, Jest, typescript, semantic-release, husky, prettier, commitlint, and GitHub Actions do not ship in the tarball. The exception is a dev bump that changes `engines`, the peer range, or the emitted `dist` JavaScript or `.d.ts` that users compile against. Production dependency bumps are different: they should be able to publish a patch, which the current `chore(deps)` prefix will not do under default semantic-release.

### Cited Findings

- DevDependency updates “should not usually even bump the version of the package.” Peer range changes do. — [8 Hobbies dependency-update semver](https://8hob.io/posts/semantic-versioning-npm-packages-after-dependency-update/)
- Default semantic-release rules: breaking → major, `feat` → minor, `fix` and `perf` → patch. `chore` is not a release. The FAQ says refactoring and code style do not trigger a release; features, fixes, and performance changes do. — [semantic-release FAQ](https://semantic-release.org/support/faq/); [commit-analyzer default rules](https://github.com/semantic-release/commit-analyzer)
- semantic-release maintainers, asked about Dependabot `chore(deps): bump …` not releasing: the Angular convention says `chore` does not release; use a `fix` commit for a production dependency update if a release is wanted. — [semantic-release#1329](https://github.com/semantic-release/semantic-release/issues/1329)
- This package’s Dependabot prefixes are `chore(deps)` and `prefix-development: chore(deps-dev)`. `semantic-release` is a devDependency (`^25.0.9`). `prepublishOnly` runs clean, build, and test, but the published `files` list is only `dist`, `README.md`, and `LICENSE`. DevDependencies in the manifest include eslint 10, Jest 30, typescript `^5.9.2`, semantic-release 25, husky, prettier, commitlint, and `fastify` `^5.5.0`. — [local package.json](file:///Users/llevintza/orca/workspaces/aws-fastify-prometheus/dependabot-stacked-prs/package.json); [local dependabot.yml](file:///Users/llevintza/orca/workspaces/aws-fastify-prometheus/dependabot-stacked-prs/.github/dependabot.yml)
- Groups that are entirely tooling: `linting-formatting` (eslint, prettier, husky, commitlint, lint-staged), `jest-testing`, `build-utilities` (rimraf, semantic-release), `typescript-ecosystem` (typescript, `@typescript-eslint/*`, `ts-*`, `@types/*` except node and jest), `node-ecosystem` (`@types/node`, `node`, `ts-node`). Each of those allows major+minor+patch in one PR. GitHub Actions are a separate ecosystem with prefix `chore(ci)`. — [local dependabot.yml](file:///Users/llevintza/orca/workspaces/aws-fastify-prometheus/dependabot-stacked-prs/.github/dependabot.yml)
- Raising the minimum Node version is a major. — [nodejs/package-maintenance versioning.md](https://github.com/nodejs/package-maintenance/blob/main/docs/versioning.md)
- AWS SDK’s 2026 TypeScript support table can force a consumer’s TypeScript compiler forward over time (for example, SDK support for TypeScript `<=5.5` ends 2027-01-04). This package compiles with typescript `^5.9.2`, which is inside the still-supported rows on that table. — [aws-sdk-js-v3 README](https://github.com/aws/aws-sdk-js-v3/blob/main/README.md)

### Inferences

- Default for `linting-formatting`, `jest-testing`, `build-utilities`, and `github-actions`: package release `none`. A major of eslint 10 → 11, Jest 30 → 31, or semantic-release 25 → 26 does not change what npm installs for an application. Shipping a package patch for those PRs would train consumers to treat version bumps as meaningless.
- `typescript-ecosystem` and `node-ecosystem`: default `none`, with a build check. If `tsc` output in `dist/` changes `.d.ts` in a way that fails a consumer compile, that is package major (broken types) or package minor (additive types only). If emitted JavaScript behavior changes, use the same contract test as a production code change. A TypeScript major that only fails CI until config is adjusted, and then emits the same `dist`, is still `none`.
- `fastify` inside `fastify-ecosystem-*` is the exception to “devDependency means none,” because it is also the peer. Classify the peer range and the `fp()` metadata, not the devDependency bump. If the PR only moves the devDependency from 5.5 to 5.x and leaves `^4 || ^5` and `4.x || 5.x` alone, release `none`.
- Production bumps must not stay on `chore(deps)` if they should publish. Map the classifier output onto commit type: `none` → `chore(deps-dev)` or `chore(ci)`; `patch` → `fix(deps)`; `minor` → `feat(deps)`; `major` → `feat(deps)!` or a `BREAKING CHANGE:` footer. Dependabot’s single `prefix` cannot express that per group. Either rewrite the commit after classification or add commit-analyzer `releaseRules` that understand a trailer the classifier writes. A trailer is safer than overloading `chore`.
- semantic-release upgrading itself is `none`. It changes how the next release is cut, not the current tarball.

### Gaps

- The installed semantic-release config (`.releaserc` or `release` key) was not opened, so it is not confirmed that this repo still uses the default Angular rules with no custom `releaseRules` for `chore(deps)`.
- No measurement was made of whether a typescript 5.9 → next-major compile changes this package’s emitted `.d.ts`. The “default none, then diff `dist`” step is a procedure, not a result.
- npm’s classification of `peerDependencies` as production vs development for `prefix-development` was not confirmed. `fastify` could receive either `chore(deps)` or `chore(deps-dev)`.

## What decision tree or rule table is clearest for automation and for human override?

### Takeaway

One table, applied per dependency, then `max` across the PR. Humans override with an explicit `Release-As` trailer that replaces the computed rank. The tree never reads the Dependabot group name as a severity, and it never promotes a bump to package minor just because the dependency major digit changed.

### Cited Findings

- SemVer’s public API is whatever the package declares; compatible dependency updates are patch or minor according to bug fix vs new functionality; incompatible public API changes are major. — [SemVer 2.0.0](https://semver.org/)
- Peer widen → package minor; peer major drop → package major; devDependency → usually no package bump; production dependency → patch unless the wrapped API changed. — [8 Hobbies](https://8hob.io/posts/semantic-versioning-npm-packages-after-dependency-update/)
- Highest release type wins when several rules match. `chore` matches nothing by default. Production dependency releases are done by emitting `fix`, not `chore`. — [commit-analyzer](https://github.com/semantic-release/commit-analyzer); [semantic-release#1329](https://github.com/semantic-release/semantic-release/issues/1329)
- Dependabot groups are first-match, version-updates unless `applies-to` is set, and all-or-nothing once combined. Security updates stay visible as their own PRs even if a version group includes the vulnerable package. — [Dependabot options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference); [Apache Dependabot guidance](https://infra.apache.org/dependabot.html); [discussion #10645](https://github.com/dependabot/dependabot-core/discussions/10645)
- Contract facts for the four special names are the citations in the first question: prom-client semver and the 2026 rename; fastify-plugin metadata vs Fastify major; AWS SDK minor cadence that is not semver; this repo’s peer range, `fp()` string, `getMetrics`, and unused CloudWatch client.

### Inferences

Rule table. First matching row for each dependency wins. “Contract” means exported types and values, `fastify.prometheus`, peer range, `fp()` `fastify` string, `engines.node`, and Prometheus scrape text.

| # | If | Package release |
| --- | --- | --- |
| 1 | GitHub Actions, or a devDependency that is not also a peer, and `dist` / `engines` / peer range are unchanged | `none` |
| 2 | Peer range or `fp()` `fastify` string drops a major, or raises a floor so a previously valid peer no longer installs, or `engines.node` moves up | `major` |
| 3 | Peer range adds a major and still accepts every previously valid peer | `minor` |
| 4 | `prom-client` (or a switch to `@prometheus-io/client`) changes `typeof register`, `metrics()` vs `Promise<string>`, or scrape text, including exemplar values and gauge zero | `major` |
| 5 | `prom-client` breaking note is only a Node floor already below `engines` `>=22`, and types and scrape text are unchanged | `patch` |
| 6 | `fastify-plugin` major or minor, `fp(plugin, { fastify, name })` still typechecks, register behavior unchanged | `patch` |
| 7 | `@aws-sdk/*` any level, client still not imported, `AwsExporterConfig` and exporter behavior unchanged | `patch`, plus a human-review flag |
| 8 | Production dependency adds caller-visible behavior without breaking the contract | `minor` |
| 9 | Production dependency patch, minor, or major with no contract change, including a security fix | `patch` |
| 10 | Anything the rows cannot decide (AWS changelog says breaking, prom-client “Breaking” that is not clearly in or out of the contract, `dist` diff after a TypeScript bump) | computed rank stays at the last confident row, and the PR is flagged for a human |

Group rollup, after the table:

1. `release = max(member ranks)` using `none < patch < minor < major`.
2. Ignore the group id (`aws-ecosystem`, `security-critical`, `fastify-ecosystem-major`) as a rank input. Use it only to decide review flags.
3. If any member is a security fix ranked `patch` and another member is `major`, split the security fix onto a patch PR. Do not wait for the major.
4. Emit one commit type for the rollup: `chore` (`none`), `fix` (`patch`), `feat` (`minor`), `feat!` (`major`). Do not leave a production `patch` on Dependabot’s `chore(deps)` prefix.

Human override, which replaces step 1 for that PR:

- Trailer `Release-As: none|patch|minor|major` on the commit, or the same value as a PR label the automation reads before release. Explicit value wins over the table, including over a computed `major`.
- The override is required (automation must not publish) when row 10 fired, when an `@aws-sdk/*` changelog entry says breaking or drops a Node version, when the peer string or `engines` changes, or when the PR mixes a security fix with a `major` member and nobody has split it.
- The override is optional everywhere else. A human who agrees with the table does nothing.
- Do not implement the override as semantic-release `release: false`. Use a positive `Release-As` value. commit-analyzer precedence between `release: false` and `major` is not a stable hook (see gaps on the previous question).

What this changes versus the baseline:

| Baseline | Tree |
| --- | --- |
| Dependency patch or minor → package patch | Production, contract unchanged → `patch`. Dev/CI → `none`. Peer widen → `minor`. |
| Dependency major → package minor | Not a default. Unchanged contract → `patch`. Broken contract → `major`. New exposed behavior → `minor`. |
| Substantial incompatibility → package major | Kept. “Substantial” is row 2 or row 4, not the size of the lockfile diff. |

Per-ecosystem defaults that fall out of the table, for reviewers who do not want to re-derive them:

| Update | Usual package release | Escalate when |
| --- | --- | --- |
| `prom-client` patch/minor | `patch` | changelog changes scrape text or `register` types (`minor` if purely additive metrics, `major` if existing scrapes or types break) |
| `prom-client` major, or rename to `@prometheus-io/client` | `major` | only a Node drop already covered by `>=22`, with a clean type and scrape diff → `patch` |
| `fastify-plugin` any level | `patch` | wrapped default-export type or `fp()` behavior breaks → `major` |
| `fastify` dev install inside the current peer | `none` | peer or `fp()` string shrinks → `major`; string grows and still includes 4 and 5 → `minor` |
| `@aws-sdk/client-cloudwatch` any level | `patch` | exporter starts requiring callers to change, or Node floor exceeds `engines` → `major`; new caller-visible export behavior → `minor` |
| eslint, Jest, prettier, husky, commitlint, semantic-release, rimraf, GitHub Actions | `none` | never, unless someone also edits shipped source in the same PR (then classify that source) |
| typescript, `@types/node`, ts-jest | `none` | `dist` `.d.ts` or runtime JS changes, or `engines` changes |

### Gaps

- The tree was not implemented or run against a historical Dependabot PR, so there is no measured false-major or false-patch rate.
- “Scrape text unchanged” needs a fixture this research did not add. Without a golden exposition file, row 4 vs row 5 is a human diff of the changelog, not a fully automatic check.
- No source gave a standard trailer name. `Release-As` is a proposed hook, chosen so it cannot be confused with commit-analyzer’s `release: false`.
