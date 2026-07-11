#!/usr/bin/env bash
# Collect weekly KPI + activity data for every non-archived org repository.
# Writes reports/<week>/kpis.json and prints one compact line per repo.
# Requires: gh (authenticated), jq. GNU date (CI) or BSD date (macOS).
set -euo pipefail

ORG="${ORG:-ai-outfitter}"
ROOT=$(git rev-parse --show-toplevel)
WEEK=$(date -u +%G-W%V)
MONDAY=$(date -u -d "-$(( $(date -u +%u) - 1 )) days" +%Y-%m-%dT00:00:00Z 2>/dev/null \
  || date -u -v-$(( $(date -u +%u) - 1 ))d +%Y-%m-%dT00:00:00Z)
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
RUN_URL=null
if [ -n "${GITHUB_RUN_ID:-}" ]; then
  RUN_URL="\"${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}\""
fi

OUT_DIR="$ROOT/reports/$WEEK"
mkdir -p "$OUT_DIR"

# Echo the value if it is valid JSON, else the fallback. Guards --argjson
# against gh api failures that print error bodies to stdout.
jval() { if jq -e . >/dev/null 2>&1 <<<"$1"; then echo "$1"; else echo "$2"; fi; }

echo "week:$WEEK since:$MONDAY org:$ORG"
echo "generated_at:$NOW"
echo "run_url:$(echo "$RUN_URL" | tr -d '"')"

repos_json="{}"
for r in $(gh repo list "$ORG" --limit 100 --json name,isArchived -q '.[]|select(.isArchived|not)|.name'); do
  base=$(gh api "repos/$ORG/$r" --jq '{stars:.stargazers_count, forks:.forks_count, watchers:.subscribers_count}' 2>/dev/null || echo '{"stars":null,"forks":null,"watchers":null}')
  issues=$(gh api "search/issues?q=repo:$ORG/$r+is:issue+is:open" --jq .total_count 2>/dev/null || echo null)
  prs=$(gh api "search/issues?q=repo:$ORG/$r+is:pr+is:open" --jq .total_count 2>/dev/null || echo null)
  merged=$(gh api "search/issues?q=repo:$ORG/$r+is:pr+is:merged+merged:>=${MONDAY%T*}" --jq .total_count 2>/dev/null || echo null)
  commits=$(gh api "repos/$ORG/$r/commits?since=$MONDAY&per_page=100" --jq length 2>/dev/null || echo 0)
  releases=$(gh api "repos/$ORG/$r/releases?per_page=20" --jq "[.[] | select(.published_at >= \"$MONDAY\") | {tag: .tag_name, name: .name, published_at}]" 2>/dev/null || echo '[]')
  # gh api prints error bodies to stdout, so extract the tag from the raw
  # response instead of trusting exit status.
  latest_tag=$(gh api "repos/$ORG/$r/releases/latest" 2>/dev/null | jq -r '.tag_name // empty' 2>/dev/null || true)
  if [ -n "$latest_tag" ]; then
    ahead=$(gh api "repos/$ORG/$r/compare/$latest_tag...HEAD" --jq .ahead_by 2>/dev/null || echo null)
    ahead=$(jval "${ahead:-null}" null)
    unreleased=$(jq -cn --arg t "$latest_tag" --argjson a "$ahead" '{latest_tag:$t, commits_since_release:$a}')
  else
    unreleased='{"latest_tag":null,"commits_since_release":null}'
  fi
  release_pr=$(gh pr list -R "$ORG/$r" --state open --json number,title,headRefName \
    -q '[.[] | select(.headRefName | startswith("release-please--"))][0] | if . then {number, title} else null end' 2>/dev/null || echo null)
  base=$(jval "$base" '{"stars":null,"forks":null,"watchers":null}')
  issues=$(jval "${issues:-null}" null); prs=$(jval "${prs:-null}" null)
  merged=$(jval "${merged:-null}" null); commits=$(jval "${commits:-null}" null)
  release_pr=$(jval "${release_pr:-null}" null); releases=$(jval "${releases:-[]}" '[]')

  repo_json=$(jq -cn \
    --argjson base "$base" --argjson issues "$issues" --argjson prs "$prs" \
    --argjson merged "$merged" --argjson commits "$commits" \
    --argjson releases "$releases" --argjson unreleased "$unreleased" \
    --argjson release_pr "$release_pr" \
    '$base + {issues:$issues, prs:$prs, merged_prs:$merged, commits:$commits,
      releases_this_week:$releases, unreleased:$unreleased, release_pr:$release_pr}')
  repos_json=$(jq -cn --argjson acc "$repos_json" --argjson v "$repo_json" --arg k "$r" '$acc + {($k): $v}')

  rel_note=""
  [ "$releases" != "[]" ] && rel_note=" releases:$(echo "$releases" | jq -r '[.[].tag] | join(",")')"
  echo "$r stars:$(echo "$base" | jq .stars) forks:$(echo "$base" | jq .forks) issues:$issues prs:$prs merged_prs:$merged commits:$commits unreleased:$(echo "$unreleased" | jq -r '.commits_since_release // "n/a"')$rel_note"
  sleep 3
done

jq -n \
  --arg week "$WEEK" --arg since "$MONDAY" --arg generated_at "$NOW" \
  --argjson run_url "$RUN_URL" --argjson repos "$repos_json" \
  '{week:$week, since:$since, generated_at:$generated_at, run_url:$run_url,
    backfilled:false, repos:$repos,
    totals: ($repos | to_entries | map(.value) |
      {stars: (map(.stars // 0) | add), forks: (map(.forks // 0) | add),
       issues: (map(.issues // 0) | add), prs: (map(.prs // 0) | add),
       merged_prs: (map(.merged_prs // 0) | add),
       commits: (map(.commits // 0) | add)})}' \
  > "$OUT_DIR/kpis.json"

echo "wrote:reports/$WEEK/kpis.json"
