#!/bin/bash
# Ensure Obsidian is running with a CDP remote-debugging port (localhost-only).
# Idempotent: no-op if the port is already listening; otherwise quits Obsidian
# (it autosaves; workspace restores on relaunch) and relaunches with the flag.
#
# Usage: obsidian-debug.sh [port]   (default 9222)
set -euo pipefail

PORT="${1:-9222}"

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "CDP port $PORT already open"
  exit 0
fi

if pgrep -xq Obsidian; then
  echo "Quitting Obsidian to relaunch with --remote-debugging-port=$PORT ..."
  osascript -e 'tell application "Obsidian" to quit' || true
  for _ in $(seq 1 30); do pgrep -xq Obsidian || break; sleep 0.5; done
  if pgrep -xq Obsidian; then
    echo "FAIL: Obsidian did not quit (unsaved dialog?)" >&2
    exit 1
  fi
fi

open -a Obsidian --args --remote-debugging-port="$PORT"

for _ in $(seq 1 60); do
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "CDP port $PORT open"
    exit 0
  fi
  sleep 0.5
done
echo "FAIL: port $PORT never opened — Obsidian may be ignoring the flag" >&2
exit 1
