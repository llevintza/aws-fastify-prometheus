#!/usr/bin/env bash
# Stack open Dependabot PRs into a fixed merge order (bottom → top).
#
# Steps:
#   1. Hold check. A PR is held out of the stack (never rebased, force-pushed
#      or retargeted) when any commit on it was not authored by
#      dependabot[bot], or was committed by anyone other than web-flow,
#      github-actions[bot] (this script's restacks) or dependabot[bot]. Same
#      rule as the foreign-commit gate in dependabot-auto-merge.yml. A GitHub
#      "Update branch" merge commit counts as foreign too. Held PRs get a
#      marker comment and lose the `stacked` label.
#   2. Plan, locally only. Rebase every eligible PR onto the planned result
#      of the one below it, in a throwaway clone. Nothing is pushed and no PR
#      is edited. The first rebase conflict cuts the plan there, except:
#      npm_and_yarn branches get yarn.lock normalized. Git merges yarn.lock
#      as text, which can leave duplicate descriptor entries that
#      `yarn install --immutable` rejects (YN0028), failing CI on every PR
#      above the bottom. After each npm rebase, `yarn install
#      --mode=update-lockfile` rewrites yarn.lock and, if it changed, the
#      Dependabot commit is amended (author and full message, including the
#      updated-dependencies metadata, kept; committer github-actions[bot],
#      which the foreign-commit gate allows). A conflict only in yarn.lock
#      takes the lower branch's yarn.lock and lets Yarn re-resolve. If that
#      or the normalization fails, or the update ends up empty on the new
#      parent (a lockfile-only bump lost to the lower yarn.lock), the PR is
#      held out (conflict comment) and the next PR stacks on the same parent.
#      github_actions branches are rebased only.
#      Safety (pull_request_target, untrusted PR content): Yarn runs only on
#      Dependabot-authored branches that passed step 1, only when the PR
#      changes nothing but package.json / yarn.lock (so .yarnrc.yml, .yarn/
#      and plugins are the trunk's), adds no non-registry descriptor (git,
#      patch, portal, link, exec, file, URL) and its packageManager equals the trunk's,
#      with lifecycle scripts disabled, in update-lockfile mode (no link or
#      build step), and with an empty environment (env -i: no GH_TOKEN). The
#      token is never written to the clone: git gets it per command through
#      an env-scoped extraheader.
#   3. Apply, bottom → top, one PR at a time, in this order:
#        a. Retarget the PR base to its new parent (REST PATCH).
#        b. Force-push the rebased branch (--force-with-lease on the tip read
#           in step 2).
#        c. If (b) fails, PATCH the base back to what it was.
#      Why retarget first: GitHub diffs a PR against the merge base of head
#      and base. With the base already on the parent, the old head still
#      shows only its own commits, and after the push it sits on the parent.
#      Pushing first (the old order) left a window, and on a failed retarget
#      a permanent state, where the PR still targeted main but its branch
#      carried the parent's commits. A failed retarget now stops before any
#      push, and a failed push rolls the base back, so every PR is either
#      fully restacked or untouched. PRs below the failure stay consistent
#      (each was fully applied); PRs above it are not touched.
#      Native stacks: GitHub rejects a base change (HTTP 422 "part of a
#      stack") for a PR that is in a native stack. Before step 3a, the script
#      unstacks (REST POST stacks/<n>/unstack) every open stack that holds a
#      planned PR unless its open members are exactly the bottom of the
#      planned chain (equal to it or a prefix of it). That covers a stacked PR
#      whose base must change and a stack still holding a PR that left the
#      chain (held, cut by a conflict). A matching stack is left alone, so an
#      up-to-date stack costs no unstack and no retarget (only pushes when
#      the trunk moved). An unstack failure stops before any retarget or push.
#      With several stacks to dissolve, one already unstacked before a later
#      unstack fails stays unstacked (PRs unchanged) until the next run relinks.
#   4. Relink the chain as a native GitHub stack (REST Stacks API): no-op
#      when the existing stack already equals the chain, `add` the missing
#      top PRs when it is a prefix of the chain, otherwise create a new
#      stack. If step 3 failed part-way, the applied prefix (each PR fully
#      restacked) is relinked before exiting, so it is not left unstacked.
#      Chained bases alone are NOT a stack in the GitHub UI. The `stacked`
#      label is only added once this step succeeds.
#
# Merge order: GROUP_ORDER, bottom first. Security updates sit at the very
# bottom so they merge first: the security groups, then any single security
# PR (`security-update`: no known group, and its body carries the footer
# Dependabot adds only to security-update PRs). Majors still
# wait for a human (auto-merge only takes patch updates).
#
# GitHub API: every call is REST (`gh api`), so a classic PAT with only the
# `repo` / `public_repo` scope works. `gh pr edit` is NOT used: it queries
# org team fields over GraphQL and fails without `read:org`. The gh-stack
# extension is not needed: the script calls the Stacks REST API itself
# (list, unstack, create, add).
#
# Required env:
#   GH_TOKEN  — classic PAT (repo / public_repo scope) that can push to
#               dependabot/* branches (GITHUB_TOKEN usually cannot).
#   GH_REPO   — owner/repo (e.g. ${{ github.repository }})
#
# Optional env:
#   BASE_BRANCH — trunk branch (default: main)
#   DRY_RUN     — if "true", run the hold check and local plan (it clones and
#                 rebases in a temp dir), print every decision, and mutate
#                 nothing on GitHub
#
# Exit codes:
#   0 — stack applied (or nothing to do / dry-run)
#   1 — fatal error (auth, git, unexpected), or a retarget/push failed; the
#       failing PR was left or rolled back to its previous state
#   2 — rebase conflict; conflicting PR commented, chain cut there
#       (PRs below the conflict are still stacked and linked)
#   3 — native stack create/add failed; bases are chained but the PRs are
#       not (all) in a native stack

