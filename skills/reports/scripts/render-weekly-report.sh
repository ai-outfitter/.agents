#!/usr/bin/env bash
# Render the weekly status report markdown to stdout from KPI snapshots.
# Usage: render-weekly-report.sh <YYYY-Www> <draft|final> [highlights-file]
# Reads reports/<week>/kpis.json and, when present, the previous ISO week's
# reports/<prev>/kpis.json for week-over-week deltas.
set -euo pipefail

WEEK="${1:?usage: render-weekly-report.sh <YYYY-Www> <draft|final> [highlights-file]}"
STATUS="${2:?usage: render-weekly-report.sh <YYYY-Www> <draft|final> [highlights-file]}"
HIGHLIGHTS_FILE="${3:-}"
ROOT=$(git rev-parse --show-toplevel)

CUR="$ROOT/reports/$WEEK/kpis.json"
[ -f "$CUR" ] || { echo "missing $CUR — run the collector first" >&2; exit 1; }

YEAR=${WEEK%-W*}
WNUM=${WEEK#*-W}
if date -u -d "2000-01-01" >/dev/null 2>&1; then
  JAN4_DOW=$(date -u -d "$YEAR-01-04" +%u)
  MONDAY=$(date -u -d "$YEAR-01-04 -$(( JAN4_DOW - 1 )) days +$(( (10#$WNUM - 1) * 7 )) days" +%Y-%m-%d)
  SUNDAY=$(date -u -d "$MONDAY +6 days" +%Y-%m-%d)
  PREV_WEEK=$(date -u -d "$MONDAY -7 days" +%G-W%V)
else
  JAN4_DOW=$(date -ju -f %Y-%m-%d "$YEAR-01-04" +%u)
  MONDAY=$(date -ju -f %Y-%m-%d -v-$(( JAN4_DOW - 1 ))d -v+$(( (10#$WNUM - 1) * 7 ))d "$YEAR-01-04" +%Y-%m-%d)
  SUNDAY=$(date -ju -f %Y-%m-%d -v+6d "$MONDAY" +%Y-%m-%d)
  PREV_WEEK=$(date -ju -f %Y-%m-%d -v-7d "$MONDAY" +%G-W%V)
fi

PREV="$ROOT/reports/$PREV_WEEK/kpis.json"
PREV_JSON=null
PREV_BACKFILLED=false
if [ -f "$PREV" ]; then
  PREV_JSON=$(cat "$PREV")
  PREV_BACKFILLED=$(jq -r '.backfilled // false' "$PREV")
fi

GEN_AT=$(jq -r .generated_at "$CUR")
RUN_URL=$(jq -r '.run_url // empty' "$CUR")

# --- frontmatter ---------------------------------------------------------
echo "---"
echo "week: $WEEK"
echo "status: $STATUS"
echo "generated_at: $GEN_AT"
[ -n "$RUN_URL" ] && echo "generated_by: $RUN_URL"
echo "---"
echo
echo "# ai-outfitter weekly status — $WEEK"
echo
if [ "$STATUS" = "draft" ]; then
  echo "Week of $MONDAY to $SUNDAY. Draft — finalized by the Sunday scheduled run."
else
  echo "Week of $MONDAY to $SUNDAY. Final."
fi
echo
echo "## Highlights"
echo
if [ -n "$HIGHLIGHTS_FILE" ] && [ -s "$HIGHLIGHTS_FILE" ]; then
  cat "$HIGHLIGHTS_FILE"
else
  echo "_No highlights provided._"
fi
echo

# --- tables + activity (jq does the formatting) --------------------------
jq -r --argjson prev "$PREV_JSON" --argjson prev_backfilled "$PREV_BACKFILLED" --arg prev_week "$PREV_WEEK" '
  def delta($cur; $old):
    if ($cur == null) or ($old == null) then "—"
    elif ($cur - $old) > 0 then "+\($cur - $old)"
    else "\($cur - $old)" end;
  def val($v): if $v == null then "n/a" else "\($v)" end;
  def pv($name; $key): if $prev == null then null else $prev.repos[$name][$key] end;
  def pt($key): if $prev == null then null else $prev.totals[$key] end;

  "## Org totals\n",
  "| Metric | Value | Δ vs \($prev_week)\(if $prev_backfilled then " (backfilled baseline)" else "" end) |",
  "| --- | ---: | ---: |",
  "| Stars | \(val(.totals.stars)) | \(delta(.totals.stars; pt("stars"))) |",
  "| Forks | \(val(.totals.forks)) | \(delta(.totals.forks; pt("forks"))) |",
  "| Open issues | \(val(.totals.issues)) | \(delta(.totals.issues; pt("issues"))) |",
  "| Open pull requests | \(val(.totals.prs)) | \(delta(.totals.prs; pt("prs"))) |",
  "| PRs merged this week | \(val(.totals.merged_prs)) | \(delta(.totals.merged_prs; pt("merged_prs"))) |",
  "| Commits this week (default branches) | \(val(.totals.commits)) | \(delta(.totals.commits; pt("commits"))) |",
  "",
  "## Per-repository\n",
  "| Repository | Stars | Δ | Forks | Δ | Open issues | Open PRs | Commits | Δ |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  (.repos | to_entries | sort_by(-(.value.commits // 0), -(.value.stars // 0))[] |
    "| \(.key) | \(val(.value.stars)) | \(delta(.value.stars; pv(.key; "stars"))) | \(val(.value.forks)) | \(delta(.value.forks; pv(.key; "forks"))) | \(val(.value.issues)) | \(val(.value.prs)) | \(val(.value.commits)) | \(delta(.value.commits; pv(.key; "commits"))) |"),
  "",
  "## Activity\n",
  ((.repos | to_entries | map(select(
      ((.value.releases_this_week // []) | length) > 0
      or ((.value.merged_prs // 0) > 0)
      or ((.value.unreleased.commits_since_release // 0) > 0)
      or (.value.release_pr != null)))) as $active |
    if ($active | length) == 0 then "_No release or merge activity this week._"
    else $active[] |
      ("- **\(.key)**" +
      (if (.value.merged_prs // 0) > 0
        then " — \(.value.merged_prs) PR\(if .value.merged_prs == 1 then "" else "s" end) merged this week" else "" end) +
      (if (.value.unreleased.commits_since_release // 0) > 0
        then " — \(.value.unreleased.commits_since_release) unreleased commit\(if .value.unreleased.commits_since_release == 1 then "" else "s" end) since \(.value.unreleased.latest_tag)" else "" end) +
      (if .value.release_pr != null
        then " — release PR #\(.value.release_pr.number) open" else "" end)),
      (.value.releases_this_week // [] | .[] |
        (if .url then "  - released [\(.tag)](\(.url))" else "  - released \(.tag)" end),
        ((.body // "") | split("\n") | map(gsub("\r$"; ""))
          | map(select(startswith("* ") or startswith("- ")))
          | .[0:6][] | "    \(sub("^\\* "; "- "))"))
    end),
  ""
' "$CUR"

# --- notes + footer -------------------------------------------------------
echo "Notes:"
echo
echo "- Traffic (views/clones) omitted: requires push access per repository from"
echo "  the run's token."
echo "- Commit counts cover each repository's default branch since Monday 00:00 UTC."
echo "- Private org repositories other than the one this workflow runs in are not"
echo "  visible to the workflow token and are excluded."
if [ "$PREV_JSON" = "null" ]; then
  echo "- No $PREV_WEEK snapshot exists, so week-over-week deltas are unavailable."
elif [ "$PREV_BACKFILLED" = "true" ]; then
  echo "- The $PREV_WEEK baseline was backfilled from timestamped data; open"
  echo "  issue/PR deltas are unavailable for it."
fi
if [ -n "$RUN_URL" ]; then
  echo
  echo "Generated by [Actions run ${RUN_URL##*/}]($RUN_URL)."
fi
