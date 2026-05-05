Feature: PendingMarker schema and lifecycle
  A PendingMarker is written when the agent classifies a drift finding with a non-terminal
  outcome (surface-as-feedback or trigger-revisit). It suppresses re-detection of the same
  drift event on subsequent ticks until the downstream action resolves.

  Background:
    Given an active intent "out-of-band-human-file-modifications"
    And the drift-detection gate has emitted a finding for "stages/design/artifacts/hero-layout.html"

  # --- Schema completeness ---

  Scenario: PendingMarker contains all required fields
    Given the agent classifies the finding as "surface-as-feedback"
    When haiku_classify_drift submits the classification
    Then a PendingMarker exists for "stages/design/artifacts/hero-layout.html" with fields:
      | field                        | type              | present |
      | path                         | string            | yes     |
      | created_at                   | RFC3339           | yes     |
      | created_by_assessment_id     | string            | yes     |
      | outcome                      | enum              | yes     |
      | linked_feedback_id           | string or null    | yes     |
      | linked_revisit_target_stage  | string or null    | yes     |
      | cleared_at                   | RFC3339 or null   | yes     |
      | resolved_sha                 | string or null    | yes     |

  # --- Outcome constraint ---

  Scenario: PendingMarker is only written for non-terminal outcomes
    Given the agent classifies a finding as "ignore"
    When haiku_classify_drift submits the classification
    Then no PendingMarker is written for the affected file

  Scenario: PendingMarker is only written for non-terminal outcomes (inline-fix)
    Given the agent classifies a finding as "inline-fix"
    When haiku_classify_drift submits the classification
    Then no PendingMarker is written for the affected file

  Scenario Outline: PendingMarker is written for each non-terminal outcome
    Given the agent classifies a finding as "<outcome>"
    When haiku_classify_drift submits the classification
    Then a PendingMarker is written with "outcome" = "<outcome>"
    Examples:
      | outcome              |
      | surface-as-feedback  |
      | trigger-revisit      |

  # --- Mutual exclusion between linked_feedback_id and linked_revisit_target_stage ---

  Scenario: surface-as-feedback marker has linked_feedback_id set and linked_revisit_target_stage null
    Given the agent classifies a finding as "surface-as-feedback" and links feedback "FB-12"
    When haiku_classify_drift submits the classification
    Then the PendingMarker has "linked_feedback_id" = "FB-12"
    And the PendingMarker has "linked_revisit_target_stage" = null

  Scenario: trigger-revisit marker has linked_revisit_target_stage set and linked_feedback_id null
    Given the agent classifies a finding as "trigger-revisit" targeting stage "design"
    When haiku_classify_drift submits the classification
    Then the PendingMarker has "linked_revisit_target_stage" = "design"
    And the PendingMarker has "linked_feedback_id" = null

  Scenario: A marker write with both linked fields set is rejected
    Given a classification with "outcome" = "surface-as-feedback"
    And "linked_feedback_id" = "FB-12" and "linked_revisit_target_stage" = "design" are both provided
    When haiku_classify_drift submits the classification
    Then the tool returns error "illegal_outcome" or a validation error indicating mutual exclusion

  # --- Suppression behavior ---

  Scenario: An open PendingMarker suppresses re-detection of the same drift on the next tick
    Given a PendingMarker exists for "stages/design/artifacts/hero-layout.html" with "cleared_at" = null
    And the file's on-disk SHA still differs from the baseline
    When the drift-detection gate runs on the next tick
    Then no drift event is emitted for "stages/design/artifacts/hero-layout.html"

  Scenario: A cleared PendingMarker does not suppress re-detection
    Given a PendingMarker exists for "stages/design/artifacts/hero-layout.html" with "cleared_at" set to a timestamp
    And the file's on-disk SHA differs from the now-updated baseline
    When the drift-detection gate runs on the next tick
    Then a drift event is emitted for "stages/design/artifacts/hero-layout.html"

  # --- Clearance lifecycle ---

  Scenario: PendingMarker is cleared when linked feedback transitions to closed
    Given a PendingMarker exists for "stages/design/artifacts/hero-layout.html" with "outcome" = "surface-as-feedback"
    And the linked feedback "FB-12" transitions to "closed" status
    When haiku_baseline_clear_marker is invoked with trigger "feedback-closed"
    Then the PendingMarker's "cleared_at" is set to the current UTC timestamp
    And the Baseline entry for the file is updated to the current on-disk SHA

  Scenario: PendingMarker is cleared when linked feedback transitions to rejected
    Given a PendingMarker exists for "stages/design/artifacts/hero-layout.html" with "outcome" = "surface-as-feedback"
    And the linked feedback "FB-12" transitions to "rejected" status
    When haiku_baseline_clear_marker is invoked with trigger "feedback-rejected"
    Then the PendingMarker's "cleared_at" is set to the current UTC timestamp
    And the Baseline entry for the file is updated to the current on-disk SHA

  Scenario: PendingMarker is NOT cleared when linked feedback transitions to addressed
    # Rationale: `addressed` is a mid-state that can be reopened. Only terminal states
    # provide the immutability guarantee required to safely update the baseline (AC-G5, AC-SF3).
    # `"feedback-addressed"` is not a valid trigger for haiku_baseline_clear_marker.
    Given a PendingMarker exists for "stages/design/artifacts/hero-layout.html" with "outcome" = "surface-as-feedback"
    And the linked feedback "FB-12" transitions to "addressed" status
    Then haiku_baseline_clear_marker is NOT invoked
    And the PendingMarker's "cleared_at" remains null
    And the Baseline entry for the file is unchanged

  Scenario: PendingMarker is cleared when linked revisit completes
    Given a PendingMarker exists for a file with "outcome" = "trigger-revisit"
    And the revisit targeting stage "design" completes
    When haiku_baseline_clear_marker is invoked with trigger "revisit-complete"
    Then the PendingMarker's "cleared_at" is set to the current UTC timestamp
    And the Baseline entry for the file is updated to the current on-disk SHA

  Scenario: haiku_baseline_clear_marker returns no_open_marker when no open marker exists
    Given no open PendingMarker exists for "stages/design/artifacts/hero-layout.html"
    When haiku_baseline_clear_marker is invoked for that path
    Then the response is:
      | field          | value           |
      | ok             | true            |
      | marker_cleared | false           |
      | reason         | no_open_marker  |

  # --- resolved_sha lifecycle ---

  Scenario: PendingMarker.resolved_sha is null while the marker is open
    Given a PendingMarker was just written for "stages/design/artifacts/hero-layout.html"
    When the marker's current state is read
    Then "resolved_sha" = null
    And "cleared_at" = null

  Scenario: PendingMarker.resolved_sha is populated atomically at clearance time
    Given a PendingMarker exists for "stages/design/artifacts/hero-layout.html" with "resolved_sha" = null
    And the current on-disk SHA of the file is "cd34ef56..."
    When haiku_baseline_clear_marker fires with any valid trigger
    Then "resolved_sha" = "cd34ef56..."
    And "cleared_at" is set to the current UTC timestamp in the same atomic write
    And the Baseline entry's SHA equals "cd34ef56..."

  Scenario: PendingMarker.resolved_sha is never mutated after clearance
    Given a PendingMarker has been cleared with "resolved_sha" = "cd34ef56..."
    When any process attempts to update "resolved_sha" to a different value
    Then the write is rejected or ignored (the record is logically frozen after clearance)

  Scenario: PendingMarker.cleared_at and PendingMarker.resolved_sha are set together exactly once
    Given a PendingMarker exists with "cleared_at" = null and "resolved_sha" = null
    When haiku_baseline_clear_marker fires
    Then exactly one write sets both "cleared_at" and "resolved_sha" in a single atomic operation
    And no subsequent writes touch either field
