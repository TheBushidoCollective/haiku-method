#!/bin/bash
# config.sh - HAIKU Quality Gate Runner
#
# Provides quality gate execution for code-mode skills.
# Gates are passed as a JSON string parameter — the caller
# obtains gate config via MCP settings_read.
#
# Usage:
#   source config.sh
#   run_gates "Stop" "$gates_json"

# Run command-type quality gates for an event
# Usage: run_gates <event> <gates_json>
# Returns: 0 if all pass, 1 if any fail
run_gates() {
  local event="$1"
  local gates_json="${2:-[]}"

  if ! command -v jq &>/dev/null; then
    return 0
  fi

  local filtered
  filtered=$(echo "$gates_json" | jq -c "[.[] | select(.enabled != false and (.event // \"Stop\") == \"$event\")]" 2>/dev/null || echo "[]")

  local count
  count=$(echo "$filtered" | jq 'length' 2>/dev/null || echo "0")

  if [ "$count" -eq 0 ]; then
    return 0
  fi

  local i=0
  while [ "$i" -lt "$count" ]; do
    local gate
    gate=$(echo "$filtered" | jq -c ".[$i]")
    local gate_type
    gate_type=$(echo "$gate" | jq -r '.type // "command"')
    local gate_name
    gate_name=$(echo "$gate" | jq -r '.name')

    if [ "$gate_type" = "command" ]; then
      local cmd
      cmd=$(echo "$gate" | jq -r '.command // ""')
      if [ -n "$cmd" ]; then
        echo "Running gate: $gate_name" >&2
        if ! eval "$cmd" >/dev/null 2>&1; then
          echo "Gate FAILED: $gate_name" >&2
          return 1
        fi
        echo "Gate PASSED: $gate_name" >&2
      fi
    fi

    i=$((i + 1))
  done

  return 0
}
