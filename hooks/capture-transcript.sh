#!/bin/bash
# capture-transcript.sh - SessionStart hook
#
# Captures the transcript_path from the hook payload and persists it
# as HAIKU_TRANSCRIPT_PATH via CLAUDE_ENV_FILE so skills (e.g. /reflect)
# can read the session conversation.

set -e

# Read stdin to get SessionStart payload
HOOK_INPUT=$(cat)

# Extract transcript_path
TRANSCRIPT_PATH=""
if command -v jq &>/dev/null; then
  TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // empty')
else
  [[ "$HOOK_INPUT" =~ \"transcript_path\":\ *\"([^\"]+)\" ]] && TRANSCRIPT_PATH="${BASH_REMATCH[1]}"
fi

# Persist to CLAUDE_ENV_FILE so Bash tool calls can access it
if [ -n "$TRANSCRIPT_PATH" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export HAIKU_TRANSCRIPT_PATH=\"$TRANSCRIPT_PATH\"" >> "$CLAUDE_ENV_FILE"
fi
