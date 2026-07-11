#!/usr/bin/env bash
# Reconstruct a past week's KPI snapshot from timestamped GitHub data.
# Usage: backfill-week.sh <YYYY-Www>   e.g. backfill-week.sh 2026-W27
# Writes reports/<week>/kpis.json with backfilled:true. Metrics that cannot
# be reconstructed retroactively (watchers, open issues/PRs, unreleased
# state) are null.
set -euo pipefail

WEEK="${1:?usage: backfill-week.sh <YYYY-Www>}"
ORG="${ORG:-ai-outfitter}"
ROOT=$(git rev-parse --show-toplevel)

YEAR=${WEEK%-W*}
WNUM=${WEEK#*-W}
# ISO week N's Monday: Jan 4 is always in week 1; step back to its Monday,
# then advance (N-1) weeks.
if date -u -d "2000-01-01" >/dev/null 2>&1; then
  JAN4_DOW=$(date -u -d "$YEAR-01-04" +%u)
  MONDAY=$(date -u -d "$YEAR-01-04 -$(( JAN4_DOW - 1 )) days +$(( (10#$WNUM - 1) * 7 )) days" +%Y-%m-%d)
  SUNDAY=$(date -u -d "$MONDAY +6 days" +%Y-%m-%d)
else
  JAN4_DOW=$(date -ju -f %Y-%m-%d "$YEAR-01-04" +%u)
  MONDAY=$(date -ju -f %Y-%m-%d -v-$(( JAN4_DOW - 1 ))d -v+$(( (10#$WNUM - 1) * 7 ))d "$YEAR-01-04" +%Y-%m-%d)
  SUNDAY=$(date -ju -f %Y-%m-%d -v+6d "$MONDAY" +%Y-%m-%d)
fi
SINCE="${MONDAY}T00:00:00Z"
CUTOFF="${SUNDAY}T23:59:59Z"
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

echo "backfill week:$WEEK range:$SINCE..$CUTOFF org:$ORG"

repos_json="{}"
for r in $(gh repo list "$ORG" --limit 100 --json name,isArchived -q '.[]|select(.isArchived|not)|.name'); do
  stars=$(gh api "repos/$ORG/$r/stargazers?per_page=100" -H "Accept: application/vnd.github.star+json" --paginate --slurp 2>/dev/null \
    | jq "[.[][] | select(.starred_at <= \"$CUTOFF\")] | length" 2>/dev/null || echo null)
  forks=$(gh api "repos/$ORG/$r/forks?per_page=100" --paginate --slurp 2>/dev/null \
    | jq "[.[][] | select(.created_at <= \"$CUTOFF\")] | length" 2>/dev/null || echo null)
  commits=$(gh api "repos/$ORG/$r/commits?since=$SINCE&until=$CUTOFF&per_page=100" --jq length 2>/dev/null || echo null)
  releases=$(gh api "repos/$ORG/$r/releases?per_page=50" --jq "[.[] | select(.published_at >= \"$SINCE\" and .published_at <= \"$CUTOFF\") | {tag: .tag_name, name: .name, published_at}]" 2>/dev/null || echo '[]')
  stars=$(jval "${stars:-null}" null); forks=$(jval "${forks:-null}" null)
  commits=$(jval "${commits:-null}" null); releases=$(jval "${releases:-[]}" '[]')

  repo_json=$(jq -cn \
    --argjson stars "$stars" --argjson forks "$forks" \
    --argjson commits "$commits" --argjson releases "$releases" \
    '{stars:$stars, forks:$forks, watchers:null, issues:null, prs:null,
      merged_prs:null, commits:$commits, releases_this_week:$releases,
      unreleased:{latest_tag:null, commits_since_release:null}, release_pr:null}')
  repos_json=$(jq -cn --argjson acc "$repos_json" --argjson v "$repo_json" --arg k "$r" '$acc + {($k): $v}')

  echo "$r stars_asof:$stars forks_asof:$forks commits:$commits"
  sleep 1
done

jq -n \
  --arg week "$WEEK" --arg since "$SINCE" --arg generated_at "$NOW" \
  --argjson run_url "$RUN_URL" --argjson repos "$repos_json" \
  '{week:$week, since:$since, generated_at:$generated_at, run_url:$run_url,
    backfilled:true, repos:$repos,
    totals: ($repos | to_entries | map(.value) |
      {stars: (map(.stars // 0) | add), forks: (map(.forks // 0) | add),
       issues: null, prs: null, merged_prs: null,
       commits: (map(.commits // 0) | add)})}' \
  > "$OUT_DIR/kpis.json"

echo "wrote:reports/$WEEK/kpis.json (backfilled)"
