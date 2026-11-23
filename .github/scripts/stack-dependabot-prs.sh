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
#      is edited. The first rebase conflict cuts the plan there.
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
#   4. Register the chain as a native GitHub stack with `gh stack link`.
#      Chained bases alone are NOT a stack in the GitHub UI. The `stacked`
#      label is only added once this step succeeds.
#
# GitHub API: every call is REST (`gh api`), so a classic PAT with only the
# `repo` / `public_repo` scope works. `gh pr edit` is NOT used: it queries
# org team fields over GraphQL and fails without `read:org`. `gh stack link`
# (gh-stack v0.1.0) reads PR fields over GraphQL that need no `read:org`
# and uses REST for the stack and base endpoints.
#
# Requires the gh-stack extension (`gh extension install github/gh-stack`).
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
#   3 — `gh stack link` failed; bases are chained but no native stack exists

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
# Security patch/minor groups sit at the bottom so fixes merge first (only the
# stack bottom may auto-merge); security majors sit near the top for review.
# detect_group prefers the longest match, so `actions-security-*` beats the
# npm `security-*` names it contains.
GROUP_ORDER=(
  security-patch-minor
  actions-security-patch-minor
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
  transitive-misc
  security-critical
  actions-security-major
  security-major
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
  # Catch-all aliases for leftover npm groups
  case "$group" in
    other-dependencies|transitive-misc|transitive-catch-all|other-deps)
      for i in "${!GROUP_ORDER[@]}"; do
        if [[ "${GROUP_ORDER[$i]}" == "other-dependencies" ]]; then
          echo "$i"
          return 0
        fi
      done
      ;;
  esac
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
  # Fields: number|headRefName|baseRefName|title|labels(csv)|url
  # REST reports the Dependabot author as `dependabot[bot]`.
  gh api --paginate "repos/${GH_REPO}/pulls?state=open&per_page=100" --jq '
    .[]
    | select(.user.login == "dependabot[bot]")
    | [
        (.number|tostring),
        .head.ref,
        .base.ref,
        (.title | gsub("\\|"; "/")),
        ([.labels[].name] | join(",")),
        .html_url
      ]
    | join("|")
  '
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
3. Stack mutation stopped at this PR so later layers were not retargeted onto a broken base.

${CONFLICT_MARKER}
conflict onto: ${onto_branch}
EOF
)

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] would comment conflict on #$pr_number"
    return 0
  fi
  gh api -X POST "repos/${GH_REPO}/issues/${pr_number}/comments" -f body="$body" >/dev/null
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
  IFS='|' read -r num head base title labels url <<<"$line"
  group=$(detect_group "$head" "$title" "$labels")
  rank=$(group_rank "$group")
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

if [[ "$DRY_RUN" != "true" ]] && ! gh stack --help >/dev/null 2>&1; then
  echo "ERROR: gh-stack extension not installed (gh extension install github/gh-stack)." >&2
  exit 1
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

if [[ ${#ELIGIBLE[@]} -gt 0 ]]; then
  # Full clone (blobless clones break rebase content resolution). The token
  # stays in the temp clone's config, which is removed on exit.
  CLONE_URL="https://x-access-token:${GH_TOKEN}@github.com/${GH_REPO}.git"
  git clone --quiet --no-tags "$CLONE_URL" "$WORK_DIR/repo"
  cd "$WORK_DIR/repo"
  git fetch --quiet origin "$BASE_BRANCH"
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

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
    if ! git fetch --quiet origin \
        "+refs/heads/${head}:refs/remotes/origin/${head}" \
        "+refs/heads/${base}:refs/remotes/origin/${base}"; then
      echo "ERROR: could not fetch ${head} or its base ${base} for #$num; nothing was mutated." >&2
      exit 1
    fi
    old_sha=$(git rev-parse "origin/${head}")
    git checkout --quiet -B "stack-${num}" "$old_sha"

    rebase_log=""
    set +e
    rebase_log=$(git rebase --onto "$PREV_REF" "origin/${base}" 2>&1)
    rebase_rc=$?
    set -e
    if [[ $rebase_rc -ne 0 ]]; then
      git rebase --abort 2>/dev/null || true
      echo "  CONFLICT #$num onto ${PREV_BRANCH}; the stack is cut here"
      CONFLICT_NUM="$num"
      CONFLICT_ONTO="$PREV_BRANCH"
      CONFLICT_LOG="$rebase_log"
      break
    fi

    PLAN_NUM+=("$num")
    PLAN_HEAD+=("$head")
    PLAN_OLD_BASE+=("$base")
    PLAN_NEW_BASE+=("$PREV_BRANCH")
    PLAN_OLD_SHA+=("$old_sha")
    PLAN_GROUP+=("$group")

    new_sha=$(git rev-parse HEAD)
    action=""
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
APPLY_FAILED=0

for idx in "${!PLAN_NUM[@]}"; do
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
    elif git push --quiet --force-with-lease="refs/heads/${head}:${old_sha}" origin \
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
  fi
  STACK_PRS+=("$num")
  CHAIN_LINES+=("${pos}. #${num} (${group}) → base \`${new_base}\`")
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
  echo "Held out (non-Dependabot commits; not rebased, pushed or retargeted): ${#HELD_LINES[@]}"
  if [[ ${#HELD_LINES[@]} -gt 0 ]]; then
    printf '  SKIP %s\n' "${HELD_LINES[@]}"
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
  print_summary
  exit 1
fi

# --- 4. native stack, labels, order comments ---

# Register the chain as a native GitHub stack (bottom → top). Linking is
# idempotent: an up-to-date stack is a no-op and an existing stack is extended.
# A stack needs at least two PRs; a lone PR just stays based on the trunk.
if [[ ${#STACK_PRS[@]} -ge 2 ]]; then
  echo ""
  echo "Linking native GitHub stack: ${STACK_PRS[*]}"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] would run: gh stack link --base $BASE_BRANCH ${STACK_PRS[*]}"
  elif ! gh stack link --base "$BASE_BRANCH" "${STACK_PRS[@]}" </dev/null; then
    echo "ERROR: gh stack link failed. Bases are chained, but the PRs are NOT a native stack." >&2
    echo "If the order changed against an existing stack, unstack it (gh stack unstack <stack-number>) and re-run this workflow." >&2
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