set -euo pipefail

BASE_BRANCH="${BASE_BRANCH:-main}"
DRY_RUN="${DRY_RUN:-false}"
STACK_LABEL="${STACK_LABEL:-stacked}"
MARKER_BEGIN="<!-- dependabot-stack-order -->"
MARKER_END="<!-- /dependabot-stack-order -->"
HOLD_MARKER_BEGIN="<!-- dependabot-stack-hold -->"
HOLD_MARKER_END="<!-- /dependabot-stack-hold -->"
CONFLICT_MARKER="<!-- dependabot-stack-conflict -->"
MISBASED_MARKER="<!-- dependabot-stack-misbased -->"

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "ERROR: GH_TOKEN is required (classic PAT, repo scope, push to dependabot/*)." >&2
  exit 1
fi
if [[ -z "${GH_REPO:-}" ]]; then
  echo "ERROR: GH_REPO is required (owner/repo)." >&2
  exit 1
fi

export GH_TOKEN GH_REPO

# Fixed merge order: bottom (index 0) → top. Unknown groups sort after these by PR number.
# Every security update sits at the bottom so fixes merge first: the grouped
# security PRs, then single security PRs (`security-update`, set in main, not
# a dependabot.yml group). Security majors are at the bottom too, so they are
# reviewed first; auto-merge still holds them for a human.
# detect_group prefers the longest match, so `actions-security-*` beats the
# npm `security-*` names it contains.
GROUP_ORDER=(
  security-patch-minor
  actions-security-patch-minor
  security-update
  security-major
  actions-security-major
  github-actions-official
  security-actions
  dependency-actions
  node-ecosystem
  typescript-ecosystem
  linting-formatting
  jest-testing
  build-utilities
  monitoring-tools
  aws-ecosystem
  fastify-ecosystem
  other-dependencies
  security-critical
  fastify-ecosystem-major
)

group_rank() {
  local group="$1"
  local i
  for i in "${!GROUP_ORDER[@]}"; do
    if [[ "${GROUP_ORDER[$i]}" == "$group" ]]; then
      echo "$i"
      return 0
    fi
  done
  echo "999"
}

