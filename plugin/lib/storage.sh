#!/bin/bash
# storage.sh - HAIKU Storage Abstraction Layer
#
# Provides a unified API for state persistence within the workspace.
# State is stored at {workspace}/intents/{intent-slug}/state/
#
# Usage:
#   source storage.sh
#   storage_save_state "iteration.json" "$STATE"
#   VALUE=$(storage_load_state "iteration.json")

STORAGE_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! type resolve_workspace &>/dev/null; then
  # shellcheck source=workspace.sh
  source "$STORAGE_SCRIPT_DIR/workspace.sh"
fi

# Get the state directory for an intent
# Usage: _state_dir [intent_slug]
_state_dir() {
  local intent_slug="${1:-${HAIKU_INTENT_SLUG:-}}"
  local workspace
  workspace=$(resolve_workspace)
  if [ -n "$intent_slug" ]; then
    echo "$workspace/intents/${intent_slug}/state"
  else
    echo "$workspace/state"
  fi
}

# Save state to storage
# Usage: storage_save_state <key> <value>
storage_save_state() {
  local key="$1"
  local value="$2"
  local state_dir
  state_dir=$(_state_dir)
  mkdir -p "$state_dir"
  printf '%s' "$value" > "$state_dir/$key"
}

# Load state from storage
# Usage: storage_load_state <key>
storage_load_state() {
  local key="$1"
  local state_dir
  state_dir=$(_state_dir)
  if [ -f "$state_dir/$key" ]; then
    cat "$state_dir/$key"
  else
    echo ""
  fi
}

# Save unit-scoped state
# Usage: storage_save_unit_state <unit_name> <key> <value>
storage_save_unit_state() {
  local unit_name="$1"
  local key="$2"
  local value="$3"
  local intent_slug="${HAIKU_INTENT_SLUG:-}"
  local workspace
  workspace=$(resolve_workspace)
  local unit_dir="$workspace/intents/${intent_slug}/units/${unit_name}/state"
  mkdir -p "$unit_dir"
  printf '%s' "$value" > "$unit_dir/$key"
}

# Load unit-scoped state
# Usage: storage_load_unit_state <unit_name> <key>
storage_load_unit_state() {
  local unit_name="$1"
  local key="$2"
  local intent_slug="${HAIKU_INTENT_SLUG:-}"
  local workspace
  workspace=$(resolve_workspace)
  local unit_dir="$workspace/intents/${intent_slug}/units/${unit_name}/state"
  if [ -f "$unit_dir/$key" ]; then
    cat "$unit_dir/$key"
  else
    echo ""
  fi
}

# List all state keys
# Usage: storage_list_keys [prefix]
storage_list_keys() {
  local prefix="${1:-}"
  local state_dir
  state_dir=$(_state_dir)
  if [ -d "$state_dir" ]; then
    ls "$state_dir" 2>/dev/null | grep "^${prefix}" || true
  fi
}

# Delete a state key
# Usage: storage_delete_state <key>
storage_delete_state() {
  local key="$1"
  local state_dir
  state_dir=$(_state_dir)
  rm -f "$state_dir/$key" 2>/dev/null || true
}
