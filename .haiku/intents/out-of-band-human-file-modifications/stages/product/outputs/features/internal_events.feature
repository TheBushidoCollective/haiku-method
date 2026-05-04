Feature: Internal workflow events
  Three internal events are emitted to the append-only structured log channel. All use the
  same channel as existing events (feedback_triage_completed, unit_advanced, etc.).
  Events are immutable after emission; no consumer may modify them.

  Background:
    Given an active intent "out-of-band-human-file-modifications"
    And the workflow event log is being observed

  # =========================================================================
  # drift_detected
  # =========================================================================

  Scenario: drift_detected is emitted for each diverging file, not once per tick batch
    Given the drift-detection gate finds 3 files with SHA divergences on a single tick
    When the gate completes its scan
    Then exactly 3 "drift_detected" events are appended to the log

  Scenario: drift_detected event contains required fields
    Given a file "stages/design/artifacts/hero-layout.html" has a modified SHA
    When the drift gate emits a drift_detected event for it
    Then the event contains:
      | field        | type    | present |
      | event_type   | string  | yes     |
      | event_at     | RFC3339 | yes     |
      | intent_slug  | string  | yes     |
      | stage        | string  | yes     |
      | tick_id      | string  | yes     |
      | file_path    | string  | yes     |
      | change_kind  | enum    | yes     |
      | author_class | enum    | yes     |
      | is_binary    | boolean | yes     |

  Scenario: drift_detected event_type is always the literal "drift_detected"
    When a drift event is emitted
    Then "event_type" = "drift_detected"

  Scenario: drift_detected uses canonical change_kind values
    Given a file is modified on disk
    When the drift event is emitted
    Then "change_kind" is one of "added", "modified", "deleted"
    And NOT "created", "updated", "removed", or any other value

  Scenario: drift_detected does not include SHA values or diff payloads
    Given a drift event is emitted for a modified text file
    When the event is inspected
    Then the event does NOT contain a "sha" field
    And the event does NOT contain a "diff" or "diff_unified" field

  Scenario: drift_detected author_class is null for added events with no baseline entry
    Given a new file appears with no baseline entry
    When the drift event is emitted
    Then "change_kind" = "added"
    And "author_class" = null

  Scenario: drift_detected for human-via-mcp write carries human-via-mcp author_class
    Given the SPA upload endpoint wrote a file and stamped the action log with author_class "human-via-mcp"
    When the drift gate reads the action log and emits the event
    Then "author_class" = "human-via-mcp"

  # =========================================================================
  # assessment_recorded
  # =========================================================================

  Scenario: assessment_recorded is emitted once per haiku_classify_drift call (not once per finding)
    Given a dispatch contains 4 findings
    And the agent submits all 4 classifications in one haiku_classify_drift call
    When the tool completes
    Then exactly 1 "assessment_recorded" event is emitted

  Scenario: assessment_recorded event contains required fields
    When an assessment is recorded
    Then the event contains:
      | field                  | type    | present |
      | event_type             | string  | yes     |
      | event_at               | RFC3339 | yes     |
      | intent_slug            | string  | yes     |
      | assessment_id          | string  | yes     |
      | stage                  | string  | yes     |
      | tick_id                | string  | yes     |
      | outcomes_count         | object  | yes     |
      | feedback_ids_created   | array   | yes     |
      | baselines_updated      | integer | yes     |
      | pending_markers_created| integer | yes     |
      | mode                   | enum    | yes     |

  Scenario: assessment_recorded event_type is always the literal "assessment_recorded"
    When an assessment event is emitted
    Then "event_type" = "assessment_recorded"

  Scenario: outcomes_count keys use canonical outcome enum values
    Given an assessment classifies 2 findings as "inline-fix" and 1 as "surface-as-feedback"
    When the assessment_recorded event is emitted
    Then "outcomes_count" is:
      | key                  | value |
      | ignore               | 0     |
      | inline-fix           | 2     |
      | surface-as-feedback  | 1     |
      | trigger-revisit      | 0     |
    And no other keys appear in "outcomes_count"

  Scenario: feedback_ids_created is an empty array when no feedback was created
    Given all classifications have terminal outcomes (ignore / inline-fix)
    When the assessment_recorded event is emitted
    Then "feedback_ids_created" = []

  Scenario: assessment_recorded baselines_updated reflects only terminal-outcome baseline writes
    # Per DATA-CONTRACTS.md §3.5 R6 contract: surface-as-feedback and trigger-revisit defer
    # the baseline update to marker clearance. Only terminal outcomes (ignore, inline-fix)
    # increment baselines_updated at classification time.
    Given 2 findings classified as "inline-fix" and 1 as "surface-as-feedback"
    When the assessment_recorded event is emitted
    Then "baselines_updated" = 2
    And "pending_markers_created" = 1

  # =========================================================================
  # pending_marker_cleared
  # =========================================================================

  Scenario: pending_marker_cleared is emitted when haiku_baseline_clear_marker clears a marker
    Given a PendingMarker exists for "stages/design/artifacts/hero-layout.html"
    When haiku_baseline_clear_marker fires with trigger "feedback-closed"
    Then a "pending_marker_cleared" event is appended to the log

  Scenario: pending_marker_cleared event contains required fields
    When a marker is cleared
    Then the event contains:
      | field                       | type    | present |
      | event_type                  | string  | yes     |
      | event_at                    | RFC3339 | yes     |
      | intent_slug                 | string  | yes     |
      | path                        | string  | yes     |
      | assessment_id               | string  | yes     |
      | trigger                     | enum    | yes     |
      | linked_feedback_id          | string  | yes     |
      | linked_revisit_target_stage | string  | yes     |

  Scenario: pending_marker_cleared event_type is always the literal "pending_marker_cleared"
    When a marker is cleared
    Then "event_type" = "pending_marker_cleared"

  Scenario Outline: trigger field uses only canonical values
    Given a marker is cleared due to "<reason>"
    When the pending_marker_cleared event is emitted
    Then "trigger" = "<value>"
    Examples:
      | reason                               | value                |
      | feedback formally closed             | feedback-closed      |
      | feedback rejected as invalid         | feedback-rejected    |
      | revisit cycle completed              | revisit-complete     |

  Scenario: feedback transition to addressed does NOT emit pending_marker_cleared
    # Per unit-01 AC-G5/AC-SF3 + DATA-CONTRACTS.md §4.4 R5: only terminal feedback states
    # (closed, rejected) and revisit-complete clear the marker. Addressed feedback can be
    # reopened, so it is not a safe clearance signal.
    Given a PendingMarker exists for "stages/design/artifacts/hero-layout.html"
    And the linked feedback "FB-12" transitions to "addressed" status
    When the workflow processes the addressed transition
    Then haiku_baseline_clear_marker is NOT invoked
    And no "pending_marker_cleared" event is appended to the log
    And the PendingMarker remains open with "cleared_at" = null

  Scenario: pending_marker_cleared is not emitted when no open marker exists
    Given no open PendingMarker exists for the given path
    When haiku_baseline_clear_marker returns "no_open_marker"
    Then no "pending_marker_cleared" event is written to the log

  # =========================================================================
  # Cross-event consistency
  # =========================================================================

  Scenario: Event sequence for a complete surface-as-feedback cycle
    Given a human has edited "stages/design/artifacts/hero-layout.html"
    When the next tick runs
    Then "drift_detected" event is emitted with "file_path" = that file
    When the agent classifies as "surface-as-feedback"
    Then "assessment_recorded" event is emitted with "surface-as-feedback" in outcomes_count
    When feedback "FB-12" transitions to "closed"
    Then "pending_marker_cleared" event is emitted with "trigger" = "feedback-closed"
    And the sequence is: drift_detected → assessment_recorded → pending_marker_cleared

  Scenario: Events are never modified after writing
    Given "drift_detected" and "assessment_recorded" events have been written
    When the workflow engine attempts to update an event's field
    Then the event log remains unchanged (append-only guarantee)
