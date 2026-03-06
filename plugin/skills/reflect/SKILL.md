---
description: Analyze a completed HAIKU intent cycle and produce reflection artifacts with learnings, metrics, and recommendations
argument-hint: "[intent-slug]"
---

## Name

`haiku:reflect` - Reflection phase for analyzing outcomes and capturing learnings.

## Synopsis

```
/reflect [intent-slug]
```

## Description

**User-facing command** - Analyze a completed (or nearly completed) HAIKU execution cycle.

The reflect skill:
1. Reads all unit specs, execution state, and operational outcomes for the intent
2. Analyzes the full cycle: execution metrics, what worked, what didn't, patterns
3. Produces a `reflection.md` artifact in `.haiku/{intent-slug}/`
4. Presents findings for user validation and augmentation
5. Offers two paths: **Iterate** (create intent v2 with learnings) or **Close** (capture organizational memory and archive)

## Implementation

### Step 0: Load State

```bash
# Source HAIKU libraries
source "${CLAUDE_PLUGIN_ROOT}/lib/storage.sh"
source "${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"
source "${CLAUDE_PLUGIN_ROOT}/lib/config.sh"

# Determine intent slug
INTENT_SLUG="${1:-$(storage_load_state "intent-slug")}"
```

If no intent slug found:
```
No HAIKU intent found.
Run /elaborate to start a new task, or provide an intent slug: /reflect my-intent
```

### Step 1: Load Intent and Unit Data

```bash
INTENT_DIR=".haiku/${INTENT_SLUG}"
INTENT_FILE="$INTENT_DIR/intent.md"
```

Read the following artifacts:
- `intent.md` - Intent definition, success criteria, scope
- All `unit-*.md` files - Unit specs with statuses and completion criteria
- `operations.md` - Operational plan (if exists)
- `completion-criteria.md` - Consolidated criteria list (if exists)

If `intent.md` does not exist:
```
No intent found at .haiku/{intent-slug}/intent.md

Run /elaborate to create a new intent.
```

### Step 2: Gather Execution Metrics

Collect data from state storage and artifacts:

```bash
# Load iteration state
STATE=$(storage_load_state "iteration.json")
OP_STATUS=$(storage_load_state "operation-status.json")

# Get DAG summary
SUMMARY=$(get_dag_summary "$INTENT_DIR")

# Parse per-unit data
for unit_file in "$INTENT_DIR"/unit-*.md; do
  UNIT_NAME=$(basename "$unit_file" .md)
  UNIT_STATUS=$(parse_unit_status "$unit_file")
  # Load unit-level state if available
  UNIT_STATE=$(storage_load_unit_state "$UNIT_NAME" "scratchpad.md")
done
```

Metrics to extract:
- **Units completed** vs total
- **Total iterations** (from iteration.json)
- **Workflow used** (from iteration.json)
- **Blockers encountered** (from unit scratchpads and state)
- **Quality gate pass/fail history** (from state if recorded)
- **Operational task status** (from operation-status.json)

### Step 3: Don the Reflector Hat

Load and follow the Reflector hat instructions from `hats/reflector.md`.

As the Reflector, analyze:

1. **Execution patterns** - Which units went smoothly? Which required retries?
2. **Criteria satisfaction** - How well were success criteria met? Any partial satisfaction?
3. **Process observations** - What approaches worked? What was painful?
4. **Operational outcomes** - How did operational tasks perform? Any gaps?
5. **Blocker analysis** - Were blockers systemic or one-off? Could they be prevented?

Ground all analysis in evidence from the artifacts. Do not speculate without data.

### Step 4: Produce reflection.md

Write the reflection artifact to `.haiku/{intent-slug}/reflection.md`:

```markdown
---
intent: {intent-slug}
version: 1
created: {ISO date}
status: complete
---

# Reflection: {Intent Title}

## Execution Summary
- Units completed: N/M
- Total iterations: X
- Workflow: {workflow name}
- Blockers encountered: Z

## What Worked
- {Specific thing with evidence from execution}

## What Didn't Work
- {Specific thing with proposed improvement}

## Operational Outcomes
- {How operational tasks performed, if applicable}

## Key Learnings
- {Distilled actionable insight}

## Recommendations
- [ ] {Specific recommendation}

## Next Iteration Seed
{What v2 should focus on, if the user chooses to iterate}
```

