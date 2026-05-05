Feature: Assessment schema and audit fields
  An Assessment is the durable append-only record of every manual_change_assessment dispatch:
  what changed, what the agent decided, and the full audit trail required by DEC-9.

  Background:
    Given an active intent "out-of-band-human-file-modifications"
    And a manual_change_assessment action is dispatched with at least one DriftFinding

  # --- Schema completeness ---

  Scenario: Assessment record contains all required fields including DEC-9 audit fields
    Given the agent calls haiku_classify_drift with valid classifications
    When the Assessment record is written
    Then the record contains all fields:
      | field              | type              | required |
      | id                 | string            | yes      |
      | created_at         | RFC3339           | yes      |
      | tick_id            | string            | yes      |
      | findings           | array             | yes      |
      | classifications    | array             | yes      |
      | agent_rationale    | string            | yes      |
      | initiated_by       | string            | yes      |
      | triggering_request | string            | yes      |
      | target_path        | string            | yes      |
      | resulting_sha      | string or null    | yes      |
      | recorded_at        | RFC3339           | yes      |
      | mode               | enum              | yes      |
      | confirmed_by_user  | boolean           | yes      |
      | revisit_invoked_at | RFC3339 or null   | yes      |

  # --- ID format ---

  Scenario: Assessment ID follows AS-NN format
    Given no previous assessments exist for the intent
    When the first assessment is created
    Then its "id" is "AS-01"

  Scenario: Assessment IDs increment sequentially
    Given assessments "AS-01" through "AS-05" already exist
    When a new assessment is created
    Then its "id" is "AS-06"

  # --- parallel-indexing invariant ---

  Scenario: classifications array length equals findings array length
    Given a manual_change_assessment action contains 3 findings
    When the agent submits 3 classifications via haiku_classify_drift
    Then the Assessment record's "classifications" array has exactly 3 elements
    And each element corresponds to the finding at the same array index

  Scenario: Assessment write fails when classifications count mismatches findings count
    Given a manual_change_assessment action contains 3 findings
    When the agent submits 2 classifications via haiku_classify_drift
    Then haiku_classify_drift returns error "classifications_count_mismatch"
    And no Assessment record is written

  # --- DEC-9 audit fields ---

  Scenario: initiated_by is recorded for every assessment
    Given the agent session has identity "haiku-agent-session-abc123"
    When haiku_classify_drift is called
    Then the Assessment's "initiated_by" = "haiku-agent-session-abc123"

  Scenario: triggering_request captures the conversation context
    Given the user said "Please check this layout update"
    When haiku_classify_drift is called with "triggering_request" = "Please check this layout update"
    Then the Assessment's "triggering_request" contains that text (first 200 chars)

  Scenario: target_path is the primary finding's path
    Given the findings array has "stages/design/artifacts/hero-layout.html" as the first element
    When haiku_classify_drift submits the assessment
    Then the Assessment's "target_path" = "stages/design/artifacts/hero-layout.html"

  Scenario: resulting_sha is set at classification time for terminal outcomes
    Given the agent classifies a finding as "ignore"
    And the current on-disk SHA of the file is "ab12cd34..."
    When haiku_classify_drift commits the classification
    Then the Assessment's "resulting_sha" = "ab12cd34..."

  Scenario: resulting_sha is null at classification time for non-terminal outcomes
    Given the agent classifies a finding as "surface-as-feedback"
    And the on-disk SHA at classification time is "ab12cd34..."
    When haiku_classify_drift commits the classification
    Then the Assessment's "resulting_sha" = null
    And the Assessment record is written once and never modified again

  Scenario: Assessment.resulting_sha remains null for non-terminal outcomes after marker clearance
    Given an Assessment record with "resulting_sha" = null (a surface-as-feedback classification)
    And the linked feedback "FB-12" is resolved and haiku_baseline_clear_marker fires
    Then the Assessment's "resulting_sha" is still null
    And the post-clearance SHA is on PendingMarker.resolved_sha
    And the post-clearance SHA is in the "pending_marker_cleared" event payload's "resolved_sha" field

  # --- mode enum ---

  Scenario Outline: mode reflects the invocation mode at assessment time
    Given the intent is running in mode "<mode>"
    When a manual_change_assessment dispatch is classified
    Then the Assessment's "mode" = "<mode>"
    Examples:
      | mode        |
      | interactive |
      | pickup      |
      | autopilot   |
      | hybrid      |

  # --- revisit_invoked_at state machine ---

  Scenario: revisit_invoked_at is null immediately after trigger-revisit classification
    Given the agent classifies a finding as "trigger-revisit"
    When haiku_classify_drift writes the Assessment record
    Then "revisit_invoked_at" = null

  Scenario: revisit_invoked_at is set when haiku_revisit is called on the next tick
    Given an Assessment exists with "outcome" = "trigger-revisit" and "revisit_invoked_at" = null
    When the workflow engine calls haiku_revisit for the target stage
    Then the Assessment's "revisit_invoked_at" is set to the current UTC timestamp
    And the SPA transitions the card from "pending-revisit" to "revisit-invoked" state

  # --- Append-only guarantee ---

  Scenario: An Assessment record cannot be modified after it is written
    Given Assessment "AS-07" has been written to disk
    When any process attempts to overwrite "AS-07" with different content
    Then the write is rejected or the existing record is preserved unchanged

  Scenario: confirmed_by_user defaults to false in autopilot mode
    Given the intent is running in autopilot mode
    When a manual_change_assessment dispatch is classified
    Then the Assessment's "confirmed_by_user" = false
