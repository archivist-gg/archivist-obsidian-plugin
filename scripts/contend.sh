#!/bin/bash
# Reproduce the load-dependent vitest timeout class on demand (R4-P2a).
#
# Runs N concurrent full suites while 2x(cores) niced CPU burners compete for
# the machine. The burners are niced so the controlling agent's own tooling is
# not starved. NEVER run this while a vault or CDP session is open: it will
# starve Obsidian and poison any live verification.
#
# Usage: scripts/contend.sh [-n SUITES] [-c CAP_SECONDS] [-- <extra vitest args>]
set -uo pipefail

SUITES=2
CAP=600
while [ $# -gt 0 ]; do
  case "$1" in
    -n) SUITES="$2"; shift 2 ;;
    -c) CAP="$2"; shift 2 ;;
    --) shift; break ;;
    *)  echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORES=$(sysctl -n hw.ncpu 2>/dev/null || nproc)
BURNERS=$((CORES * 2))
OUT="${TMPDIR:-/tmp}/contend-$$"
mkdir -p "$OUT"

BURNER_PIDS=()
SUITE_PIDS=()
cleanup() {
  for p in "${BURNER_PIDS[@]:-}"; do kill "$p" 2>/dev/null; done
  for p in "${SUITE_PIDS[@]:-}"; do kill "$p" 2>/dev/null; done
}
trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM

echo "== contend: $SUITES suite(s), $BURNERS niced burners on $CORES cores, burner cap ${CAP}s"
echo "== NOTE: the cap bounds the BURNERS only; a wedged vitest run is not killed by it."
echo "== logs: $OUT"

for _ in $(seq 1 "$BURNERS"); do
  # The `contend-burner` marker exists so `pgrep -f contend-burner` can find these.
  # Never pgrep for the Math.sqrt body: `pgrep -f` takes an EXTENDED REGEX, so the
  # parentheses are grouping metacharacters and the pattern matches nothing, ever.
  nice -n 19 node -e "/* contend-burner */ const e=Date.now()+${CAP}000; while(Date.now()<e){Math.sqrt(Math.random())}" &
  BURNER_PIDS+=($!)
done

for i in $(seq 1 "$SUITES"); do
  ( cd "$ROOT" && npx vitest run "$@" > "$OUT/suite-$i.log" 2>&1; echo "EXIT=$?" >> "$OUT/suite-$i.log" ) &
  SUITE_PIDS+=($!)
done

SECONDS=0
for p in "${SUITE_PIDS[@]}"; do wait "$p"; done
echo "== elapsed ${SECONDS}s (cap ${CAP}s)"

RC=0
for i in $(seq 1 "$SUITES"); do
  echo "-- suite $i"
  grep -E "Test Files|Tests  |Duration|EXIT=" "$OUT/suite-$i.log" | sed 's/^/   /'
  grep -c "Test timed out" "$OUT/suite-$i.log" | sed 's/^/   timeouts: /'
  grep -E "^ FAIL " "$OUT/suite-$i.log" | head -5 | sed 's/^/   /'
  grep -q "EXIT=0" "$OUT/suite-$i.log" || RC=1
done
echo "== overall: $([ $RC -eq 0 ] && echo ALL-GREEN || echo AT-LEAST-ONE-RED)  logs in $OUT"
exit $RC
