#!/bin/bash
# Part 21: Lighthouse 13 (mobile) on `/` and `/?demo`, N runs each, against a preview of a built directory.
#   bash verification/perf/lighthouse.sh <built dir> <out dir> [runs]
#   LH_EXTRA="--throttling-method=devtools" bash verification/perf/lighthouse.sh dist /tmp/lh-applied 3   # applied throttling
# The default is simulated (lantern) throttling; `devtools` applies the 4x CPU and slow-4G network in the browser. See README.md.
# CHROME_PATH (or PW_CHROMIUM_PATH) selects the Chromium. Summarise with: node verification/perf/lh-summary.mjs <out dir>/*.json
set -u
DIST=${1:?built directory}; OUT=${2:?output directory}; RUNS=${3:-3}; PORT=${LH_PORT:-4174}
mkdir -p "$OUT"
cd "$(dirname "$0")/../.."
npx vite preview --outDir "$DIST" --port "$PORT" --strictPort --host 127.0.0.1 > "$OUT/preview.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
for _ in $(seq 1 20); do curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break; sleep 0.5; done
export CHROME_PATH=${CHROME_PATH:-${PW_CHROMIUM_PATH:-}}
for i in $(seq 1 "$RUNS"); do
  for page in root demo; do
    url="http://127.0.0.1:$PORT/"; [ "$page" = demo ] && url="http://127.0.0.1:$PORT/?demo"
    # shellcheck disable=SC2086
    npx --yes lighthouse@13 "$url" --only-categories=performance --output=json --output-path="$OUT/$page-run$i.json" --quiet ${LH_EXTRA:-} --chrome-flags="--headless=new --no-sandbox" > "$OUT/$page-run$i.log" 2>&1
    echo "$page run $i: exit $?"
  done
done
