Feature: MCP tool contracts
  Four new MCP tools are introduced by this intent. Their request/response/error shapes are
  fixed at the product stage and implemented verbatim by the development stage.

  # =========================================================================
  # haiku_human_write
  # =========================================================================

  Feature: haiku_human_write — agent writes on behalf of human

    Background:
      Given an active intent "out-of-band-human-file-modifications"
      And the user has given a chat instruction to write a file

    Scenario: Successful write to intent knowledge directory
      Given the agent calls haiku_human_write with:
        | path                   | knowledge/brand-guide.md                      |
        | content                | # Brand Guide\n...                            |
        | content_encoding       | utf-8                                         |
        | human_author_id        | jwaldrip@gigsmart.com                         |
        | rationale              | User asked to save their brand guide excerpt   |
      When the tool executes successfully
      Then the response includes:
        | field                | value            |
        | ok                   | true             |
        | author_class         | human-via-mcp    |
        | audit_log_appended   | true             |
      And the response "path" is the intent-relative canonical form
      And the response "sha" is the SHA-256 hex digest of the written content
      And an action-log entry is written with "author_class" = "human-via-mcp"
      And baseline.json is NOT updated by this call

    Scenario: Write to stage artifacts directory is permitted
      Given the agent calls haiku_human_write with "path" = "stages/design/artifacts/hero.html"
      When the tool executes
      Then the response "ok" = true
      And "author_class" = "human-via-mcp"

    Scenario: Write to a unit file is rejected
      Given the agent calls haiku_human_write with "path" = "stages/product/units/unit-01-spec.md"
      When the tool executes
      Then the response is:
        | field  | value                        |
        | ok     | false                        |
        | error  | path_outside_tracked_surface |
        | reason | deny_list_match              |

    Scenario: Write to intent.md is rejected
      Given the agent calls haiku_human_write with "path" = "intent.md"
      When the tool executes
      Then the response "error" = "path_outside_tracked_surface"
      And "reason" = "deny_list_match"

    Scenario: Write to baseline.json is rejected
      Given the agent calls haiku_human_write with "path" = "stages/design/baseline.json"
      When the tool executes
      Then the response "error" = "path_outside_tracked_surface"

    Scenario: Write to drift-markers.json is rejected
      Given the agent calls haiku_human_write with "path" = "drift-markers.json"
      When the tool executes
      Then the response "error" = "path_outside_tracked_surface"

    Scenario: Write to feedback file is rejected
      Given the agent calls haiku_human_write with "path" = "stages/design/feedback/FB-01.md"
      When the tool executes
      Then the response "error" = "path_outside_tracked_surface"
      And "reason" = "deny_list_match"

    Scenario: Path escaping the intent directory is rejected
      Given the agent calls haiku_human_write with "path" = "../other-intent/secret.md"
      When the tool executes
      Then the response "error" = "path_outside_tracked_surface"
      And "reason" = "path_escape"

    Scenario: overwrite: false fails when file already exists
      Given the file "knowledge/brand-guide.md" already exists on disk
      And the agent calls haiku_human_write with "overwrite" = false
      When the tool executes
      Then the response "error" = "path_already_exists"
      And the response includes the existing file's SHA in "existing_sha"

    Scenario: Invalid content_encoding is rejected
      Given the agent calls haiku_human_write with "content_encoding" = "gzip"
      When the tool executes
      Then the response "error" = "invalid_content_encoding"

    Scenario: Audit log entry is written with user_instruction_excerpt on success
      Given the agent calls haiku_human_write with a valid path and content
      When the tool executes successfully
      Then a record is appended to write-audit.jsonl containing:
        | field                   | present |
        | timestamp               | yes     |
        | entry_id                | yes     |
        | path                    | yes     |
        | sha                     | yes     |
        | author_class            | yes     |
        | human_author_id         | yes     |
        | rationale               | yes     |
        | user_instruction_excerpt| yes     |
        | tick_counter            | yes     |

    Scenario: Audit log entry is NOT written on error
      Given the agent calls haiku_human_write with an invalid (deny-listed) path
      When the tool executes and returns an error
      Then write-audit.jsonl is not modified

  # =========================================================================
  # haiku_baseline_init
  # =========================================================================

  Feature: haiku_baseline_init — bootstrap baseline on upgrade

    Background:
      Given an active intent with no baseline.json for any stage

    Scenario: establish-all mode baselines every tracked file
      Given the agent calls haiku_baseline_init with "mode" = "establish-all"
      When the tool executes
      Then the response includes:
        | field                      | present |
        | ok                         | yes     |
        | baselines_created          | yes     |
        | baselines_skipped_existing | yes     |
        | tracking_classes           | yes     |
        | drift_baseline_established_at | yes  |
      And no drift events are emitted during establishment

    Scenario: establish-paths mode only baselines the listed files
      Given the intent has 20 tracked files
      And the agent calls haiku_baseline_init with mode "establish-paths" and paths ["knowledge/brand-guide.md"]
      When the tool executes
      Then "baselines_created" = 1
      And the other 19 files are not in the baseline

    Scenario: establish-paths without paths field returns validation error
      Given the agent calls haiku_baseline_init with "mode" = "establish-paths" but no "paths" field
      When the tool executes
      Then the tool returns a validation error indicating "paths" is required for establish-paths mode

    Scenario: haiku_baseline_init with unknown intent returns intent_not_found
      Given the agent calls haiku_baseline_init with "intent_slug" = "nonexistent-intent"
      When the tool executes
      Then the response "error" = "intent_not_found"

    Scenario: haiku_baseline_init with archived intent returns intent_not_active
      Given the intent is archived
      When the agent calls haiku_baseline_init
      Then the response "error" = "intent_not_active"

    Scenario: haiku_baseline_init on intent with no tracked files returns warning
      Given the intent's tracked surface is empty
      When the agent calls haiku_baseline_init with "mode" = "establish-all"
      Then the response "ok" = true
      And the response includes a warning "tracked_surface_empty"

  # =========================================================================
  # haiku_classify_drift
  # =========================================================================

  Feature: haiku_classify_drift — submit classifications for a dispatch

    Background:
      Given a manual_change_assessment action has been dispatched with tick_id "tick-abc-123"
      And the findings list contains one finding for "stages/design/artifacts/hero-layout.html"

    Scenario: Successful classification with inline-fix outcome
      Given the agent calls haiku_classify_drift with:
        | intent_slug       | out-of-band-human-file-modifications |
        | tick_id           | tick-abc-123                         |
        | classifications   | [{ path: "...", outcome: "inline-fix", rationale_excerpt: "Designer updated nav" }] |
        | agent_rationale   | "The designer intentionally replaced the nav with a sidebar pattern." |
      When the tool executes
      Then the response includes:
        | field                  | present |
        | ok                     | yes     |
        | assessment_id          | yes     |
        | feedback_created       | yes     |
        | pending_markers_created| yes     |
        | baselines_updated      | yes     |
        | next_tick_will         | yes     |
      And "baselines_updated" = 1
      And "pending_markers_created" = 0

    Scenario: surface-as-feedback classification creates a feedback item and pending marker
      Given the agent classifies the finding as "surface-as-feedback" with no prior linked_feedback_id
      And "feedback_creates" contains one FeedbackCreateInline entry
      When haiku_classify_drift executes
      Then "feedback_created" contains the new "FB-NN" identifier
      And "pending_markers_created" = 1
      And "baselines_updated" = 0
      And a PendingMarker exists with "linked_feedback_id" = the new FB
      And the Baseline entry for the file is unchanged (still the pre-drift SHA)

    Scenario: surface-as-feedback does NOT update baseline at classification time
      # Per DATA-CONTRACTS.md §3.5 R6 contract and ARCHITECTURE.md §4.4.3:
      # the baseline is deferred until marker clearance.
      Given the agent classifies a finding as "surface-as-feedback"
      And the pre-drift Baseline SHA is "9f86d0..."
      And the on-disk SHA is "ab12cd..."
      When haiku_classify_drift executes
      Then the Baseline entry for the file still reads "9f86d0..." (unchanged)
      And a PendingMarker is written with "cleared_at" = null
      And the PendingMarker and Assessment record are written in the same atomic transaction
      And "baselines_updated" = 0
      And "pending_markers_created" = 1

    Scenario: open PendingMarker suppresses re-detection on subsequent ticks
      # The PendingMarker is the sole re-detection suppression mechanism for surface-as-feedback;
      # baseline divergence alone does NOT trigger re-detection while a marker is open.
      Given a PendingMarker exists for "stages/design/artifacts/hero-layout.html" with "cleared_at" = null
      And the file's on-disk SHA differs from the unchanged Baseline SHA
      When the drift-detection gate runs on the next tick
      Then no drift event is emitted for that path
      And no new Assessment is dispatched

    Scenario: baseline is updated to current on-disk SHA when marker clears
      # Per §4.4 — the deferred baseline update happens at marker-clearance time, not at classification.
      # The post-clearance SHA lands on PendingMarker.resolved_sha; Assessment.resulting_sha stays null.
      Given a PendingMarker exists for "stages/design/artifacts/hero-layout.html" with outcome "surface-as-feedback"
      And the linked feedback "FB-12" transitions to "closed"
      When haiku_baseline_clear_marker fires with trigger "feedback-closed"
      Then the PendingMarker's "cleared_at" is set to the current UTC timestamp
      And the PendingMarker's "resolved_sha" is set to the current on-disk SHA
      And the Baseline entry for the file is updated to the same current on-disk SHA
      And the Assessment record's "resulting_sha" remains null (Assessment is append-only and never modified)

    Scenario: trigger-revisit classification writes pending marker but does NOT update baseline
      Given the agent classifies the finding as "trigger-revisit" targeting stage "design"
      When haiku_classify_drift executes
      Then "pending_markers_created" = 1
      And "baselines_updated" = 0
      And the Baseline entry still contains the pre-drift SHA

    Scenario: Missing feedback link for surface-as-feedback returns error
      Given the agent classifies as "surface-as-feedback" with no linked_feedback_id and no feedback_creates entry
      When haiku_classify_drift executes
      Then the response "error" = "missing_link"
      And no Assessment is written

    Scenario: Classifications count mismatch returns error
      Given the dispatch has 3 findings
      And the agent submits only 2 classifications
      When haiku_classify_drift executes
      Then the response "error" = "classifications_count_mismatch"

    Scenario: Unknown path in classification returns error
      Given the agent submits a classification with "path" = "stages/design/artifacts/not-in-dispatch.html"
      When haiku_classify_drift executes
      Then the response "error" = "path_unknown"

    Scenario: revisit_target pointing to a future stage is rejected
      Given the intent is currently in stage "design" (index 2)
      And the agent classifies as "trigger-revisit" with "linked_revisit_target_stage" = "development" (index 3)
      When haiku_classify_drift executes
      Then the response "error" = "revisit_target_invalid"

  # =========================================================================
  # haiku_baseline_clear_marker
  # =========================================================================

  Feature: haiku_baseline_clear_marker — clear pending marker on downstream resolution

    Background:
      Given a PendingMarker exists for "stages/design/artifacts/hero-layout.html"
      And the marker has "cleared_at" = null

    Scenario: Clearing marker with feedback-closed trigger updates cleared_at and baseline
      Given the agent calls haiku_baseline_clear_marker with:
        | intent_slug | out-of-band-human-file-modifications    |
        | path        | stages/design/artifacts/hero-layout.html |
        | trigger     | feedback-closed                          |
      When the tool executes
      Then the response is:
        | field           | value                                    |
        | ok              | true                                     |
        | marker_cleared  | true                                     |
        | baseline_updated| true                                     |
        | path            | stages/design/artifacts/hero-layout.html |
      And the PendingMarker's "cleared_at" is set
      And the Baseline entry's SHA is updated to the current on-disk SHA

    Scenario: feedback-addressed transition does NOT clear the marker (R5 contract)
      # Per unit-01 AC-G5/AC-SF3 + DATA-CONTRACTS.md §4.4 R5: addressed feedback can be
      # reopened, so it is not a safe clearance signal. Only terminal states (closed, rejected)
      # and revisit-complete clear the marker.
      Given feedback "FB-12" is linked to a PendingMarker and transitions to "addressed" (not yet "closed")
      When the workflow processes the addressed transition
      Then haiku_baseline_clear_marker is NOT invoked with trigger "feedback-addressed"
      And the PendingMarker remains open with "cleared_at" = null
      And the Baseline entry is NOT updated
      And a subsequent "feedback-closed" transition fires haiku_baseline_clear_marker with trigger "feedback-closed"
      And that subsequent invocation clears the marker and updates the baseline

    Scenario: haiku_baseline_clear_marker targets a single path per invocation
      Given PendingMarkers exist for three different files
      When haiku_baseline_clear_marker is called with one specific path
      Then only the marker for that path is cleared
      And the markers for the other two files remain open

    Scenario: No-op response when no open marker exists for the path
      Given no open PendingMarker exists for "stages/design/artifacts/hero-layout.html"
      When haiku_baseline_clear_marker is invoked for that path
      Then the response "marker_cleared" = false
      And "reason" = "no_open_marker"
      And no error is returned

    Scenario Outline: All trigger values are accepted
      Given an open PendingMarker for the path
      When haiku_baseline_clear_marker is invoked with "trigger" = "<trigger>"
      Then the response "ok" = true
      Examples:
        | trigger              |
        | feedback-closed      |
        | feedback-rejected    |
        | revisit-complete     |

    Scenario: feedback-addressed is not a valid trigger value
      # Per unit-01 AC-G5/AC-SF3 + DATA-CONTRACTS.md §4.4 R5: the trigger enum is restricted
      # to terminal feedback states and revisit completion.
      Given an open PendingMarker for the path
      When haiku_baseline_clear_marker is invoked with "trigger" = "feedback-addressed"
      Then the response "ok" = false
      And the response "error" = "invalid_trigger"
      And the PendingMarker remains open with "cleared_at" = null
