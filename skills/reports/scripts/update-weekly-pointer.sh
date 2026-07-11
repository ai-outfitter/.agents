#!/usr/bin/env bash
# Point root weekly.md at the given week's report and commit everything.
# Usage: update-weekly-pointer.sh <YYYY-Www> <draft|final>
# Set DRY_RUN=1 to write weekly.md without the git add/commit/push.
set -euo pipefail

WEEK="${1:?usage: update-weekly-pointer.sh <YYYY-Www> <draft|final>}"
STATUS="${2:?usage: update-weekly-pointer.sh <YYYY-Www> <draft|final>}"
ROOT=$(git rev-parse --show-toplevel)

[ -f "$ROOT/reports/$WEEK/report.md" ] || { echo "missing reports/$WEEK/report.md — render first" >&2; exit 1; }
[ -f "$ROOT/reports/$WEEK/kpis.json" ] || { echo "missing reports/$WEEK/kpis.json — collect first" >&2; exit 1; }

cat > "$ROOT/weekly.md" <<EOF
# Weekly status

Current week: **$WEEK** ($STATUS)

- [Report](reports/$WEEK/report.md)
- [KPI data](reports/$WEEK/kpis.json)

All weeks live under [reports/](reports/). This file is updated by
\`skills/reports/scripts/update-weekly-pointer.sh\` on every weekly-kpis run.
EOF

echo "wrote:weekly.md -> reports/$WEEK/report.md"

if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "DRY_RUN=1 — skipping git commit/push"
  exit 0
fi

cd "$ROOT"
git add reports weekly.md
if git diff --cached --quiet; then
  echo "nothing to commit"
  exit 0
fi
git commit -m "report: $WEEK weekly status ($STATUS)"
git push
echo "committed and pushed: report: $WEEK weekly status ($STATUS)"
