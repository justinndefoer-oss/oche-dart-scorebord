#!/usr/bin/env bash
# Runs every FitTrack test. Needs node, and playwright's chromium for the browser suites.
#   ./run.sh            all suites
#   ./run.sh decoder    just one
set -u
cd "$(dirname "$0")"
NODE="${NODE:-node}"
export FITTRACK_OUT="${FITTRACK_OUT:-$(mktemp -d)}"
suites=(decoder realframe stress camera scan search flow plan own presets history)
[ $# -gt 0 ] && suites=("$@")
fail=0
for s in "${suites[@]}"; do
  printf '%-10s ' "$s"
  out=$("$NODE" "$s.js" 2>&1)
  # A suite counts as passing only if it SAYS so. Absence of the word "FAIL" is
  # not success — a crashed suite prints neither.
  summary=$(printf '%s' "$out" | grep -E 'failing of|false reads:|^total ' | tr '\n' '|' | sed 's/|$//')
  if [ -z "$summary" ]; then
    echo "NO RESULT — the suite did not finish"
    printf '%s\n' "$out" | tail -6 | sed 's/^/           /'
    fail=1
  elif printf '%s' "$out" | grep -qE '^FAIL|[1-9][0-9]* failing'; then
    echo "FAILED   $summary"
    printf '%s\n' "$out" | grep -E '^FAIL' | sed 's/^/           /'
    fail=1
  else
    echo "ok       $summary"
  fi
done
echo
echo "screenshots in $FITTRACK_OUT"
exit $fail
