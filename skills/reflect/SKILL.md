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
3. Produces a `reflection.md` artifact in the intent's workspace directory
4. Presents findings for user validation and augmentation
5. Offers two paths: **Iterate** (create intent v2 with learnings) or **Close** (capture organizational memory and archive)

## Implementation

### Step 0: Load State

```bash
# Source HAIKU libraries
source "${CLAUDE_PLUGIN_ROOT}/lib/workspace.sh"
source "${CLAUDE_PLUGIN_ROOT}/lib/storage.sh"
source "${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"
source "${CLAUDE_PLUGIN_ROOT}/lib/config.sh"

# Resolve workspace and determine intent slug
WORKSPACE=$(resolve_workspace)
INTENT_SLUG="${1:-$(storage_load_state "intent-slug")}"
```

If no intent slug found:
```
No HAIKU intent found.
Run /elaborate to start a new task, or provide an intent slug: /reflect my-intent
```

### Step 1: Load Intent and Unit Data

```bash
INTENT_DIR="$WORKSPACE/intents/${INTENT_SLUG}"
INTENT_FILE="$INTENT_DIR/intent.md"
```

Read the following artifacts:
- `intent.md` - Intent definition, success criteria, scope
- All `unit-*.md` files - Unit specs with statuses and completion criteria
- `operations.md` - Operational plan (if exists)
- `completion-criteria.md` - Consolidated criteria list (if exists)

If `intent.md` does not exist:
```
No intent found at {workspace}/intents/{intent-slug}/intent.md

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

### Step 2b: Load Session Transcript (if available)

Check if the session transcript is accessible. The `HAIKU_TRANSCRIPT_PATH` environment variable is set by the SessionStart hook when the session provides a transcript path.

```bash
TRANSCRIPT_PATH="${HAIKU_TRANSCRIPT_PATH:-}"
HAS_TRANSCRIPT=false

if [ -n "$TRANSCRIPT_PATH" ] && [ -f "$TRANSCRIPT_PATH" ]; then
  HAS_TRANSCRIPT=true
  echo "Session transcript available at: $TRANSCRIPT_PATH"
fi
```

If the transcript is available, read it to extract conversation-level insights that artifacts alone cannot capture:

```bash
if [ "$HAS_TRANSCRIPT" = "true" ]; then
  # The transcript is a JSONL file — each line is a JSON object representing
  # a conversation turn (user messages, assistant responses, tool calls/results).
  # Read the full transcript for analysis.
  cat "$TRANSCRIPT_PATH"
fi
```

When analyzing the transcript, look for:
- **Decision points** — where the user made choices or changed direction
- **Confusion or rework** — repeated attempts, corrections, or misunderstandings
- **Implicit feedback** — user satisfaction signals, frustration, or surprise
- **Collaboration dynamics** — how initiative was shared between human and AI
- **Tool usage patterns** — which tools were effective, which caused friction
- **Context loss** — moments where the AI lost track or needed reminding

**This step is optional.** If `HAIKU_TRANSCRIPT_PATH` is not set or the file doesn't exist, skip transcript analysis and rely solely on artifacts and state. Note in the reflection that transcript analysis was not available.

### Step 3: Don the Reflector Hat

Load and follow the Reflector hat instructions from `hats/reflector.md`.

As the Reflector, analyze:

1. **Execution patterns** — Which units went smoothly? Which required retries?
2. **Criteria satisfaction** — How well were success criteria met? Any partial satisfaction?
3. **Process observations** — What approaches worked? What was painful?
4. **Operational outcomes** — How did operational tasks perform? Any gaps?
5. **Blocker analysis** — Were blockers systemic or one-off? Could they be prevented?

If the session transcript was loaded in Step 2b, also analyze:

6. **Collaboration quality** — How well did human and AI work together? Were handoffs smooth?
7. **Decision archaeology** — What decisions were made during the session? Were any revisited or reversed?
8. **Process friction** — Where did the workflow create friction? Where was it smooth?
9. **Implicit learnings** — What did the conversation reveal that the artifacts don't capture?

Ground all analysis in evidence from the artifacts and transcript. Do not speculate without data.

### Step 4: Produce reflection.md

Write the reflection artifact to the intent directory:

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

## Collaboration Insights
{Only include this section if transcript analysis was available}
- **Decision points**: {Key decisions and their outcomes}
- **Process friction**: {Where the workflow helped or hindered}
- **Collaboration dynamics**: {How human-AI interaction evolved}

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
- Syncs to MCP server if `memory.mcp` is configured
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
# Tag in git if available
git tag "haiku/${INTENT_SLUG}/v${CURRENT_VERSION}" 2>/dev/null || true
# Archive directory
mv "$WORKSPACE/intents/${INTENT_SLUG}" "$WORKSPACE/intents/${INTENT_SLUG}-v${CURRENT_VERSION}"
```

3. **Seed new intent**:
Create a new `{workspace}/intents/{intent-slug}/` directory with:
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

**Archived:** {workspace}/intents/{intent-slug}-v{CURRENT_VERSION}/
**New intent:** {workspace}/intents/{intent-slug}/

The new intent has been seeded with learnings from the reflection.
Run `/elaborate` to begin the next iteration with pre-loaded context.
```

### Step 7b: Close Path

If user chooses to close:

1. **Distill learnings** into concise, reusable patterns.

2. **Write organizational memory** using the memory library:

```bash
source "${CLAUDE_PLUGIN_ROOT}/lib/memory.sh"
```

Append to `learnings.md` in the workspace's memory directory:
```markdown
## {Intent Title} ({ISO date})

### Patterns
- {Reusable pattern from this intent}

### Anti-Patterns
- {What to avoid, with context}

### Process Insights
- {Process improvement that applies broadly}
```

Use `memory_write "learnings" "$CONTENT" "append"` to save.

If the workspace's `settings.yml` has `memory.mcp` configured (e.g., `notion`, `filesystem`), also write the learnings to that MCP server so they are accessible to the broader team. Use the MCP server's write/create tools to store the content.

3. **Archive intent**:

```bash
sed -i.bak 's/^status:.*$/status: archived/' "$WORKSPACE/intents/${INTENT_SLUG}/intent.md"
rm -f "$WORKSPACE/intents/${INTENT_SLUG}/intent.md.bak"
```

4. **Output**:
```markdown
## Intent Closed

**Intent:** {title}
**Status:** archived
**Learnings saved to:** {workspace}/memory/learnings.md

### Key Learnings Captured
{summary of what was written to memory}

The intent has been archived. Learnings are available for future intents.
```
