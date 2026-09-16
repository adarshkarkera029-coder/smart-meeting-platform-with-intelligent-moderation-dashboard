#!/usr/bin/env bash
# Durable Whisper launcher — survives parent shell / nodemon exits.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
mkdir -p logs
PIDFILE=logs/whisper.pid
LOG=logs/whisper.log

if [[ -f "$PIDFILE" ]]; then
  OLD=$(cat "$PIDFILE" || true)
  if [[ -n "${OLD:-}" ]] && kill -0 "$OLD" 2>/dev/null; then
    if curl -sf --max-time 2 http://127.0.0.1:9000/health >/dev/null 2>&1; then
      echo "already running pid=$OLD"
      exit 0
    fi
  fi
fi

if [[ -x ./venv/bin/python ]]; then
  PY=./venv/bin/python
else
  PY=python3
fi

export WHISPER_MODEL="${WHISPER_MODEL:-base}"
export WHISPER_DEVICE="${WHISPER_DEVICE:-cpu}"
export WHISPER_COMPUTE_TYPE="${WHISPER_COMPUTE_TYPE:-int8}"
export PYTHONUNBUFFERED=1

# Detach from terminal/job control (macOS-safe; no setsid required)
nohup "$PY" faster_whisper_server.py >>"$LOG" 2>&1 </dev/null &
PID=$!
echo "$PID" >"$PIDFILE"
# Try to disown if running under a job-control shell
disown "$PID" 2>/dev/null || true
echo "started pid=$PID log=$LOG"
