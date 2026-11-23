#!/usr/bin/env bash
# Stack open Dependabot PRs into a fixed merge order (bottom → top).
#
# Two steps:
#   1. Rebase each PR onto the one below it and chain the PR bases.
#   2. Register the chain as a native GitHub stack with `gh stack link`.
#      Chained bases alone are NOT a stack in the GitHub UI. The `stacked`
#      label is only added once step 2 succeeds.
#
# Requires the gh-stack extension (`gh extension install github/gh-stack`).
#
# Required env:
#   GH_TOKEN  — PAT with contents:write, pull-requests:write, and ability to
#               push dependabot/* branches (GITHUB_TOKEN usually cannot).
#   GH_REPO   — owner/repo (e.g. ${{ github.repository }})
#
# Optional env:
#   BASE_BRANCH — trunk branch (default: main)
#   DRY_RUN     — if "true", print actions without mutating
#
# Exit codes:
#   0 — stack applied (or nothing to do / dry-run)
#   1 — fatal error (auth, git, unexpected)
#   2 — rebase conflict; conflicting PR commented, chain mutation stopped
#       (PRs below the conflict are still linked into the stack)
#   3 — `gh stack link` failed; bases are chained but no native stack exists

set -euo pipefail

BASE_BRANCH="${BASE_BRANCH:-main}"
DRY_RUN="${DRY_RUN:-false}"
STACK_LABEL="${STACK_LABEL:-stacked}"
MARKER_BEGIN="<!-- dependabot-stack-order -->"
MARKER_END="<!-- /dependabot-stack-order -->"

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "ERROR: GH_TOKEN is required (PAT with contents write, PRs write, push to dependabot/*)." >&2
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
  # `gh pr list --json author` reports Dependabot as `app/dependabot` (GraphQL
  # bot login), while REST/webhooks use `dependabot[bot]`. Accept every form,
  # same as the author check in dependabot-auto-merge.yml.
  gh pr list \
    --repo "$GH_REPO" \
    --state open \
    --limit 100 \
    --json number,headRefName,baseRefName,title,labels,author,url \
    --jq '
      [.[] | select(.author.login | IN("dependabot[bot]", "app/dependabot", "dependabot"))]
      | sort_by(.number)
      | .[]
      | [
          (.number|tostring),
          .headRefName,
          .baseRefName,
          (.title | gsub("\\|"; "/")),
          (([.labels[].name] | join(","))),
          .url
        ]
      | join("|")
    '
}

ensure_label() {
  local name="$1"
  if ! gh label list --repo "$GH_REPO" --search "$name" --json name --jq '.[].name' 2>/dev/null | grep -qx "$name"; then
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "[dry-run] would create label: $name"
      return 0
    fi
    gh label create "$name" --repo "$GH_REPO" --color "0E8A16" --description "Part of an ordered Dependabot PR stack" || true
  fi
}

comment_stack_order() {
  local pr_number="$1"
  local body="$2"
  local existing

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] would comment stack order on #$pr_number"
    return 0
  fi

  existing=$(gh api "repos/${GH_REPO}/issues/${pr_number}/comments" \
    --jq "[.[] | select(.body | contains(\"${MARKER_BEGIN}\"))] | .[0].id // empty" 2>/dev/null || true)

  if [[ -n "${existing:-}" ]]; then
    gh api -X PATCH "repos/${GH_REPO}/issues/comments/${existing}" -f body="$body" >/dev/null
  else
    gh pr comment "$pr_number" --repo "$GH_REPO" --body "$body" >/dev/null
  fi
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

${MARKER_BEGIN}
conflict onto: ${onto_branch}
${MARKER_END}
EOF
)

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] would comment conflict on #$pr_number"
    return 0
  fi
  gh pr comment "$pr_number" --repo "$GH_REPO" --body "$body" >/dev/null
}

add_stacked_label() {
  local pr_number="$1"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] would label #$pr_number with $STACK_LABEL"
    return 0
  fi
  gh pr edit "$pr_number" --repo "$GH_REPO" --add-label "$STACK_LABEL" >/dev/null 2>&1 || true
}

# --- main ---

echo "Listing open Dependabot PRs for $GH_REPO (base trunk: $BASE_BRANCH)..."

mapfile -t PR_LINES < <(list_dependabot_prs || true)

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

echo "Planned stack (bottom → top):"
for rec in "${SORTED[@]}"; do
  IFS='|' read -r _key num head base title labels url group <<<"$rec"
  echo "  #$num  group=${group}  head=${head}  current_base=${base}"
done

if [[ "$DRY_RUN" != "true" ]] && ! gh stack --help >/dev/null 2>&1; then
  echo "ERROR: gh-stack extension not installed (gh extension install github/gh-stack)." >&2
  exit 1