# Detect Dependabot group from branch name, title, and labels.
# Branch examples:
#   dependabot/npm_and_yarn/fastify-ecosystem/...
#   dependabot/github_actions/github-actions-official/...
# Title examples:
#   Bump the fastify-ecosystem group with 3 updates
detect_group() {
  local branch="$1"
  local title="$2"
  local labels="$3"
  local haystack candidate

  haystack=$(printf '%s\n%s\n%s' "$branch" "$title" "$labels" | tr '[:upper:]' '[:lower:]')

  # Prefer longest / most specific known group name present in haystack
  local best="" best_len=0
  for candidate in "${GROUP_ORDER[@]}"; do
    if grep -Fqi -- "$candidate" <<<"$haystack"; then
      if (( ${#candidate} > best_len )); then
        best="$candidate"
        best_len=${#candidate}
      fi
    fi
  done
  if [[ -n "$best" ]]; then
    echo "$best"
    return 0
  fi

  # Fallback: extract token after ecosystem path segment
  # dependabot/<ecosystem>/<group>/...
  if [[ "$branch" =~ ^dependabot/[^/]+/([^/]+) ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi

  echo "unknown"
}

list_dependabot_prs() {
  # Fields: number|headRefName|baseRefName|title|labels(csv)|url|security(0/1)
  # REST reports the Dependabot author as `dependabot[bot]`. security=1 when
  # the body carries the footer Dependabot adds only to security-update PRs
  # ("You can disable automated security fix PRs for this repo ..."). If
  # GitHub rewords that footer, single security PRs silently fall back to
  # rank 999 (order only; nothing breaks): update the test below.
  # A GHSA match is NOT used: copied release notes and changelogs in version
  # updates often cite GHSA IDs.
  gh api --paginate "repos/${GH_REPO}/pulls?state=open&per_page=100" --jq '
    .[]
    | select(.user.login == "dependabot[bot]")
    | [
        (.number|tostring),
        .head.ref,
        .base.ref,
        (.title | gsub("\\|"; "/")),
        ([.labels[].name] | join(",")),
        .html_url,
        (if ((.body // "") | test("automated security fix PRs"; "i"))
         then "1" else "0" end)
      ]
    | join("|")
  '
}

# --- native stacks (REST Stacks API) ---
# PR_STACK[pr]=stack number, STACK_MEMBERS[stack]="open PRs bottom → top".
declare -A PR_STACK=()
declare -A STACK_MEMBERS=()

load_stacks() {
  local out line snum members p
  PR_STACK=()
  STACK_MEMBERS=()
  if ! out=$(gh api --paginate "repos/${GH_REPO}/stacks?per_page=100" --jq '
      .[] | select(.open)
      | "\(.number)|\([.pull_requests[] | select(.state == "open" and .merged_at == null)
                       | .number | tostring] | join(" "))"'); then
    return 1
  fi
  while IFS='|' read -r snum members; do
    [[ -z "$snum" || -z "$members" ]] && continue
    STACK_MEMBERS[$snum]="$members"
    for p in $members; do
      PR_STACK[$p]="$snum"
    done
  done <<<"$out"
}

# Make STACK_PRS one native stack: no-op if it already is, extend a stack
# that holds a prefix of it, else create one. Returns 1 on failure.
link_stack() {
  local -a want=("$@")
  local bottom="${want[0]}" snum existing payload
  local -a have delta
  snum="${PR_STACK[$bottom]:-}"
  if [[ -n "$snum" ]]; then
    existing="${STACK_MEMBERS[$snum]}"
    read -r -a have <<<"$existing"
    if [[ "$existing" == "${want[*]}" ]]; then
      echo "Native stack #$snum already matches (${#want[@]} PRs); no change."
      STACK_ACTIONS+=("kept native stack #$snum as is")
      return 0
    fi
    if [[ "${want[*]}" == "$existing "* ]]; then
      delta=("${want[@]:${#have[@]}}")
      payload=$(printf '{"pull_requests":[%s]}' "$(IFS=,; echo "${delta[*]}")")
      if [[ "$DRY_RUN" == "true" ]]; then
        echo "[dry-run] would add ${delta[*]} to native stack #$snum (REST POST stacks/$snum/add)"
      elif ! gh api -X POST "repos/${GH_REPO}/stacks/${snum}/add" --input - <<<"$payload" >/dev/null; then
        echo "ERROR: adding ${delta[*]} to native stack #$snum failed." >&2
        return 1
      fi
      STACK_ACTIONS+=("add ${delta[*]} to native stack #$snum")
      return 0
    fi
    echo "ERROR: #$bottom is in native stack #$snum (${existing}), which does not match the chain." >&2
    return 1
  fi
  payload=$(printf '{"pull_requests":[%s]}' "$(IFS=,; echo "${want[*]}")")
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] would create a native stack: ${want[*]} (REST POST stacks)"
  elif ! snum=$(gh api -X POST "repos/${GH_REPO}/stacks" --input - --jq .number <<<"$payload"); then
    echo "ERROR: creating the native stack ${want[*]} failed." >&2
    return 1
  else
    echo "Created native stack #$snum."
  fi
  STACK_ACTIONS+=("create native stack: ${want[*]}")
}

# Print why a PR must be held out of the stack, or nothing when every commit
# is Dependabot's. Same author/committer rule as dependabot-auto-merge.yml.
# Fails closed: an unreadable or truncated commit list is a hold.
hold_reason() {
  local pr_number="$1"
  local reason
  if ! reason=$(gh api "repos/${GH_REPO}/pulls/${pr_number}/commits?per_page=100" --jq '
      if length >= 100 then
        "commit list hit the 100-commit page limit; authorship cannot be verified"
      else
        [ .[]
          | select(
              # foreign-commit-gate:begin (CI fails if this differs from the other copy)
              ((.author.login // "") != "dependabot[bot]")
              or ((.committer.login // "")
                  | IN("web-flow", "github-actions[bot]", "dependabot[bot]") | not)
              # foreign-commit-gate:end
            )
          | "\(.sha[0:7]) (author \(.author.login // "unknown"), committer \(.committer.login // "unknown"))"
        ]
        | if length == 0 then "" else "\(length) non-Dependabot commit(s): \(join(", "))" end
      end
    '); then
    reason="could not list the PR commits (API error); authorship cannot be verified"
  fi
  printf '%s' "$reason"
}

# Id of the first comment on a PR whose body contains the marker, or nothing.
find_marker_comment() {
  local pr_number="$1"
  local marker="$2"
  gh api --paginate "repos/${GH_REPO}/issues/${pr_number}/comments?per_page=100" \
    --jq ".[] | select(.body | contains(\"${marker}\")) | .id" 2>/dev/null | head -n 1 || true
}

upsert_marker_comment() {
  local pr_number="$1"
  local marker="$2"
  local body="$3"
  local existing

  existing=$(find_marker_comment "$pr_number" "$marker")
  if [[ -n "${existing:-}" ]]; then
    gh api -X PATCH "repos/${GH_REPO}/issues/comments/${existing}" -f body="$body" >/dev/null
  else
    gh api -X POST "repos/${GH_REPO}/issues/${pr_number}/comments" -f body="$body" >/dev/null
  fi
}

delete_marker_comment() {
  local pr_number="$1"
  local marker="$2"
  local existing

  existing=$(find_marker_comment "$pr_number" "$marker")
  if [[ -n "${existing:-}" ]]; then
    gh api -X DELETE "repos/${GH_REPO}/issues/comments/${existing}" >/dev/null 2>&1 || true
  fi
}

ensure_label() {
  local name="$1"
  if gh api "repos/${GH_REPO}/labels/${name}" >/dev/null 2>&1; then
    return 0
  fi
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] would create label: $name"
    return 0
  fi
  gh api -X POST "repos/${GH_REPO}/labels" -f name="$name" -f color="0E8A16" \
    -f description="Part of an ordered Dependabot PR stack" >/dev/null || true
}

add_stacked_label() {
  local pr_number="$1"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] would label #$pr_number with $STACK_LABEL"
    return 0
  fi
  gh api -X POST "repos/${GH_REPO}/issues/${pr_number}/labels" \
    -f "labels[]=${STACK_LABEL}" >/dev/null 2>&1 || true
}

remove_stacked_label() {
  local pr_number="$1"
  local labels="$2"
  if ! grep -qx -- "$STACK_LABEL" <<<"${labels//,/$'\n'}"; then
    return 0
  fi
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] would remove label $STACK_LABEL from #$pr_number"
    return 0
  fi
  gh api -X DELETE "repos/${GH_REPO}/issues/${pr_number}/labels/${STACK_LABEL}" >/dev/null 2>&1 || true
}

set_pr_base() {
  local pr_number="$1"
  local base="$2"
  gh api -X PATCH "repos/${GH_REPO}/pulls/${pr_number}" -f base="$base" >/dev/null
}

comment_hold() {
  local pr_number="$1"
  local reason="$2"
  local body

  body=$(cat <<EOF
${HOLD_MARKER_BEGIN}
⏸️ **Held out of the Dependabot stack**

This branch has commits that Dependabot did not author, or that someone other
than Dependabot or the stack workflow committed, so the stack workflow will not
rebase, force-push or retarget it:

- ${reason}

Merge or update it by hand, or close it so Dependabot recreates it. The stack
workflow takes it back once every commit on the branch is Dependabot's.
${HOLD_MARKER_END}
EOF
)

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] would upsert hold comment on #$pr_number"
    return 0
  fi
  # A conflict fixed by hand makes the PR held; drop the stale conflict note.
  delete_marker_comment "$pr_number" "$CONFLICT_MARKER"
  upsert_marker_comment "$pr_number" "$HOLD_MARKER_BEGIN" "$body"
}

# Push failed after the retarget AND the base rollback failed: the PR now
# targets a parent its branch was never rebased onto, so its diff can show the
# parent's commits. Make that visible on the PR, not only in the run log.
comment_misbased() {
  local pr_number="$1"
  local current_base="$2"
  local wanted_base="$3"
  local body

  body=$(cat <<EOF
${MISBASED_MARKER}
🚨 **Dependabot stack left this PR on the wrong base**

The stack workflow retargeted this PR to \`${current_base}\`, the force-push of
the rebased branch failed, and rolling the base back to \`${wanted_base}\` also
failed. The diff may include another PR's commits. Set the base back to
\`${wanted_base}\` by hand, then re-run **Dependabot Stack**.
EOF
)
  upsert_marker_comment "$pr_number" "$MISBASED_MARKER" "$body" || \
    echo "ERROR: could not comment on #$pr_number either." >&2
}

comment_conflict() {
  local pr_number="$1"
  local onto_branch="$2"
  local detail="$3"
  local outcome="${4:-Stack mutation stopped at this PR so later layers were not retargeted onto a broken base.}"
  local body

  body=$(cat <<EOF
⚠️ **Dependabot stack rebase conflict**

Could not rebase this PR onto \`${onto_branch}\` while building the Dependabot stack.

\`\`\`
${detail}
\`\`\`

**Next steps**
1. Resolve conflicts locally on this branch, or close/recreate the Dependabot PR.
2. Re-run **Dependabot Stack** (\`workflow_dispatch\`) after the conflict is fixed.
3. ${outcome}

${CONFLICT_MARKER}
conflict onto: ${onto_branch}
EOF
)

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] would comment conflict on #$pr_number"
    return 0
  fi
  upsert_marker_comment "$pr_number" "$CONFLICT_MARKER" "$body"
}

# --- git auth and yarn.lock normalization (plan phase, local clone) ---

# The token travels in an env-scoped http extraheader (GIT_CONFIG_*), never in
# the clone URL or the clone's .git/config, so Yarn cannot read it from disk.
GIT_AUTH_B64=$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 | tr -d '\n')
git_auth() {
  GIT_CONFIG_COUNT=1 \
    GIT_CONFIG_KEY_0="http.https://github.com/.extraheader" \
    GIT_CONFIG_VALUE_0="AUTHORIZATION: basic ${GIT_AUTH_B64}" \
    git "$@"
}

# Yarn with an empty environment: no GH_TOKEN or other secrets, lifecycle
# scripts off. Corepack picks the Yarn version from package.json, which
# normalize_lockfile pins to the trunk's packageManager first.
yarn_clean() {
  env -i PATH="$PATH" HOME="$HOME" COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    YARN_ENABLE_SCRIPTS=0 YARN_ENABLE_TELEMETRY=0 YARN_ENABLE_PROGRESS_BARS=0 \
    yarn "$@"
}

# Rebasing npm branches merges yarn.lock as text, which can leave duplicate
# descriptor entries that `yarn install --immutable` rejects (YN0028). Rewrite
# yarn.lock in canonical form on the working tree: sets LOCK_CHANGED=1 when it
# changed. Returns 1 with LOCK_ERR when Yarn may not or could not run.
# Trust gate before Yarn runs on Dependabot content: the PR may only change
# package.json and yarn.lock (so .yarnrc.yml, .yarn/ and plugins are the
# trunk's), and packageManager must equal the trunk's.
normalize_lockfile() {
  local parent_ref="$1" files pm_tree pm_base out
  LOCK_CHANGED=0
  LOCK_ERR=""
  files=$(git diff --name-only "$parent_ref")
  if grep -vxE 'package\.json|yarn\.lock' <<<"$files" | grep -q .; then
    LOCK_ERR="the PR changes files other than package.json / yarn.lock; Yarn was not run"
    return 1
  fi
  # Registry versions only: git, patch, portal, link, exec and file
  # descriptors can make Yarn pack, prepare or run code even with scripts off.
  if git diff "$parent_ref" -- package.json | grep '^+' \
      | grep -qE '"(git[+:]|github:|gitlab:|bitbucket:|patch:|portal:|link:|exec:|file:|https?://)'; then
    LOCK_ERR="package.json adds a non-registry dependency descriptor; Yarn was not run"
    return 1
  fi
  pm_tree=$(jq -r '.packageManager // ""' package.json)
  pm_base=$(git show "origin/${BASE_BRANCH}:package.json" | jq -r '.packageManager // ""')
  if [[ "$pm_tree" != "$pm_base" ]]; then
    LOCK_ERR="packageManager ${pm_tree} differs from ${BASE_BRANCH} (${pm_base}); Yarn was not run"
    return 1
  fi
  if ! out=$(yarn_clean install --mode=update-lockfile 2>&1); then
    LOCK_ERR="yarn install --mode=update-lockfile failed: $(tail -n 5 <<<"$out")"
    return 1
  fi
  if ! git diff --quiet -- yarn.lock; then
    LOCK_CHANGED=1
  fi
}

# A rebase stopped on conflicts: when only yarn.lock conflicts, take the lower
# branch's yarn.lock (rebase "ours"), let Yarn re-resolve the PR's
# package.json on top of it, and continue. Returns 1 with LOCK_ERR otherwise.
resolve_lock_conflicts() {
  local parent_ref="$1" rounds=0
  while [[ -d .git/rebase-merge || -d .git/rebase-apply ]]; do
    rounds=$((rounds + 1))
    if (( rounds > 20 )); then
      LOCK_ERR="gave up after 20 conflicted commits"
      return 1
    fi
    if [[ "$(git diff --name-only --diff-filter=U)" != "yarn.lock" ]]; then
      LOCK_ERR="conflict outside yarn.lock: $(git diff --name-only --diff-filter=U | tr '\n' ' ')"
      return 1
    fi
    # Stage the lower branch's yarn.lock first, so the index is merged before
    # Yarn runs (LOCK_CHANGED is not used on this path).
    git checkout --ours -- yarn.lock
    git add yarn.lock
    normalize_lockfile "$parent_ref" || return 1
    git add yarn.lock
    if ! GIT_EDITOR=true git rebase --continue >/dev/null 2>&1 \
        && [[ -z "$(git diff --name-only --diff-filter=U)" ]]; then
      LOCK_ERR="rebase could not continue after re-resolving yarn.lock (the update may be empty on the new parent)"
      return 1
    fi
  done
}

# --- main ---

echo "Listing open Dependabot PRs for $GH_REPO (base trunk: $BASE_BRANCH, dry_run: $DRY_RUN)..."

if ! pr_output=$(list_dependabot_prs); then
  echo "ERROR: could not list open PRs for $GH_REPO." >&2
  exit 1
fi
mapfile -t PR_LINES <<<"$pr_output"

if [[ ${#PR_LINES[@]} -eq 0 || -z "${PR_LINES[0]:-}" ]]; then
  echo "No open Dependabot PRs; nothing to stack."
  exit 0
fi

# Build sortable records: rank-pr|pr|head|base|title|labels|url|group
RECORDS=()
for line in "${PR_LINES[@]}"; do
  IFS='|' read -r num head base title labels url security <<<"$line"
  group=$(detect_group "$head" "$title" "$labels")
  rank=$(group_rank "$group")
  # A single (ungrouped) security PR goes to the bottom with the groups.
  if [[ "$rank" == "999" && "$security" == "1" ]]; then
    group="security-update"
    rank=$(group_rank "$group")
  fi
  # Pad rank and PR number for lexical sort; unknown groups (999) then by PR asc.
  # The key must be ONE '|'-field: readers split records with IFS='|'.
  printf -v key "%03d-%06d" "$rank" "$num"
  RECORDS+=("${key}|${num}|${head}|${base}|${title}|${labels}|${url}|${group}")
done

mapfile -t SORTED < <(printf '%s\n' "${RECORDS[@]}" | LC_ALL=C sort)

# --- 1. hold check ---

echo ""
echo "Hold check (every commit must be authored by dependabot[bot]):"
ELIGIBLE=()
HELD_LINES=()
for rec in "${SORTED[@]}"; do
  IFS='|' read -r _key num head base title labels url group <<<"$rec"
  reason=$(hold_reason "$num")
  if [[ -n "$reason" ]]; then
    echo "  SKIP #$num ($group): held out of the stack; $reason"
    HELD_LINES+=("#${num} (${group}, base ${base}): ${reason}")
    comment_hold "$num" "$reason"
    remove_stacked_label "$num" "$labels"
  else
    echo "  ok   #$num ($group)"
    ELIGIBLE+=("$rec")
  fi
done

echo ""
echo "Planned stack (bottom → top):"
for rec in "${ELIGIBLE[@]}"; do
  IFS='|' read -r _key num head base title labels url group <<<"$rec"
  echo "  #$num  group=${group}  head=${head}  current_base=${base}"
done
if [[ ${#ELIGIBLE[@]} -eq 0 ]]; then
  echo "  (none)"
fi

# --- 2. plan (local only) ---

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

PLAN_NUM=()
PLAN_HEAD=()
PLAN_OLD_BASE=()
PLAN_NEW_BASE=()
PLAN_OLD_SHA=()
PLAN_GROUP=()
CONFLICT_NUM=""
CONFLICT_ONTO=""
CONFLICT_LOG=""
LOCK_HOLD_NUM=()
LOCK_HOLD_ONTO=()
LOCK_HOLD_LOG=()
LOCK_HOLD_LABELS=()
LOCK_HOLD_LINES=()

if [[ ${#ELIGIBLE[@]} -gt 0 ]]; then
  # Full clone (blobless clones break rebase content resolution). No token
  # in the URL or config: git_auth passes it per command.
  git_auth clone --quiet --no-tags "https://github.com/${GH_REPO}.git" "$WORK_DIR/repo"
  cd "$WORK_DIR/repo"
  git_auth fetch --quiet origin "$BASE_BRANCH"
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

  # npm branches get yarn.lock normalized below; fail before any mutation if
  # Yarn (Corepack, the trunk's packageManager) cannot run here.
  if printf '%s\n' "${ELIGIBLE[@]}" | cut -d'|' -f3 | grep -q '^dependabot/npm_and_yarn/'; then
    if ! yarn_version=$(yarn_clean --version 2>&1); then
      echo "ERROR: Yarn is not available (Corepack + Node from .nvmrc): ${yarn_version}" >&2
      exit 1
    fi
    echo "Yarn ${yarn_version} (scripts disabled) normalizes yarn.lock on npm branches."
  fi

  echo ""
  echo "Planning rebases locally (nothing is pushed in this phase)..."
  PREV_BRANCH="$BASE_BRANCH"
  PREV_REF="origin/${BASE_BRANCH}"
  for rec in "${ELIGIBLE[@]}"; do
    IFS='|' read -r _key num head base title labels url group <<<"$rec"
    # Fetch the head and its CURRENT base (pre-push tips: nothing is pushed
    # until step 3). Replaying only <current base>..<head> rebases exactly the
    # commits the hold check verified, so a PR that sat on a held branch can
    # never carry that branch's foreign commits onto its new parent.
    if ! git_auth fetch --quiet origin \
        "+refs/heads/${head}:refs/remotes/origin/${head}" \
        "+refs/heads/${base}:refs/remotes/origin/${base}"; then
      echo "ERROR: could not fetch ${head} or its base ${base} for #$num; nothing was mutated." >&2
      exit 1
    fi
    old_sha=$(git rev-parse "origin/${head}")
    git checkout --quiet -B "stack-${num}" "$old_sha"
    is_npm=0
    if [[ "$head" == dependabot/npm_and_yarn/* ]]; then
      is_npm=1
    fi
    lock_note=""

    rebase_log=""
    set +e
    rebase_log=$(git rebase --onto "$PREV_REF" "origin/${base}" 2>&1)
    rebase_rc=$?
    set -e
    if [[ $rebase_rc -ne 0 ]]; then
      if [[ $is_npm -eq 1 && "$(git diff --name-only --diff-filter=U)" == "yarn.lock" ]]; then
        if resolve_lock_conflicts "$PREV_REF"; then
          lock_note="yarn.lock conflict re-resolved; "
        else
          git rebase --abort 2>/dev/null || true
          git reset -q --hard
          echo "  HOLD #$num: yarn.lock conflict onto ${PREV_BRANCH} not resolvable (${LOCK_ERR}); next PR stacks on ${PREV_BRANCH}"
          LOCK_HOLD_NUM+=("$num")
          LOCK_HOLD_ONTO+=("$PREV_BRANCH")
          LOCK_HOLD_LOG+=("${LOCK_ERR}"$'\n\n'"${rebase_log}")
          LOCK_HOLD_LABELS+=("$labels")
          LOCK_HOLD_LINES+=("#${num} (${group}): ${LOCK_ERR}")
          continue
        fi
      else
        git rebase --abort 2>/dev/null || true
        echo "  CONFLICT #$num onto ${PREV_BRANCH}; the stack is cut here"
        CONFLICT_NUM="$num"
        CONFLICT_ONTO="$PREV_BRANCH"
        CONFLICT_LOG="$rebase_log"
        break
      fi
    fi

    # Normalize yarn.lock on npm branches and fold it into the Dependabot
    # commit (amend keeps its author and full message, including the
    # updated-dependencies metadata; the committer becomes github-actions[bot],
    # which the foreign-commit gate allows). No extra commit.
    if [[ $is_npm -eq 1 ]]; then
      if ! normalize_lockfile "$PREV_REF"; then
        git reset -q --hard
        echo "  HOLD #$num: yarn.lock could not be normalized (${LOCK_ERR}); next PR stacks on ${PREV_BRANCH}"
        LOCK_HOLD_NUM+=("$num")
        LOCK_HOLD_ONTO+=("$PREV_BRANCH")
        LOCK_HOLD_LOG+=("$LOCK_ERR")
        LOCK_HOLD_LABELS+=("$labels")
        LOCK_HOLD_LINES+=("#${num} (${group}): ${LOCK_ERR}")
        continue
      fi
      if [[ $LOCK_CHANGED -eq 1 ]]; then
        git add yarn.lock
        git commit --quiet --amend --no-edit
        lock_note+="normalize yarn.lock (amend); "
      fi
      git reset -q --hard
    fi

    # Never push a PR whose update vanished on the new parent (for example a
    # yarn.lock-only bump whose conflict was resolved with the lower lockfile).
    if git diff --quiet "$PREV_REF" HEAD; then
      git reset -q --hard
      LOCK_ERR="the update is empty on ${PREV_BRANCH} (a lockfile-only change lost to the lower PR's yarn.lock); comment \`@dependabot recreate\` once the PRs below merge"
      echo "  HOLD #$num: ${LOCK_ERR}"
      LOCK_HOLD_NUM+=("$num")
      LOCK_HOLD_ONTO+=("$PREV_BRANCH")
      LOCK_HOLD_LOG+=("$LOCK_ERR")
      LOCK_HOLD_LABELS+=("$labels")
      LOCK_HOLD_LINES+=("#${num} (${group}): ${LOCK_ERR}")
      continue
    fi

    PLAN_NUM+=("$num")
    PLAN_HEAD+=("$head")
    PLAN_OLD_BASE+=("$base")
    PLAN_NEW_BASE+=("$PREV_BRANCH")
    PLAN_OLD_SHA+=("$old_sha")
    PLAN_GROUP+=("$group")

    new_sha=$(git rev-parse HEAD)
    action="$lock_note"
    if [[ "$base" != "$PREV_BRANCH" ]]; then
      action+="retarget ${base} → ${PREV_BRANCH}; "
    fi
    if [[ "$new_sha" != "$old_sha" ]]; then
      action+="push ${old_sha:0:7} → ${new_sha:0:7}; "
    fi
    echo "  #$num: ${action:-no change}"

    PREV_BRANCH="$head"
    PREV_REF="stack-${num}"
  done
fi

# --- 3. apply (bottom → top; retarget, then push, roll back on push failure) ---

STACK_PRS=()
CHAIN_LINES=()
PUSHED_BRANCHES=()
STACK_ACTIONS=()
APPLY_FAILED=0

if [[ ${#PLAN_NUM[@]} -gt 0 ]]; then
  if ! load_stacks; then
    echo "ERROR: could not list native stacks (REST GET stacks); nothing was mutated." >&2
    exit 1
  fi
  # Keep a stack only when its open members are exactly the bottom of the
  # planned chain (equal to it or a prefix of it): every member then already
  # chains as planned and link_stack can keep or extend it. Unstack any other
  # stack that holds a planned PR, because either one of its PRs must change
  # base (GitHub answers HTTP 422 for a stacked PR) or it holds a PR that is
  # no longer in the chain (held, cut by a conflict), which would make the
  # relink fail on every run.
  declare -A UNSTACK_WHY=()
  for idx in "${!PLAN_NUM[@]}"; do
    snum="${PR_STACK[${PLAN_NUM[$idx]}]:-}"
    if [[ -z "$snum" || -n "${UNSTACK_WHY[$snum]:-}" ]]; then
      continue
    fi
    members="${STACK_MEMBERS[$snum]}"
    if [[ "${PLAN_NUM[*]} " == "$members "* ]]; then
      continue
    fi
    why=""
    for m in $members; do
      if [[ " ${PLAN_NUM[*]} " != *" $m "* ]]; then
        why+="#$m is not in the chain; "
      fi
    done
    for j in "${!PLAN_NUM[@]}"; do
      if [[ "${PR_STACK[${PLAN_NUM[$j]}]:-}" == "$snum" \
          && "${PLAN_OLD_BASE[$j]}" != "${PLAN_NEW_BASE[$j]}" ]]; then
        why+="#${PLAN_NUM[$j]} changes base; "
      fi
    done
    UNSTACK_WHY[$snum]="${why:-order differs from the chain; }"
  done
  echo ""
  if [[ ${#UNSTACK_WHY[@]} -eq 0 ]]; then
    echo "Native stacks: no unstack needed (existing stack already matches the chain bottom)."
  fi
  for snum in "${!UNSTACK_WHY[@]}"; do
    why="${UNSTACK_WHY[$snum]%; }"
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "[dry-run] would unstack native stack #$snum (${STACK_MEMBERS[$snum]}): ${why}"
    elif gh api -X POST "repos/${GH_REPO}/stacks/${snum}/unstack" >/dev/null; then
      echo "Unstacked native stack #$snum (${STACK_MEMBERS[$snum]}): ${why}"
    else
      echo "ERROR: unstack of native stack #$snum failed; nothing was retargeted or pushed." >&2
      APPLY_FAILED=1
      break
    fi
    STACK_ACTIONS+=("unstack native stack #$snum (${why})")
    for p in ${STACK_MEMBERS[$snum]}; do
      unset "PR_STACK[$p]"
    done
    unset "STACK_MEMBERS[$snum]"
  done
fi

for idx in "${!PLAN_NUM[@]}"; do
  if [[ $APPLY_FAILED -eq 1 ]]; then
    break
  fi
  num="${PLAN_NUM[$idx]}"
  head="${PLAN_HEAD[$idx]}"
  old_base="${PLAN_OLD_BASE[$idx]}"
  new_base="${PLAN_NEW_BASE[$idx]}"
  old_sha="${PLAN_OLD_SHA[$idx]}"
  group="${PLAN_GROUP[$idx]}"
  new_sha=$(git rev-parse "stack-${num}")
  pos=$((idx + 1))

  echo ""
  echo "[$pos/${#PLAN_NUM[@]}] Stacking #$num ($group) onto ${new_base}..."

  retargeted=0
  if [[ "$old_base" != "$new_base" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "[dry-run] would retarget #$num base: ${old_base} → ${new_base} (REST PATCH)"
    elif set_pr_base "$num" "$new_base"; then
      retargeted=1
      echo "Retargeted #$num base: ${old_base} → ${new_base}"
    else
      echo "ERROR: retarget of #$num to ${new_base} failed; nothing pushed for #$num. Stopping." >&2
      APPLY_FAILED=1
      break
    fi
  else
    echo "Base already ${new_base} for #$num"
  fi

  if [[ "$new_sha" != "$old_sha" ]]; then
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "[dry-run] would force-push ${head}: ${old_sha:0:7} → ${new_sha:0:7} (--force-with-lease)"
    elif git_auth push --quiet --force-with-lease="refs/heads/${head}:${old_sha}" origin \
        "stack-${num}:refs/heads/${head}"; then
      PUSHED_BRANCHES+=("$head")
      echo "Pushed ${head}: ${old_sha:0:7} → ${new_sha:0:7}"
    else
      echo "ERROR: force-with-lease push failed for ${head}; refusing to overwrite unexpected remote tip." >&2
      if [[ $retargeted -eq 1 ]]; then
        if set_pr_base "$num" "$old_base"; then
          echo "Rolled #$num base back to ${old_base}." >&2
        else
          echo "ERROR: rollback of #$num base to ${old_base} FAILED; fix the base by hand." >&2
          comment_misbased "$num" "$new_base" "$old_base"
        fi
      fi
      APPLY_FAILED=1
      break
    fi
  else
    echo "No rebase change for ${head}; skip push."
  fi

  if [[ "$DRY_RUN" != "true" ]]; then
    delete_marker_comment "$num" "$HOLD_MARKER_BEGIN"
    delete_marker_comment "$num" "$MISBASED_MARKER"
    delete_marker_comment "$num" "$CONFLICT_MARKER"
  fi
  STACK_PRS+=("$num")
  CHAIN_LINES+=("${pos}. #${num} (${group}) → base \`${new_base}\`")
done

for idx in "${!LOCK_HOLD_NUM[@]}"; do
  comment_conflict "${LOCK_HOLD_NUM[$idx]}" "${LOCK_HOLD_ONTO[$idx]}" "${LOCK_HOLD_LOG[$idx]}" \
    "This PR is held out of the stack (yarn.lock conflict, normalization failure or empty update); the PRs above it were stacked without it."
  remove_stacked_label "${LOCK_HOLD_NUM[$idx]}" "${LOCK_HOLD_LABELS[$idx]}"
done

if [[ -n "$CONFLICT_NUM" && $APPLY_FAILED -eq 0 ]]; then
  echo ""
  echo "CONFLICT rebasing #$CONFLICT_NUM onto ${CONFLICT_ONTO}"
  comment_conflict "$CONFLICT_NUM" "$CONFLICT_ONTO" "$CONFLICT_LOG"
fi

print_summary() {
  local rec num head base _key title labels url group b
  echo ""
  echo "===== Dependabot stack summary (dry_run: $DRY_RUN) ====="
  echo "Stacked (bottom → top): ${#STACK_PRS[@]}"
  if [[ ${#CHAIN_LINES[@]} -gt 0 ]]; then
    printf '  %s\n' "${CHAIN_LINES[@]}"
  fi
  echo "Native stack actions: ${#STACK_ACTIONS[@]}"
  if [[ ${#STACK_ACTIONS[@]} -gt 0 ]]; then
    printf '  %s\n' "${STACK_ACTIONS[@]}"
  fi
  echo "Held out (non-Dependabot commits; not rebased, pushed or retargeted): ${#HELD_LINES[@]}"
  if [[ ${#HELD_LINES[@]} -gt 0 ]]; then
    printf '  SKIP %s\n' "${HELD_LINES[@]}"
  fi
  echo "Held out (yarn.lock conflict, normalization failure or empty update): ${#LOCK_HOLD_LINES[@]}"
  if [[ ${#LOCK_HOLD_LINES[@]} -gt 0 ]]; then
    printf '  SKIP %s\n' "${LOCK_HOLD_LINES[@]}"
  fi
  if [[ -n "$CONFLICT_NUM" ]]; then
    echo "Conflict: #$CONFLICT_NUM onto ${CONFLICT_ONTO}; PRs above it were not touched."
  fi
  if [[ $APPLY_FAILED -eq 1 ]]; then
    echo "Apply failed; see the ERROR above. PRs above the failure were not touched."
  fi
  # A PR outside the applied chain whose base branch was force-pushed in
  # this run now diffs against a rewritten parent. Say so instead of hiding it.
  if [[ ${#PUSHED_BRANCHES[@]} -gt 0 ]]; then
    for rec in "${SORTED[@]}"; do
      IFS='|' read -r _key num head base title labels url group <<<"$rec"
      if printf '%s\n' "${STACK_PRS[@]}" | grep -qx -- "$num"; then
        continue
      fi
      for b in "${PUSHED_BRANCHES[@]}"; do
        if [[ "$base" == "$b" ]]; then
          echo "WARNING: #$num is not in the stack but its base ${base} was rewritten; check its diff."
        fi
      done
    done
  fi
}

if [[ $APPLY_FAILED -eq 1 ]]; then
  # Keep the fully applied prefix a native stack, so a part-way failure does
  # not leave restacked PRs unlinked after an unstack.
  if [[ ${#STACK_PRS[@]} -ge 2 ]]; then
    echo ""
    echo "Relinking the applied prefix: ${STACK_PRS[*]}"
    if [[ "$DRY_RUN" != "true" ]] && ! load_stacks; then
      echo "ERROR: could not re-list native stacks; the applied prefix is not relinked." >&2
    else
      link_stack "${STACK_PRS[@]}" || echo "ERROR: relinking the applied prefix failed." >&2
    fi
  fi
  print_summary
  exit 1
fi

# --- 4. native stack, labels, order comments ---

# Register the chain as a native GitHub stack (bottom → top). Idempotent: an
# up-to-date stack is a no-op and a stack holding a prefix is extended.
# A stack needs at least two PRs; a lone PR just stays based on the trunk.
if [[ ${#STACK_PRS[@]} -ge 2 ]]; then
  echo ""
  echo "Linking native GitHub stack: ${STACK_PRS[*]}"
  if [[ "$DRY_RUN" != "true" ]] && ! load_stacks; then
    echo "ERROR: could not re-list native stacks before linking." >&2
    print_summary
    exit 3
  fi
  if ! link_stack "${STACK_PRS[@]}"; then
    echo "ERROR: bases are chained, but the PRs are NOT (all) in one native stack." >&2
    echo "Unstack the conflicting stack (REST POST stacks/<n>/unstack or gh stack unstack <n>) and re-run this workflow." >&2
    print_summary
    exit 3
  fi
fi

if [[ ${#STACK_PRS[@]} -gt 0 ]]; then
  ensure_label "$STACK_LABEL"
fi
for num in "${STACK_PRS[@]}"; do
  add_stacked_label "$num"
done

STACK_BODY=$(cat <<EOF
${MARKER_BEGIN}
📚 **Dependabot stack order** (bottom → top; merge from the bottom)

$(printf '%s\n' "${CHAIN_LINES[@]}")

These PRs form a native GitHub stack. Bottom PR stays based on \`${BASE_BRANCH}\`. Upper PRs rebase onto the previous head and retarget their base accordingly. After a bottom merge, this workflow restacks remaining open Dependabot PRs. PRs with non-Dependabot commits are held out of the stack.

Re-run via **Actions → Dependabot Stack → Run workflow** if needed.
${MARKER_END}
EOF
)

for num in "${STACK_PRS[@]}"; do
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] would upsert stack order comment on #$num"
  else
    upsert_marker_comment "$num" "$MARKER_BEGIN" "$STACK_BODY"
  fi
done

print_summary

echo ""
if [[ -n "$CONFLICT_NUM" ]]; then
  echo "Stack incomplete due to rebase conflict (exit 2)."
  exit 2
fi

echo "Stack complete (${#STACK_PRS[@]} PR(s))."
exit 0