### Step 5: Present Findings for Validation

Output the reflection summary and ask the user to:
1. Validate the findings -- are they accurate?
2. Add human observations the agent may have missed
3. Correct any mischaracterizations

Use `AskUserQuestion` to gather user input.

Update `reflection.md` with any user corrections or additions.

### Step 6: Update State

```bash
# Update reflection status in state
REFLECTION_STATE=$(cat <<EOF
{
  "phase": "reflection",
  "reflectionStatus": "awaiting-input",
  "version": 1,
  "previousVersions": []
}
EOF
)
storage_save_state "reflection-status.json" "$REFLECTION_STATE"
```

After user validates:
```bash
REFLECTION_STATE=$(echo "$REFLECTION_STATE" | jq '.reflectionStatus = "complete"')
storage_save_state "reflection-status.json" "$REFLECTION_STATE"
```

### Step 7: Offer Next Steps

Present two paths:

```markdown
## Next Steps

The reflection is complete. Choose a path:

### Option A: Iterate
Create a new version of this intent with learnings pre-loaded.
- Archives current intent as v1
- Creates new elaboration with reflection context
- Pre-loads recommendations as constraints

### Option B: Close
Capture organizational learnings and archive this intent.
- Distills key learnings into organizational memory
- Writes patterns to configurable memory location
- Archives the intent
```

Use `AskUserQuestion` to get the user's choice.

### Step 7a: Iterate Path

If user chooses to iterate:

1. **Determine version number**:
```bash
CURRENT_VERSION=$(storage_load_state "reflection-status.json" | jq -r '.version // 1')
NEXT_VERSION=$((CURRENT_VERSION + 1))
```

2. **Archive current intent**:
```bash
MODE=$(detect_storage_mode)

case "$MODE" in
  git)
    # Tag the current state
    git tag "haiku/${INTENT_SLUG}/v${CURRENT_VERSION}" 2>/dev/null || true
    ;;
  folder)
    # Rename directory
    mv ".haiku/${INTENT_SLUG}" ".haiku/${INTENT_SLUG}-v${CURRENT_VERSION}"
    ;;
esac
```

3. **Seed new intent**:
Create a new `.haiku/{intent-slug}/` directory with:
- A new `intent.md` that references the reflection learnings
- Pre-loaded recommendations as constraints in the intent frontmatter
- Link to the archived version for reference

4. **Update state**:
```bash
REFLECTION_STATE=$(echo "$REFLECTION_STATE" | jq \
  --arg v "$CURRENT_VERSION" \
  '.previousVersions += [$v | tonumber] | .version = (.version + 1)')
storage_save_state "reflection-status.json" "$REFLECTION_STATE"
```

5. **Output**:
```markdown
## Intent Archived and Ready for v{NEXT_VERSION}

**Archived:** .haiku/{intent-slug}-v{CURRENT_VERSION}/ (folder) or tag haiku/{intent-slug}/v{CURRENT_VERSION} (git)
**New intent:** .haiku/{intent-slug}/

The new intent has been seeded with learnings from the reflection.
Run `/elaborate` to begin the next iteration with pre-loaded context.
```

### Step 7b: Close Path

If user chooses to close:

1. **Distill learnings** into concise, reusable patterns:
```bash
MODE=$(detect_storage_mode)

case "$MODE" in
  git)
    # Write to .claude/memory/ or project CLAUDE.md
    MEMORY_DIR=".claude/memory"
    mkdir -p "$MEMORY_DIR"
    ;;
  folder)
    # Write to .haiku/memory/
    MEMORY_DIR=".haiku/memory"
    mkdir -p "$MEMORY_DIR"
    ;;
esac
```

2. **Write organizational memory**:
Create or append to `$MEMORY_DIR/learnings.md`:
```markdown
## {Intent Title} ({ISO date})

### Patterns
- {Reusable pattern from this intent}

### Anti-Patterns
- {What to avoid, with context}

### Process Insights
- {Process improvement that applies broadly}
```

3. **Archive intent**:
```bash
# Update intent status
# Use sed or han to set status: archived in intent.md frontmatter
```

4. **Output**:
```markdown
## Intent Closed

**Intent:** {title}
**Status:** archived
**Learnings saved to:** {memory_dir}/learnings.md

### Key Learnings Captured
{summary of what was written to memory}

The intent has been archived. Learnings are available for future intents.
```
