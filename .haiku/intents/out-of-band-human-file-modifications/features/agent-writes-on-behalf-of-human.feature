Feature: Agent writes a file on behalf of a human via haiku_human_write
  As a User in chat with the agent
  I want to ask "hey Claude, write this file for me" and have the result tracked as a human-attributed write
  So that my hand-instructed contribution is detected as out-of-band rather than silently regenerated later

  Background:
    Given an active intent "demo-intent" in stage "inception" at phase "elaborate"
    And the User is interacting with the agent in chat
    And a tracked surface baseline exists for stage "inception"
    And the MCP tool "haiku_human_write" is registered and available to the agent
  # ---------------------------------------------------------------------------
  # Happy Path: explicit user instruction
  # ---------------------------------------------------------------------------

  Scenario: User instructs the agent to save a file as human-attributed
    Given the User says "save this Tailwind config to knowledge/design-references/tailwind.config.js"
    When the agent invokes "haiku_human_write" with:
      | path                     | knowledge/design-references/tailwind.config.js                              |
      | content                  | <provided Tailwind config content>                                          |
      | user_instruction_excerpt | save this Tailwind config to knowledge/design-references/tailwind.config.js |
    Then the file is written atomically to the worktree at "knowledge/design-references/tailwind.config.js"
    And the tool stamps an action-log entry with author_class "human-via-mcp" for that path
    And the tool does NOT update baseline.json directly
    And the tool response includes author_class "human-via-mcp", the sha, and audit_log_appended true
    And on the next agent tick the drift-detection gate detects the file as changed with author_class "human-via-mcp"
    And the workflow emits a "manual_change_assessment" action

  Scenario: User asks the agent to extend a file the User just edited
    Given the User edited "stages/design/artifacts/spec.md" outside chat (filesystem drop)
    And the User says "extend the section I just added with the missing edge cases"
    When the agent calls haiku_run_next
    Then the drift-detection gate detects the User's earlier edit with change_kind "modified"
    And the workflow emits "manual_change_assessment"
    And the agent classifies the edit as "inline-fix"
    When the agent completes the requested extension via its normal Write tool
    Then the agent's write is attributed to author_class "agent"
    And the User's prior edit lines are preserved in the extended file
    And the new combined SHA becomes the next baseline entry with author_class "agent"
  # ---------------------------------------------------------------------------
  # Authorship integrity
  # ---------------------------------------------------------------------------

  Scenario: Agent uses normal Write tool for its own work (not haiku_human_write)
    When the Agent writes a unit-output file as part of its execute phase
    Then the Agent uses the normal Write tool (not "haiku_human_write")
    And the resulting baseline entry has author_class "agent" and acknowledged_via "agent-write"
    And no "manual_change_assessment" action fires for this file on the next tick

  Scenario: Agent invokes haiku_human_write without explicit user instruction context
    Given the User has not explicitly asked the agent to write a file on their behalf
    When the Agent invokes "haiku_human_write" with an empty user_instruction_excerpt field
    Then the tool returns error code "rationale_required" if the plugin setting "human_write_require_rationale" is true
    And no file is written when the error is returned
  # ---------------------------------------------------------------------------
  # Reconciliation requirement 7: Trust+Audit (DEC-9) audit log completeness
  # ---------------------------------------------------------------------------

  Scenario: Audit log records full attribution context for every successful haiku_human_write call
    Given the User says "hey Claude, write this brand guide to knowledge/brand-guide.md"
    When the Agent successfully invokes "haiku_human_write" with:
      | path                     | knowledge/brand-guide.md                                    |
      | content                  | <brand guide content>                                       |
      | human_author_id          | jwaldrip@gigsmart.com                                       |
      | rationale                | User asked to save brand guide for elaboration phase        |
      | user_instruction_excerpt | hey Claude, write this brand guide to knowledge/brand-guide |
    Then an audit log entry is appended to ".haiku/intents/demo-intent/write-audit.jsonl"
    And the audit log entry includes:
      | field                    | value                                                       |
      | author_class             | human-via-mcp                                               |
      | human_author_id          | jwaldrip@gigsmart.com                                       |
      | user_instruction_excerpt | hey Claude, write this brand guide to knowledge/brand-guide |
      | path                     | knowledge/brand-guide.md                                    |
      | sha                      | <SHA-256 hex digest of the written content>                 |
      | timestamp                | <ISO-8601 UTC timestamp>                                    |
    And the audit log entry also includes entry_id, tick_counter, session_id, overwrite flag, and dirs_created
    And the audit log file is in newline-delimited JSON format (one complete JSON object per line)
    And the audit log file is append-only (no prior record is modified)

  Scenario: Audit log is not appended for failed writes
    Given the Agent invokes "haiku_human_write" with path "stages/design/units/unit-01.md"
    When the tool returns error code "path_outside_tracked_surface"
    Then no entry is appended to "write-audit.jsonl"
    And the audit log records only successful writes

  Scenario: Security review can verify each human-via-mcp baseline entry has an audit log entry
    Given multiple "haiku_human_write" calls have been made across the intent lifetime
    When a security reviewer inspects "write-audit.jsonl"
    Then for every baseline.json entry with author_class "human-via-mcp" or acknowledged_via "human-write-tool" there is a corresponding audit log entry with a matching path, sha, and non-null user_instruction_excerpt
    And the audit log is directly inspectable with any standard text viewer without a proprietary reader
  # ---------------------------------------------------------------------------
  # Refusals: workflow-managed paths
  # ---------------------------------------------------------------------------

  Scenario: haiku_human_write refuses to write to a workflow-managed path
    When the Agent invokes "haiku_human_write" with path "stages/design/state.json"
    Then the tool returns error code "path_outside_tracked_surface" with reason "deny_list_match"
    And the error message names the appropriate MCP tool for writing state files
    And no file is written to disk

  Scenario: haiku_human_write refuses to write to the audit log itself
    When the Agent invokes "haiku_human_write" with path "write-audit.jsonl"
    Then the tool returns error code "path_outside_tracked_surface" with reason "deny_list_match"
    And no entry is appended to write-audit.jsonl
  # ---------------------------------------------------------------------------
  # Refusals: escape paths
  # ---------------------------------------------------------------------------

  Scenario: haiku_human_write refuses paths that escape the intent directory
    When the Agent invokes "haiku_human_write" with path "../../../etc/passwd"
    Then the tool returns error code "path_outside_tracked_surface" with reason "path_escape"
    And no file is written to disk
  # ---------------------------------------------------------------------------
  # Refusals: empty content
  # ---------------------------------------------------------------------------

  Scenario: haiku_human_write refuses zero-byte content
    When the Agent invokes "haiku_human_write" with content "" (empty string)
    Then the tool returns an error indicating empty content is not permitted
    And no file is written to disk
  # ---------------------------------------------------------------------------
  # Interactive vs autopilot mode integrity stances
  # ---------------------------------------------------------------------------

  Scenario: haiku_human_write completes without confirmation prompt in interactive mode (Trust+Audit, v1)
    Given the intent is running in mode "interactive"
    And the User says "save this file" and the Agent invokes "haiku_human_write" with valid inputs
    Then the write proceeds without an intermediate ask_user_visual_question prompt
    And the write completes with author_class "human-via-mcp"
    And the audit log entry is appended

  Scenario: haiku_human_write completes without confirmation prompt in autopilot mode (Trust+Audit, v1)
    Given the intent is running in mode "autopilot"
    When the Agent invokes "haiku_human_write" with valid inputs
    Then the write proceeds without a confirmation round-trip
    And the write completes with author_class "human-via-mcp"
    And the audit log entry is appended
