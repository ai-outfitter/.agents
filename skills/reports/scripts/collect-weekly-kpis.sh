#!/usr/bin/env bash
# Collect weekly KPI data for every non-archived ai-outfitter repository.
# Prints one compact line per repo; all other output is suppressed.
# Requires: gh authenticated (GH_TOKEN/GITHUB_TOKEN), GNU date (CI) or BSD date.
set -euo pipefail

ORG="${ORG:-ai-outfitter}"
MONDAY=$(date -u -d "-$(( $(date -u +%u) - 1 )) days" +%Y-%m-%dT00:00:00Z 2>/dev/null \
  || date -u -v-$(( $(date -u +%u) - 1 ))d +%Y-%m-%dT00:00:00Z)

echo "week:$(date -u +%G-W%V) since:$MONDAY org:$ORG"
echo "generated_at:$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [ -n "${GITHUB_RUN_ID:-}" ]; then
  echo "run_url:${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
else
  echo "run_url:none"
fi

for r in $(gh repo list "$ORG" --limit 100 --json name,isArchived -q '.[]|select(.isArchived|not)|.name'); do
  base=$(gh api "repos/$ORG/$r" --jq '"stars:\(.stargazers_count) forks:\(.forks_count) watchers:\(.subscribers_count)"' 2>/dev/null || echo "stars:? forks:? watchers:?")
  issues=$(gh api "search/issues?q=repo:$ORG/$r+is:issue+is:open" --jq .total_count 2>/dev/null || echo "?")
  prs=$(gh api "search/issues?q=repo:$ORG/$r+is:pr+is:open" --jq .total_count 2>/dev/null || echo "?")
  commits=$(gh api "repos/$ORG/$r/commits?since=$MONDAY&per_page=100" --jq length 2>/dev/null || echo 0)
  echo "$r $base issues:$issues prs:$prs commits_this_week:$commits"
  sleep 1
done
