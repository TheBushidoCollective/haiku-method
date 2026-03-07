---
description: (Internal) Advance to the next hat in the HAIKU workflow
user-invocable: false
---

## Name

`haiku:advance` - Move to the next hat in the HAIKU workflow sequence.

## Synopsis

```
/advance
```

## Description

**Internal command** - Called by the AI during `/execute`, not directly by users.

Advances to the next hat in the workflow sequence. For example, in the default workflow:
- planner -> executor (plan ready, now execute)
- executor -> reviewer (execution complete, now review)

**When at the last hat (reviewer)**, `/advance` handles completion automatically:
- If all units complete -> Mark intent as complete
- If more units ready -> Loop back to executor for next unit
- If blocked (no ready units) -> Alert user

## Implementation

### Step 1: Load Current State

```bash
source "${CLAUDE_PLUGIN_ROOT}/lib/workspace.sh"
source "${CLAUDE_PLUGIN_ROOT}/lib/storage.sh"
source "${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"

STATE=$(storage_load_state "iteration.json")
INTENT_SLUG=$(storage_load_state "intent-slug")
WORKSPACE=$(resolve_workspace)
INTENT_DIR="$WORKSPACE/intents/${INTENT_SLUG}"
```

### Step 2: Determine Next Hat

```javascript
const workflow = state.workflow || ["planner", "executor", "reviewer"];
const currentIndex = workflow.indexOf(state.hat);
const nextIndex = currentIndex + 1;

if (nextIndex >= workflow.length) {
  // At last hat - check DAG status
  // See Step 2b below
}

const nextHat = workflow[nextIndex];
```

### Step 2b: Last Hat Logic

When at the last hat, check DAG:

```bash
# Mark current unit as completed
CURRENT_UNIT=$(echo "$STATE" | jq -r '.currentUnit // ""')
if [ -n "$CURRENT_UNIT" ] && [ -f "$INTENT_DIR/${CURRENT_UNIT}.md" ]; then
  update_unit_status "$INTENT_DIR/${CURRENT_UNIT}.md" "completed"
fi

# Check DAG status
SUMMARY=$(get_dag_summary "$INTENT_DIR")
```

- **All complete (no passes or last pass)**: Mark intent complete, output summary
- **Pass complete (more passes remain)**: Transition to next pass — see Step 2c
- **More units ready**: Loop back to first hat for next unit
- **All blocked**: Alert user

### Step 2c: Pass Transition Logic

When all units for the current pass are complete but the intent has more passes:

```bash
source "${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"

# Read pass configuration from intent.md
PASSES=$(_yaml_get_array "passes" < "$INTENT_DIR/intent.md")
ACTIVE_PASS=$(_yaml_get_simple "active_pass" "" < "$INTENT_DIR/intent.md")

if [ -n "$PASSES" ] && [ -n "$ACTIVE_PASS" ]; then
  if is_pass_complete "$INTENT_DIR" "$ACTIVE_PASS"; then
    # Find the next pass
    NEXT_PASS=""
    FOUND_ACTIVE=false
    for pass in $PASSES; do
      if [ "$FOUND_ACTIVE" = "true" ]; then
        NEXT_PASS="$pass"
        break
      fi
      [ "$pass" = "$ACTIVE_PASS" ] && FOUND_ACTIVE=true
    done

    if [ -n "$NEXT_PASS" ]; then
      # Update active_pass in intent.md
      sed -i.bak "s/^active_pass:.*$/active_pass: $NEXT_PASS/" "$INTENT_DIR/intent.md"
      rm -f "$INTENT_DIR/intent.md.bak"
    fi
  fi
fi
```

**If a next pass exists:** Do NOT mark intent complete. Instead:
1. Update `active_pass` in intent.md frontmatter to the next pass
2. Notify the user: "The **{active_pass}** pass is complete. The next pass is **{next_pass}**. Run `/elaborate` to define {next_pass} units using the artifacts from the {active_pass} pass."
3. Stop execution — the user will re-elaborate for the next pass

**If no next pass** (last pass or no passes configured): Continue with normal completion logic.

### Step 3: Update State

```bash
# Increment iteration
ITERATION=$(($(echo "$STATE" | jq -r '.iteration') + 1))

# Update state with new hat
storage_save_state "iteration.json" "{updated state}"
```

### Step 4: Confirm

Output:
```
Advanced to **{nextHat}** hat. Continuing execution...
```

### Step 5: Completion Summary

When all units done:

```
## Intent Complete!

**Total iterations:** {count}
**Workflow:** {name}

### What Was Done
{Summary from intent}

### Units Completed
{List of completed units}

### Criteria Satisfied
{List of completion criteria}
```
