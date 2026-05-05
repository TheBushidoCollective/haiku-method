Feature: Manual change assessment classification by the agent
  As the Workflow Engine
  I need the Agent to classify each detected out-of-band change into one of four canonical outcomes
  So that human edits are routed to the right downstream behavior without harness-driven heuristics

  Background:
    Given an active intent "demo-intent" with stage "design"
    And a tracked surface baseline exists for stage "design"
    And the drift-detection gate has detected drift on one or more tracked files
    And the workflow has emitted a "manual_change_assessment" action with the drift findings payload
    And the four valid classification outcomes are: "ignore", "inline-fix", "surface-as-feedback", "trigger-revisit"
  # ---------------------------------------------------------------------------
  # Four canonical outcomes: one scenario each
  # ---------------------------------------------------------------------------

  Scenario: Agent classifies a typo correction as ignore
    Given the DriftFinding has change_kind "modified" for "stages/design/artifacts/spec.md"
    And the DriftFinding shows a single-character change in a sentence (punctuation only)
    And the file is owned by the active stage "design"
    When the Agent classifies the change with outcome "ignore" and a one-line rationale
    Then the ManualChangeAssessment record is persisted with outcome "ignore"
    And the baseline entry for "stages/design/artifacts/spec.md" is updated immediately to the current SHA
    And no feedback item is created
    And no pending-assessment marker is written
    And on the next tick the drift-detection gate emits no DriftFinding for "stages/design/artifacts/spec.md"

  Scenario: Agent classifies a meaningful edit as inline-fix
    Given the DriftFinding has change_kind "modified" for "stages/design/artifacts/spec.md"
    And the DriftFinding shows a Product Owner adding two new acceptance criteria lines
    And the User asked the Agent to "extend this"
    When the Agent classifies the change with outcome "inline-fix" and a rationale naming the absorbed content
    Then the ManualChangeAssessment record is persisted with outcome "inline-fix"
    And the baseline entry for "stages/design/artifacts/spec.md" is updated immediately to the current SHA
    And the Agent continues the current bolt with the human's edit as the new starting state
    And no feedback item is created
    And no pending-assessment marker is written

  Scenario: Agent classifies an out-of-spec change as surface-as-feedback
    # Per DATA-CONTRACTS.md §3.5 (R6 contract) and §0.3: surface-as-feedback defers
    # the baseline update — the baseline is NOT changed at classification time. The
    # PendingMarker is the sole re-detection suppression mechanism while the linked
    # feedback is open; the baseline is updated only when the marker clears
    # (haiku_baseline_clear_marker on terminal feedback status — closed or rejected).
    Given the DriftFinding has change_kind "modified" for "stages/design/artifacts/dashboard-layout.html"
    And the DriftFinding shows a designer replacing a layout that contradicts an active acceptance criterion
    When the Agent classifies the change with outcome "surface-as-feedback"
    And the Agent supplies linked_feedback_id referencing a newly created feedback item "FB-09"
    Then the ManualChangeAssessment record is persisted with outcome "surface-as-feedback" and linked_feedback_id "FB-09"
    And a pending-assessment marker is written for "stages/design/artifacts/dashboard-layout.html" linked to "FB-09"
    And the PendingMarker and ManualChangeAssessment record are written in the same atomic transaction
    And the baseline SHA for "stages/design/artifacts/dashboard-layout.html" is NOT updated at classification time
    And the deferred baseline update will occur when the pending-assessment marker clears (via haiku_baseline_clear_marker)
    And the drift-detection gate suppresses re-detection of "stages/design/artifacts/dashboard-layout.html" while the marker is open

  # ---------------------------------------------------------------------------
  # Clearance trigger contract (DATA-CONTRACTS.md §4.4 + unit-01 AC-G5/AC-SF3):
  # only terminal feedback states clear the PendingMarker. `addressed` does NOT.
  # ---------------------------------------------------------------------------

  Scenario Outline: surface-as-feedback baseline is updated when feedback reaches a terminal state
    Given a pending-assessment marker exists for "stages/design/artifacts/dashboard-layout.html" linked to "FB-09"
    And "FB-09" has status "open"
    When "FB-09" transitions to status "<terminal_status>"
    Then haiku_baseline_clear_marker fires with trigger "feedback-<terminal_status>"
    And the pending-assessment marker for "stages/design/artifacts/dashboard-layout.html" is cleared
    And the baseline SHA for "stages/design/artifacts/dashboard-layout.html" updates to the file's current SHA at clearing time
    And on the next tick the drift-detection gate does not emit a DriftFinding for "stages/design/artifacts/dashboard-layout.html"

    Examples:
      | terminal_status |
      | closed          |
      | rejected        |

  Scenario: feedback transitioning to addressed does NOT clear the pending-assessment marker
    # Rationale: `addressed` is a mid-state that can be reopened; only terminal states
    # guarantee the immutability required to safely update the baseline (AC-G5, AC-SF3).
    Given a pending-assessment marker exists for "stages/design/artifacts/dashboard-layout.html" linked to "FB-09"
    And "FB-09" has status "open"
    When "FB-09" transitions to status "addressed"
    Then haiku_baseline_clear_marker is NOT called
    And the pending-assessment marker for "stages/design/artifacts/dashboard-layout.html" remains open (cleared_at is null)
    And the baseline SHA for "stages/design/artifacts/dashboard-layout.html" is unchanged


  Scenario: Agent classifies a fundamental redirect as trigger-revisit
    Given the DriftFinding has change_kind "modified" for "stages/inception/artifacts/DISCOVERY.md"
    And the DriftFinding shows the User replacing the entire problem statement
    And the active stage is "design" (downstream of "inception")
    When the Agent classifies the change with outcome "trigger-revisit" and linked_revisit_target_stage "inception"
    Then the ManualChangeAssessment record is persisted with outcome "trigger-revisit" and linked_revisit_target_stage "inception"
    And a pending-assessment marker is written for "stages/inception/artifacts/DISCOVERY.md" linked to revisit of stage "inception"
    And the baseline SHA for "stages/inception/artifacts/DISCOVERY.md" is NOT updated at classification time
    And the workflow invokes haiku_revisit targeting stage "inception"
  # ---------------------------------------------------------------------------
  # Outcome legality matrix: change_kind "deleted" cannot be inline-fix
  # ---------------------------------------------------------------------------

  Scenario Outline: Classification outcome legality varies by change_kind
    Given the DriftFinding has change_kind "<change_kind>" for "stages/design/artifacts/output.html"
    When the Agent attempts to classify the change with outcome "<outcome>"
    Then the classification is "<result>"

    Examples:
      | change_kind | outcome             | result   |
      | added       | ignore              | accepted |
      | added       | inline-fix          | accepted |
      | added       | surface-as-feedback | accepted |
      | added       | trigger-revisit     | accepted |
      | modified    | ignore              | accepted |
      | modified    | inline-fix          | accepted |
      | modified    | surface-as-feedback | accepted |
      | modified    | trigger-revisit     | accepted |
      | deleted     | ignore              | accepted |
      | deleted     | inline-fix          | rejected |
      | deleted     | surface-as-feedback | accepted |
      | deleted     | trigger-revisit     | accepted |
  # ---------------------------------------------------------------------------
  # Cross-stage cascade decision
  # ---------------------------------------------------------------------------

  Scenario: Cross-stage drift does not auto-revisit — the Agent decides
    Given a DriftFinding with change_kind "modified" for "stages/design/artifacts/spec.md"
    And the DriftFinding has stage_owner "design"
    And the active stage is "development" (downstream of "design")
    When the workflow emits "manual_change_assessment"
    Then the Workflow Engine does NOT automatically invoke haiku_revisit
    And the action payload's legal_outcomes for "stages/design/artifacts/spec.md" includes all four outcomes
    When the Agent classifies with outcome "trigger-revisit" and linked_revisit_target_stage "design"
    Then haiku_revisit is invoked targeting stage "design"
    And no haiku_revisit call occurs when the Agent classifies with outcome "surface-as-feedback" instead
  # ---------------------------------------------------------------------------
  # Idempotency loop avoidance
  # ---------------------------------------------------------------------------

  Scenario: File classified as ignore does not re-fire on the next tick
    Given a file "stages/design/artifacts/notes.md" was classified as "ignore" in the previous assessment
    And the baseline was updated to the post-edit SHA at classification time
    And the file has not changed since the classification
    When the Agent calls haiku_run_next
    Then the drift-detection gate sees "stages/design/artifacts/notes.md" matches the baseline
    And no "manual_change_assessment" fires for "stages/design/artifacts/notes.md"

  Scenario: Re-edited file after ignore classification fires a fresh assessment
    Given "stages/design/artifacts/notes.md" was classified as "ignore" and its baseline updated
    When the User edits "stages/design/artifacts/notes.md" again with new content
    And the Agent calls haiku_run_next
    Then the drift-detection gate detects the new SHA mismatch
    And the workflow emits a fresh "manual_change_assessment" action for "stages/design/artifacts/notes.md"
  # ---------------------------------------------------------------------------
  # Binary diff degraded mode
  # ---------------------------------------------------------------------------

  Scenario: Binary file drift is classified with degraded payload (no textual diff)
    Given a DriftFinding with change_kind "modified" for "stages/design/artifacts/mockup.png"
    And the DriftFinding has is_binary true and diff_unified null
    And the DriftFinding includes before_sha256 and after_sha256
    When the workflow emits "manual_change_assessment"
    Then the action payload for "stages/design/artifacts/mockup.png" has diff_unified null
    And the action payload includes is_binary true, before_sha256, after_sha256, before_bytes, and after_bytes
    And the Agent's default classification outcome for binary files without stage context is "surface-as-feedback"
    And the Agent's rationale notes that no textual diff is available
  # ---------------------------------------------------------------------------
  # Same-tick atomic batch (AC-G12)
  # ---------------------------------------------------------------------------
  # Per AC-G12 and DATA-CONTRACTS.md §3.2/§4.3, all drift findings observed in a
  # single tick are dispatched in one `manual_change_assessment` action payload
  # and classified in one atomic `haiku_classify_drift` call (all-or-rollback).
  # No multi-tick pagination cursor or batch-session protocol is defined at the
  # product stage — payload size limits and any future windowing protocol are a
  # development/architecture concern (see DATA-CONTRACTS.md §8 boundary notes).

  Scenario: Large drift batch is dispatched in a single atomic action payload
    Given drift is detected on 60 tracked files in a single tick
    When the workflow emits "manual_change_assessment"
    Then the action payload findings array contains all 60 DriftFindings
    And the action payload exposes no pagination cursor, batch_id, page, or has_more field
    And the Agent submits one haiku_classify_drift call with 60 parallel-indexed classifications
    And all 60 classifications are committed atomically (all-or-rollback) per DATA-CONTRACTS.md §4.3
    And no second "manual_change_assessment" is emitted for any subset of the same tick's findings
  # ---------------------------------------------------------------------------
  # Assessment record durability
  # ---------------------------------------------------------------------------

  Scenario: ManualChangeAssessment record is durable and human-readable
    When the Agent records any classification outcome
    Then the ManualChangeAssessment record is persisted at "stages/design/drift-assessments/DA-NN.json"
    And the record contains: id, created_at, tick_id, findings array, classifications array, agent_rationale, mode
    And the record survives a session restart
    And the record survives a worktree branch switch

  Scenario: Each DriftFinding is classified individually within one assessment dispatch
    Given three DriftFindings exist in one "manual_change_assessment" dispatch
    When the Agent processes the action
    Then the Agent records one Classification per DriftFinding (parallel-indexed)
    And the outcomes may differ across findings (e.g., "ignore", "inline-fix", "surface-as-feedback")
    And each outcome produces exactly its own downstream side effects with no cross-finding interference
  # ---------------------------------------------------------------------------
  # Error scenarios
  # ---------------------------------------------------------------------------

  Scenario: Agent attempts an invalid classification outcome alias
    When the Agent attempts to classify a change with outcome "auto-fix"
    Then the Workflow Engine rejects the classification with an error listing the four valid outcomes
    And no ManualChangeAssessment record is persisted
    And the workflow remains in assessment-pending state
    And the next tick re-emits the same "manual_change_assessment" action

  Scenario: Agent attempts an invalid classification outcome alias (escalate)
    When the Agent attempts to classify a change with outcome "escalate"
    Then the Workflow Engine rejects the classification with an error listing the four valid outcomes
    And no ManualChangeAssessment record is persisted

  Scenario: Agent omits rationale on a non-ignore outcome
    When the Agent classifies a change as "trigger-revisit" with an empty rationale_excerpt
    Then the Workflow Engine rejects the classification with an error requiring non-empty rationale
    And no revisit is invoked
