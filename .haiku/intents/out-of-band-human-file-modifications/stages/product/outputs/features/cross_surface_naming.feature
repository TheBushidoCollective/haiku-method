Feature: Cross-surface naming consistency
  Entity names must be identical across all five surfaces: disk state, action payloads,
  MCP tools, HTTP API, and events. Any deviation is a reconciliation failure. This feature
  verifies the naming audit table from DATA-CONTRACTS.md §7.

  Scenario: intent_slug is used identically across all surfaces except URL path segments
    Given an intent with slug "out-of-band-human-file-modifications"
    Then the following surfaces all use the field name "intent_slug":
      | surface                                  | context                  |
      | Baseline on-disk record                  | not present (path key)   |
      | Assessment on-disk record                | Assessment.intent_slug absent (implied by location) |
      | manual_change_assessment action payload  | "intent_slug" field      |
      | haiku_classify_drift request             | "intent_slug" field      |
      | haiku_baseline_init request              | "intent_slug" field      |
      | haiku_baseline_clear_marker request      | "intent_slug" field      |
      | HTTP URL path segment                    | "{intent-slug}" (kebab form of the slug) |
      | drift_detected event                     | "intent_slug" field      |
      | assessment_recorded event                | "intent_slug" field      |
      | pending_marker_cleared event             | "intent_slug" field      |

  Scenario: path field name is used for file paths across all surfaces (with one documented exception)
    Then the following surfaces all use the field name "path" for the tracked file path:
      | surface                                  | field name  |
      | Baseline on-disk key                     | path (map key) |
      | PendingMarker on-disk record             | path        |
      | DriftFinding in action payload           | path        |
      | Classification in haiku_classify_drift   | path        |
      | haiku_baseline_clear_marker request      | path        |
      | haiku_classify_drift response            | path        |
      | drift_detected event                     | file_path   |
      | pending_marker_cleared event             | path        |
    And the single intentional exception is:
      | surface                       | field name  | reason |
      | HTTP upload request body      | target_path | Stage-relative; full path computed via "stages/{stage}/{target_path}" |
      | HTTP upload response body     | path        | Intent-relative; consistent with all other surfaces |

  Scenario: change_kind enum values are identical across all surfaces that use them
    Given the canonical enum is "added", "modified", "deleted"
    Then the following surfaces all use exactly these values:
      | surface                      |
      | DriftFinding.change_kind     |
      | drift_detected event         |
    And no surface uses "created", "updated", "removed", or any other alias

  Scenario: author_class enum values are identical across all surfaces that carry them
    Given the canonical enum is "agent", "human-via-mcp", "human-implicit"
    Then the following surfaces all use exactly these values:
      | surface                              |
      | Baseline.author_class                |
      | DriftFinding.author_class            |
      | haiku_human_write response           |
      | drift_detected event.author_class    |
    And no surface uses "user", "external", "manual", or any other alias

  Scenario: outcome enum values are identical across all surfaces that carry them
    Given the canonical enum is "ignore", "inline-fix", "surface-as-feedback", "trigger-revisit"
    Then the following surfaces all use exactly these values:
      | surface                              |
      | Classification.outcome               |
      | Assessment classification records    |
      | PendingMarker.outcome                |
      | manual_change_assessment legal_outcomes values |
      | GET /assessments "outcome" query param |
      | assessment_recorded outcomes_count keys |
    And no surface uses "auto-fix", "escalate", or any other alias

  Scenario: Assessment ID format is AS-NN across all surfaces
    Given an assessment with ID "AS-07"
    Then the following surfaces all reference it as "AS-07":
      | surface                              | field                 |
      | Assessment on-disk record            | "id"                  |
      | haiku_classify_drift response        | "assessment_id"       |
      | GET /assessments/{id} URL segment    | "{assessment-id}"     |
      | GET /assessments list response       | "id" in each record   |
      | assessment_recorded event            | "assessment_id"       |
      | pending_marker_cleared event         | "assessment_id"       |
      | PendingMarker.created_by_assessment_id | "AS-07"             |

  Scenario: target_path to path conversion is applied on all HTTP upload endpoints
    Given a stage "design" and target_path "artifacts/hero-layout.html"
    When any upload endpoint responds with the canonical path
    Then the response body "path" field = "stages/design/artifacts/hero-layout.html"
    And this conversion rule (path = "stages/" + stage + "/" + target_path) applies to both
      | endpoint                              |
      | POST /uploads/stage-output            |
      | POST /uploads/knowledge (stage-scope) |
