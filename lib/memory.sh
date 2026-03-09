#!/bin/bash
# memory.sh - HAIKU Organizational Memory
#
# Provides read/write access to persistent organizational memory.
# Memory is the cross-intent layer — learnings, patterns, and domain
# knowledge that compounds across intents.
#
# Memory lives in {workspace}/memory/ and supports hierarchical
# inheritance: child workspaces inherit memory from parent workspaces.
#
# Usage:
#   source memory.sh
#   content=$(memory_read "learnings")
#   memory_write "learnings" "$CONTENT" "append"

MEMORY_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! type resolve_workspace &>/dev/null; then
  # shellcheck source=workspace.sh
  source "$MEMORY_SCRIPT_DIR/workspace.sh"
fi

# Get the memory directory for the current workspace
# Usage: memory_dir
memory_dir() {
  echo "$(resolve_workspace)/memory"
}

# Read a memory file from the current workspace
# Usage: memory_read <name>
memory_read() {
  local name="$1"
  local file="$(memory_dir)/${name}.md"
  if [ -f "$file" ]; then
    cat "$file"
  else
    echo ""
  fi
}

# Write to a memory file in the current workspace
# Usage: memory_write <name> <content> [mode]
# mode: "overwrite" (default) or "append"
memory_write() {
  local name="$1"
  local content="$2"
  local mode="${3:-overwrite}"
  local dir
  dir=$(memory_dir)
  mkdir -p "$dir"
  local file="$dir/${name}.md"

  case "$mode" in
    append)
      printf '\n%s' "$content" >> "$file"
      ;;
    *)
      printf '%s' "$content" > "$file"
      ;;
  esac
}

# List available memory files in the current workspace
# Usage: memory_list
memory_list() {
  local dir
  dir=$(memory_dir)
  if [ -d "$dir" ]; then
    for f in "$dir"/*.md; do
      [ -f "$f" ] || continue
      basename "$f" .md
    done
  fi
}

# Read all memory as a context block for injection
# Walks up the workspace hierarchy for inherited memory.
# Usage: memory_context [max_lines]
memory_context() {
  local max_lines="${1:-100}"
  local has_content=false output=""

  # Resolve all memory directories (most-specific first)
  local memory_dirs=()
  while IFS= read -r dir; do
    [ -n "$dir" ] && memory_dirs+=("$dir")
  done < <(resolve_memory_dirs)

  if [ ${#memory_dirs[@]} -eq 0 ]; then
    return
  fi

  # Walk from most-specific to least-specific
  for dir in "${memory_dirs[@]}"; do
    # Determine label for this level
    local workspace_root
    workspace_root=$(resolve_workspace)
    if [[ "$workspace_root" != /* ]]; then
      workspace_root="$(cd "$workspace_root" 2>/dev/null && pwd)" || workspace_root=""
    fi

    local level_label=""
    local dir_parent
    dir_parent=$(dirname "$dir")
    if [ "$dir_parent" = "$workspace_root" ] || [ "$dir" = "$workspace_root/memory" ]; then
      level_label=""
    else
      level_label=" ($(basename "$dir_parent"))"
    fi

    for f in "$dir"/*.md; do
      [ -f "$f" ] || continue
      local name content
      name=$(basename "$f" .md)
      content=$(cat "$f")
      [ -z "$content" ] && continue
      has_content=true
      output="${output}#### ${name}${level_label}

${content}

"
    done

    # Also check subdirectories (e.g., domain/)
    for subdir in "$dir"/*/; do
      [ -d "$subdir" ] || continue
      local subdir_name
      subdir_name=$(basename "$subdir")
      for f in "$subdir"/*.md; do
        [ -f "$f" ] || continue
        local name content
        name=$(basename "$f" .md)
        content=$(cat "$f")
        [ -z "$content" ] && continue
        has_content=true
        output="${output}#### ${subdir_name}/${name}${level_label}

${content}

"
      done
    done
  done

  if [ "$has_content" = "true" ]; then
    echo "$output" | head -n "$max_lines"
  fi
}
