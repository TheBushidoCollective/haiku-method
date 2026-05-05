Feature: HTTP API surface for SPA uploads and assessment viewing
  Four HTTP endpoints support the browse SPA's upload affordances and drift assessment view.
  All endpoints use session cookie authentication from the existing review-server auth flow.

  # =========================================================================
  # POST /api/intents/{intent-slug}/uploads/stage-output
  # =========================================================================

  Feature: POST /api/intents/{slug}/uploads/stage-output

    Background:
      Given an authenticated SPA session
      And an active intent "out-of-band-human-file-modifications"
      And stage "design" with artifacts directory present

    Scenario: Successful upsert upload returns 200 with tick_will_observe true
      Given the user uploads "hero-layout.html" to stage "design" with mode "upsert"
      When the POST request is submitted
      Then the response status is 200
      And the response body includes:
        | field             | present |
        | ok                | yes     |
        | path              | yes     |
        | sha256            | yes     |
        | bytes             | yes     |
        | baseline_updated  | yes     |
        | tick_will_observe | yes     |
      And "baseline_updated" = false
      And "tick_will_observe" = true
      And the file is written to disk
      And an action-log entry is written with "author_class" = "human-via-mcp"
      And baseline.json is NOT updated by this call

    Scenario: mode "replace" fails with 400 when file does not exist
      Given "hero-layout.html" does not exist in the stage artifacts directory
      And the user uploads with mode "replace"
      When the POST request is submitted
      Then the response status is 400
      And "error" = "mode_violation"

    Scenario: mode "create" fails with 400 when file already exists
      Given "hero-layout.html" already exists in the stage artifacts directory
      And the user uploads with mode "create"
      When the POST request is submitted
      Then the response status is 400
      And "error" = "mode_violation"

    Scenario: target_path escaping the stage artifacts directory returns 400
      Given the user submits "target_path" = "../../../intent.md"
      When the POST request is submitted
      Then the response status is 400
      And "error" = "bad_target_path"

    Scenario: Unauthenticated request returns 401
      Given no session cookie is present
      When the POST request is submitted
      Then the response status is 401
      And "error" = "unauthorized"

    Scenario: Upload to a completed and merged stage returns 403
      Given stage "design" is in "completed" status and its branch is merged
      When the user uploads to that stage
      Then the response status is 403
      And "error" = "stage_not_writable"

    Scenario: Unknown intent slug returns 404
      When a POST is sent to "/api/intents/nonexistent/uploads/stage-output"
      Then the response status is 404
      And "error" = "intent_not_found"

    Scenario: Intent in a locked state returns 409
      Given the intent is in a state that disallows uploads
      When the user uploads
      Then the response status is 409
      And "error" = "intent_locked"

    Scenario: File exceeding 50 MB returns 413
      Given the user uploads a 60 MB file
      When the POST request is submitted
      Then the response status is 413
      And "error" = "payload_too_large"

    Scenario: Disk write failure returns 500 without baseline update
      Given the disk write fails due to a storage error
      When the POST request is submitted
      Then the response status is 500
      And "error" = "write_failed"
      And baseline.json is NOT modified

    Scenario: path in 200 response is intent-relative not stage-relative
      Given target_path = "artifacts/hero-layout.html" and stage = "design"
      When the upload succeeds
      Then the response "path" = "stages/design/artifacts/hero-layout.html"

  # =========================================================================
  # POST /api/intents/{intent-slug}/uploads/knowledge
  # =========================================================================

  Feature: POST /api/intents/{slug}/uploads/knowledge

    Background:
      Given an authenticated SPA session
      And an active intent "out-of-band-human-file-modifications"

    Scenario: Successful intent-scope knowledge upload returns 200
      Given the user uploads "brand-guide.pdf" with no stage specified
      When the POST request is submitted
      Then the response status is 200
      And "ok" = true
      And "baseline_updated" = false
      And "tick_will_observe" = true
      And the file is written to "knowledge/brand-guide.pdf"

    Scenario: Successful per-stage knowledge upload routes to stage knowledge directory
      Given the user uploads "design-notes.md" with stage = "design"
      When the POST request is submitted
      Then the response status is 200
      And the file is written to "stages/design/knowledge/design-notes.md"

    Scenario: target_filename with path separators returns 400
      Given the user submits "target_filename" = "sub/dir/file.md"
      When the POST request is submitted
      Then the response status is 400
      And "error" = "bad_target_filename"

    Scenario: Duplicate filename at same scope returns 409
      Given "brand-guide.pdf" already exists in the knowledge directory
      And the user uploads another file named "brand-guide.pdf"
      When the POST request is submitted
      Then the response status is 409
      And "error" = "filename_collision"

    Scenario: Unauthenticated request returns 401
      Given no session cookie is present
      When the POST request is submitted
      Then the response status is 401

    Scenario: File exceeding size cap returns 413
      Given the user uploads a file exceeding the configured maximum
      When the POST request is submitted
      Then the response status is 413
      And "error" = "payload_too_large"

    Scenario: Disk write failure returns 500
      Given the disk write fails
      When the POST request is submitted
      Then the response status is 500
      And "error" = "write_failed"

  # =========================================================================
  # GET /api/intents/{intent-slug}/assessments
  # =========================================================================

  Feature: GET /api/intents/{slug}/assessments

    Background:
      Given an authenticated SPA session
      And intent "out-of-band-human-file-modifications" has 5 assessment records

    Scenario: List assessments returns newest first
      When the GET request is sent with no query params
      Then the response status is 200
      And the response body includes:
        | field       | present |
        | ok          | yes     |
        | assessments | yes     |
        | total       | yes     |
        | has_more    | yes     |
      And "assessments" is ordered by "created_at" descending

    Scenario: limit parameter caps the returned count
      When the GET request is sent with "limit" = 2
      Then "assessments" contains exactly 2 records
      And "has_more" = true

    Scenario: limit maximum is 200
      When the GET request is sent with "limit" = 300
      Then the response status is 400
      And "error" = "bad_param"

    Scenario: since parameter filters to assessments newer than the provided timestamp
      Given assessments were created at T1, T2, T3, T4, T5 (oldest to newest)
      When the GET request is sent with "since" = T3
      Then "assessments" contains only records with "created_at" > T3

    Scenario: stage parameter filters by the finding's stage
      Given assessments exist with findings in both "design" and "development" stages
      When the GET request is sent with "stage" = "design"
      Then all returned assessments have at least one finding with "stage" = "design"

    Scenario Outline: outcome parameter filters by classification outcome
      Given assessments exist with various outcomes
      When the GET request is sent with "outcome" = "<outcome>"
      Then all returned assessments contain a classification with "outcome" = "<outcome>"
      Examples:
        | outcome              |
        | ignore               |
        | inline-fix           |
        | surface-as-feedback  |
        | trigger-revisit      |

    Scenario: Malformed RFC 3339 timestamp in since returns 400
      When the GET request is sent with "since" = "not-a-timestamp"
      Then the response status is 400
      And "error" = "bad_param"

    Scenario: Unknown intent returns 404
      When a GET is sent to "/api/intents/nonexistent/assessments"
      Then the response status is 404
      And "error" = "intent_not_found"

    Scenario: Unauthenticated request returns 401
      Given no session cookie is present
      When the GET request is sent
      Then the response status is 401

  # =========================================================================
  # GET /api/intents/{intent-slug}/assessments/{assessment-id}
  # =========================================================================

  Feature: GET /api/intents/{slug}/assessments/{assessment-id}

    Background:
      Given an authenticated SPA session
      And intent "out-of-band-human-file-modifications" has assessment "AS-07"

    Scenario: Fetching an existing assessment returns the full Assessment object
      When the GET request is sent for "AS-07"
      Then the response status is 200
      And the response body includes:
        | field      | present |
        | ok         | yes     |
        | assessment | yes     |
      And "assessment.id" = "AS-07"
      And the assessment includes all fields from the Assessment schema (§2.3 of DATA-CONTRACTS.md)

    Scenario: Fetching a non-existent assessment returns 404
      When the GET request is sent for "AS-99"
      Then the response status is 404
      And "error" = "assessment_not_found"

    Scenario: Fetching an assessment for a non-existent intent returns 404
      When the GET request is sent to "/api/intents/nonexistent/assessments/AS-07"
      Then the response status is 404
      And "error" = "intent_not_found"

    Scenario: Unauthenticated request returns 401
      Given no session cookie is present
      When the GET request is sent for "AS-07"
      Then the response status is 401
