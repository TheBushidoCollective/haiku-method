Feature: Drift assessment visibility in the SPA and chat surface
  As a Human collaborator (Designer, Product Owner, Reviewer)
  I want to see what files changed out-of-band, what the Agent classified each change as, and the rationale
  So that I can trust the framework with my work product and verify how my edits were handled

  Background:
    Given an active intent "demo-intent" is loaded in the browse SPA
    And the SPA's "Drift assessments" view exists for the intent
    And ManualChangeAssessment records are written at "stages/{stage}/drift-assessments/DA-NN.json"
    And assessment records survive session restarts and worktree branch switches
  # ---------------------------------------------------------------------------
  # Happy Path: SPA drift assessment view
  # ---------------------------------------------------------------------------

  Scenario: Drift assessment view lists recent assessments most-recent-first
    Given three ManualChangeAssessment records exist with created_at timestamps t1 < t2 < t3
    When the User opens the "Drift assessments" view
    Then the records are listed in order: t3, t2, t1
    And each row shows: file path(s), change_kind, outcome, created_at, rationale excerpt
    And clicking a row reveals the full diff_unified and full agent_rationale

  Scenario: Pending drift badge appears on the affected artifact card before classification
    Given drift is detected on "stages/design/artifacts/dashboard-layout.html"
    And the Agent has not yet classified the change (assessment-pending state)
    When the User opens the "Outputs" section of stage "design"
    Then the artifact card for "dashboard-layout.html" shows the drift-detected state badge
    When the Agent classifies the change with outcome "ignore"
    Then the drift-detected badge is replaced with the outcome badge (e.g., "Acknowledged")
    When the Agent classifies a different file with outcome "surface-as-feedback" producing "FB-07"
    Then the outcome badge shows "Surfaced as FB-07"

  Scenario: Outcome badge for surface-as-feedback links to the underlying feedback item
    Given a ManualChangeAssessment with outcome "surface-as-feedback" exists linked to "FB-07"
    When the User clicks the "Surfaced as FB-07" badge
    Then the SPA navigates to the feedback detail view for "FB-07"
  # ---------------------------------------------------------------------------
  # Pending-revisit transition state (Reconciliation requirement 6)
  # ---------------------------------------------------------------------------

  # SPA state: "pending-revisit" = Assessment.outcome === "trigger-revisit" AND PendingMarker.cleared_at == null
  # (DATA-CONTRACTS.md §2.2 — cleared_at is null while the revisit has not yet been invoked)
  # SPA state: "revisit-invoked" = haiku_revisit has been called; PendingMarker.cleared_at still null
  # (DATA-CONTRACTS.md §2.3 — transition occurs when the next tick fires and haiku_revisit is invoked)
  # Transition chain: pending-revisit → revisit-invoked → resolved
  Scenario: SPA shows pending-revisit state between trigger-revisit classification and actual revisit invocation
    Given the Agent classified "stages/inception/artifacts/DISCOVERY.md" as "trigger-revisit" targeting stage "inception"
    And the ManualChangeAssessment record has outcome "trigger-revisit" and a pending-assessment marker is written
    And haiku_revisit has NOT yet been invoked on the next tick
    When the User opens the "Drift assessments" view
    Then the assessment row for "stages/inception/artifacts/DISCOVERY.md" shows a "pending-revisit" state indicator
    And the SPA does not show the assessment as complete or resolved
    And the artifact card for "stages/inception/artifacts/DISCOVERY.md" shows the drift-revisit state badge (pending)
    When the next tick fires and haiku_revisit is invoked targeting stage "inception"
    Then the SPA transitions the assessment row from "pending-revisit" to "revisit-invoked"
    And the pending-assessment marker for "stages/inception/artifacts/DISCOVERY.md" remains open until the revisit completes

  # SPA state: "resolved" = PendingMarker.cleared_at != null (DATA-CONTRACTS.md §2.2 — once non-null
  # the marker is logically resolved; set when the linked downstream action resolves)
  Scenario: SPA resolves pending-revisit state when the revisited stage re-passes its gate
    Given a pending-assessment marker exists for "stages/inception/artifacts/DISCOVERY.md" linked to a revisit of stage "inception"
    When the revisited stage "inception" re-passes its review gate (revisit completes)
    Then the pending-assessment marker for "stages/inception/artifacts/DISCOVERY.md" is cleared
    And the baseline SHA for "stages/inception/artifacts/DISCOVERY.md" updates to the file's current SHA at clearing time
    And the SPA assessment row transitions from "revisit-invoked" to "resolved"
  # ---------------------------------------------------------------------------
  # Chat surface notifications in autopilot
  # ---------------------------------------------------------------------------

  Scenario: Agent surfaces the classification result in chat after an autopilot tick
    Given the intent is in mode "autopilot"
    And drift was detected on one file and classified as "inline-fix"
    When the next Agent message renders in chat
    Then the message states: which file changed, what outcome was decided ("inline-fix"), and the rationale excerpt
    And the message links to the SPA drift assessment view for full context

  Scenario: Agent acknowledges human-attributed write in chat after successful haiku_human_write
    When the Agent successfully invokes "haiku_human_write" for "knowledge/brand-guide.md"
    Then the next agent message in chat states: "Saved knowledge/brand-guide.md as a human-attributed file in stage inception"
    And the message includes a one-line note that the next tick will classify the change
  # ---------------------------------------------------------------------------
  # Noise control for many-ignore runs
  # ---------------------------------------------------------------------------

  Scenario: Large tick classification is summarized in chat not listed individually
    Given a single tick produced 12 ManualChangeAssessment classifications across 12 files
    When the next Agent message renders in chat
    Then the message summarizes "12 changes detected" with a breakdown by outcome (e.g., "9 ignored, 2 inline-fix, 1 surface-as-feedback")
    And the message includes a deep link to the SPA drift assessment view filtered to this tick
    And no individual file diff is inlined into the chat message

  Scenario: Successive ignore-only ticks are summarized without per-file detail in chat
    Given the previous three ticks each classified one file as "ignore"
    When the most recent Agent message renders in chat
    Then ignore-only classifications are summarized on a single line (e.g., "3 minor changes ignored across 3 ticks")
    And no per-file rationale is inlined in the summary
  # ---------------------------------------------------------------------------
  # Error scenarios
  # ---------------------------------------------------------------------------

  Scenario: Drift assessment view shows empty state when no assessments exist
    Given no ManualChangeAssessment records exist for the intent
    When the User opens the "Drift assessments" view
    Then the view shows an empty state message indicating no out-of-band changes have been detected
    And the view does not error

  Scenario: Drift assessment view degrades gracefully on a corrupted record
    Given one DA-NN.json record file contains invalid JSON
    When the User opens the "Drift assessments" view
    Then the corrupted entry is shown with a "Record could not be parsed" warning
    And the remaining assessment entries render normally
    And the view logs a recoverable error to the SPA console
  # ---------------------------------------------------------------------------
  # Outcome badge per classification outcome
  # ---------------------------------------------------------------------------

  Scenario Outline: Outcome badge text matches the classification outcome
    Given a ManualChangeAssessment record exists with outcome "<outcome>" for "stages/design/artifacts/output.html"
    When the User views the artifact card for "stages/design/artifacts/output.html"
    Then the outcome badge text is "<badge_text>"

    Examples:
      # Note: badge_text is UI copy and may diverge from the enum value if a future design decision
      # requires user-friendlier wording — the state machine enum is the source of truth, not the label.
      | outcome             | badge_text        |
      | ignore              | Acknowledged      |
      | inline-fix          | Acknowledged      |
      | surface-as-feedback | Surfaced as FB-NN |
      | trigger-revisit     | Revisit invoked   |
