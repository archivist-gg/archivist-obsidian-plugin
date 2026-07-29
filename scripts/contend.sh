#!/bin/bash
# Reproduce the load-dependent vitest timeout class on demand (R4-P2a).
#
# Runs N concurrent full suites while 2x(cores) niced CPU burners compete for
# the machine. The burners are niced so the controlling agent's own tooling is
# not starved. NEVER run this while a vault or CDP session is open: it will
# starve Obsidian and poison any live verification.
#
# Usage: scripts/contend.sh [-n SUITES] [-c CAP_SECONDS] [-- <extra vitest args>]
#
# CLEANUP, what it covers and what it does not:
#   * The trap below fires on EXIT, INT and TERM. It does NOT fire on SIGKILL
#     (kill -9), which no process can trap. After a -9 the burners keep running
#     until their own wall-clock cap expires; sweep them with
#     `pkill -f contend-burner`.
#   * Each suite is killed by PROCESS GROUP, not by pid. `npx` spawns vitest,
#     which spawns a worker pool, and those grandchildren are what actually
#     load the machine. Killing only the subshell orphans them, and an orphaned
#     worker pool IS the contention this harness exists to study: it would
#     manufacture the very flake class the phase is closing.
#   * `set -m` below is what makes the group kill possible: with job control
#     on, every background job becomes its own process group leader, so its pid
#     doubles as its pgid and `kill -- "-$pid"` reaches the whole tree.
#   * Deliberately NOT done: a bare `pkill -f vitest`. It would kill a second
#     agent's concurrent suite, which is exactly the scenario in scope here.
set -uo pipefail
set -m

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
  # Only escalate if a suite is actually still running, so the normal
  # run-to-completion path pays no grace period.
  local alive=0 p
  for p in "${SUITE_PIDS[@]:-}"; do kill -0 "$p" 2>/dev/null && alive=1; done
  [ "$alive" = 0 ] && return 0
  # Group kill (see the header note): "-$p" is the process GROUP, so vitest and
  # its worker pool go with the subshell instead of being orphaned onto the
  # machine. TERM first, then a short grace, then KILL for anything that
  # ignored it. The trailing per-pid kill covers the case where job control was
  # somehow unavailable and the group did not exist.
  for p in "${SUITE_PIDS[@]:-}"; do kill -TERM -- "-$p" 2>/dev/null; done
  sleep 2
  for p in "${SUITE_PIDS[@]:-}"; do
    kill -KILL -- "-$p" 2>/dev/null
    kill -KILL "$p" 2>/dev/null
  done
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
  # Drop the burner from the job table. `set -m` above turns on job control,
  # and job control makes bash announce every job it reaps ("[3] Terminated"),
  # which on cleanup would print 16 lines of noise straight over this script's
  # own results block. disown suppresses that. It does NOT detach the process:
  # the pid stays valid and killable, which is all cleanup needs (burners are
  # never `wait`ed on). Suites are deliberately NOT disowned, because `wait`
  # below requires them to stay in the job table.
  disown $! 2>/dev/null || true
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
