#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/ADPULSE

cleanup_stale_processes() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti "tcp:${port}" 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      echo "Cleaning stale process(es) on port ${port}: ${pids}"
      kill ${pids} 2>/dev/null || true
      sleep 1
    fi
  fi

  pkill -f "node dist/boot.js" 2>/dev/null || true
  pkill -f "uvicorn eco_ia.app:app" 2>/dev/null || true
}

start_and_wait() {
  local url="$1"
  local log_file="$2"
  shift 2

  if curl -fsS "${url}" >/dev/null 2>&1; then
    return 0
  fi

  "$@" >"${log_file}" 2>&1 &
  local service_pid=$!
  local elapsed=0

  until curl -fsS "${url}" >/dev/null 2>&1; do
    if ! kill -0 "${service_pid}" 2>/dev/null; then
      echo "Service exited before becoming healthy: ${url}"
      cat "${log_file}"
      return 1
    fi
    if (( elapsed >= 30 )); then
      echo "Timed out waiting for ${url}; startup log: ${log_file}"
      cat "${log_file}"
      return 1
    fi
    sleep 1
    ((elapsed+=1))
  done
}

cleanup_stale_processes 8001
cleanup_stale_processes 3456

start_and_wait "http://127.0.0.1:8001/health" /tmp/adpulse-ecoia.log \
  /home/codespace/.python/current/bin/python -m uvicorn eco_ia.app:app --host 127.0.0.1 --port 8001
start_and_wait "http://127.0.0.1:3456/api/health" /tmp/adpulse-node.log \
  env PORT=3456 NODE_ENV=production node dist/boot.js

printf 'ECO-IA runtime: %s\n' "http://127.0.0.1:8001"
printf 'ADPULSE runtime: %s\n' "http://127.0.0.1:3456"
printf 'ECO-IA health: %s\n' "$(curl -fsS http://127.0.0.1:8001/health)"
printf 'ADPULSE health: %s\n' "$(curl -fsS http://127.0.0.1:3456/api/health)"
