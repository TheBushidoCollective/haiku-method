Feature: DriftFinding shape and manual_change_assessment action
  The drift-detection gate emits a DriftFinding per diverging file. These findings are bundled
  into the manual_change_assessment workflow action payload for the agent to classify.

  Background:
    Given an active intent "out-of-band-human-file-modifications"
    And the drift-detection gate has run and found divergences

  # --- change_kind enum cross-field invariants ---

  Scenario: "added" finding has null before fields
    Given a file "knowledge/new-research.md" appears on disk with no baseline entry
    When the drift-detection gate emits a finding
    Then the DriftFinding has:
      | field          | value    |
      | change_kind    | added    |
      | before_sha256  | null     |
      | before_bytes   | null     |

  Scenario: "deleted" finding has null after fields and null diff_unified
    Given a file "stages/design/artifacts/hero-layout.html" exists in the baseline but not on disk
    When the drift-detection gate emits a finding
    Then the DriftFinding has:
      | field          | value   |
      | change_kind    | deleted |
      | after_sha256   | null    |
      | after_bytes    | null    |
      | diff_unified   | null    |

  Scenario: "modified" finding has all SHA and byte fields non-null and SHAs differ
    Given a file has been modified so its on-disk SHA differs from the baseline SHA
    When the drift-detection gate emits a finding
    Then the DriftFinding has:
      | field          | non-null |
      | change_kind    | modified |
      | before_sha256  | yes      |
      | after_sha256   | yes      |
      | before_bytes   | yes      |
      | after_bytes    | yes      |
    And before_sha256 != after_sha256

  Scenario: Binary finding has null diff_unified regardless of change_kind
    Given a file "stages/design/artifacts/hero.png" is a binary file (PNG)
    And its on-disk SHA differs from the baseline
    When the drift-detection gate emits a finding
    Then the DriftFinding has "is_binary" = true
    And the DriftFinding has "diff_unified" = null

  # --- change_kind enum — only canonical values ---

  Scenario Outline: Gate only emits canonical change_kind values
    Given the on-disk state triggers a drift event of type "<canonical>"
    When the finding is emitted
    Then "change_kind" equals "<canonical>"
    Examples:
      | canonical |
      | added     |
      | modified  |
      | deleted   |

  # --- manual_change_assessment action shape ---

  Scenario: manual_change_assessment action contains required top-level fields
    Given the drift gate emits findings for the active stage
    When haiku_run_next returns the manual_change_assessment action
    Then the action payload includes:
      | field         | present |
      | action        | yes     |
      | intent_slug   | yes     |
      | stage         | yes     |
      | tick_id       | yes     |
      | findings      | yes     |
      | mode          | yes     |
      | instructions  | yes     |
      | legal_outcomes| yes     |

  Scenario: action field is always the literal "manual_change_assessment"
    Given haiku_run_next returns a drift-classification response
    When the "action" field is read
    Then it equals exactly "manual_change_assessment"

  Scenario: legal_outcomes is pre-filtered using the legality matrix
    Given a finding with "change_kind" = "deleted"
    When the manual_change_assessment action is dispatched
    Then "legal_outcomes" for that finding does NOT contain "inline-fix"
    And "legal_outcomes" for that finding contains "ignore", "surface-as-feedback", and "trigger-revisit"

  Scenario: legal_outcomes for "added" findings contains all four outcomes
    Given a finding with "change_kind" = "added"
    When the manual_change_assessment action is dispatched
    Then "legal_outcomes" for that finding contains all of:
      | outcome              |
      | ignore               |
      | inline-fix           |
      | surface-as-feedback  |
      | trigger-revisit      |

  Scenario: legal_outcomes for "modified" findings contains all four outcomes
    Given a finding with "change_kind" = "modified"
    When the manual_change_assessment action is dispatched
    Then "legal_outcomes" for that finding contains all four outcome values

  # --- Gate ordering ---

  Scenario: Drift-detection gate runs after feedback-triage gate
    Given both untriaged feedback AND drift findings exist on the same tick
    When haiku_run_next is called
    Then the feedback_triage action is returned before manual_change_assessment
    And the drift gate still runs on the same tick after feedback triage completes

  Scenario: Drift gate does not run if tamper-detection fires
    Given the tamper-detection gate fires on a tick
    When haiku_run_next processes that tick
    Then manual_change_assessment is never dispatched on that tick
    And the tick halts after tamper-detection

  # --- Classification submission ---

  Scenario: Submitting inline-fix for a deleted finding is rejected
    Given a finding with "change_kind" = "deleted"
    When the agent submits a classification with "outcome" = "inline-fix"
    Then haiku_classify_drift returns error "illegal_outcome"

  Scenario: Classification path must match a finding path from the same dispatch
    Given a dispatch with finding for path "stages/design/artifacts/hero-layout.html"
    When the agent submits a classification with path "stages/design/artifacts/some-other.html"
    Then haiku_classify_drift returns error "path_unknown"

  Scenario: Stale tick_id is rejected
    Given the drift gate has re-fired and issued a new tick_id
    When the agent submits classifications with the old tick_id
    Then haiku_classify_drift returns error "tick_id_stale"