fi

ensure_label "$STACK_LABEL"

# Worktree for rebases
WORK_DIR=$(mktemp -d)
cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

# Authenticated clone URL for push
CLONE_URL="https://x-access-token:${GH_TOKEN}@github.com/${GH_REPO}.git"

# Full clone of needed refs (blobless clones break rebase content resolution).
git clone --quiet --no-tags "$CLONE_URL" "$WORK_DIR/repo"
cd "$WORK_DIR/repo"
git fetch --quiet origin "$BASE_BRANCH"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

PREV_BRANCH="$BASE_BRANCH"
CONFLICT_HIT=0
CHAIN_LINES=()
STACK_PRS=()
i=0
total=${#SORTED[@]}

for rec in "${SORTED[@]}"; do
  IFS='|' read -r _key num head base title labels url group <<<"$rec"
  i=$((i + 1))
  echo ""
  echo "[$i/$total] Stacking #$num ($group) onto ${PREV_BRANCH}..."

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] would rebase $head onto $PREV_BRANCH, force-push --force-with-lease, set base=$PREV_BRANCH"
    CHAIN_LINES+=("${i}. #${num} (${group}) → base \`${PREV_BRANCH}\`")
    STACK_PRS+=("$num")
    PREV_BRANCH="$head"
    continue
  fi

  git fetch --quiet origin "$head" "$PREV_BRANCH"

  if ! git checkout --quiet -B "stack-${num}" "origin/${head}"; then
    echo "ERROR: failed to checkout origin/${head}" >&2
    exit 1
  fi

  rebase_log=""
  set +e
  rebase_log=$(git rebase "origin/${PREV_BRANCH}" 2>&1)
  rebase_rc=$?
  set -e

  if [[ $rebase_rc -ne 0 ]]; then
    echo "CONFLICT rebasing #$num onto ${PREV_BRANCH}"
    git rebase --abort 2>/dev/null || true
    comment_conflict "$num" "$PREV_BRANCH" "$rebase_log"
    CONFLICT_HIT=1
    echo "Stopping further stack mutations after conflict on #$num."
    break
  fi

  # Only push if history changed relative to remote tip
  local_sha=$(git rev-parse HEAD)
  remote_sha=$(git rev-parse "origin/${head}")
  if [[ "$local_sha" != "$remote_sha" ]]; then
    if ! git push --force-with-lease="refs/heads/${head}:${remote_sha}" origin "HEAD:refs/heads/${head}"; then
      echo "ERROR: force-with-lease push failed for ${head}; refusing to overwrite unexpected remote tip." >&2
      exit 1
    fi
  else
    echo "No rebase change for ${head}; skip push."
  fi

  if [[ "$base" != "$PREV_BRANCH" ]]; then
    gh pr edit "$num" --repo "$GH_REPO" --base "$PREV_BRANCH" >/dev/null
    echo "Retargeted #$num base: ${base} → ${PREV_BRANCH}"
  else
    echo "Base already ${PREV_BRANCH} for #$num"
  fi

  STACK_PRS+=("$num")
  CHAIN_LINES+=("${i}. #${num} (${group}) → base \`${PREV_BRANCH}\`")

  PREV_BRANCH="$head"
done

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
    exit 3
  fi
fi

for num in "${STACK_PRS[@]}"; do
  add_stacked_label "$num"
done

# Comment chain order on successfully stacked PRs (and bottom even if alone)
STACK_BODY=$(cat <<EOF
${MARKER_BEGIN}
📚 **Dependabot stack order** (bottom → top; merge from the bottom)

$(printf '%s\n' "${CHAIN_LINES[@]}")

These PRs form a native GitHub stack. Bottom PR stays based on \`${BASE_BRANCH}\`. Upper PRs rebase onto the previous head and retarget their base accordingly. After a bottom merge, this workflow restacks remaining open Dependabot PRs.

Re-run via **Actions → Dependabot Stack → Run workflow** if needed.
${MARKER_END}
EOF
)

if [[ ${#CHAIN_LINES[@]} -gt 0 ]]; then
  # Comment on each PR that was successfully included in CHAIN_LINES
  for rec in "${SORTED[@]}"; do
    IFS='|' read -r _key num head base title labels url group <<<"$rec"
    # Only comment if this PR appears in CHAIN_LINES
    if printf '%s\n' "${CHAIN_LINES[@]}" | grep -q "#${num} "; then
      comment_stack_order "$num" "$STACK_BODY"
    fi
  done
fi

echo ""
if [[ "$CONFLICT_HIT" -eq 1 ]]; then
  echo "Stack incomplete due to rebase conflict (exit 2)."
  exit 2
fi

echo "Stack complete (${#CHAIN_LINES[@]} PR(s))."
exit 0
