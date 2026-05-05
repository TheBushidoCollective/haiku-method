Feature: Explicit SPA upload of out-of-band human files
  As a Designer, Product Owner, or Reviewer using the browse/review SPA
  I want to attach or replace files for an active intent through a deliberate UI affordance
  So that my contribution is registered against a stage without using the filesystem or chat

  Background:
    Given an active intent "demo-intent" is loaded in the browse SPA
    And the SPA is connected to the H·AI·K·U review server for that intent
    And the intent has stage "design" as the active stage
    And the agent is not currently mid-bolt
    And the Reviewer is signed in as a human reviewer
  # ---------------------------------------------------------------------------
  # Happy Path: stage output replacement upload
  # ---------------------------------------------------------------------------

  Scenario: Designer replaces a stage output file via the SPA upload UI
    Given the SPA is showing the "Outputs" section of stage "design"
    And the existing artifact "dashboard-layout.html" is listed under "stages/design/artifacts/"
    When the Designer chooses "Replace this output" on "dashboard-layout.html"
    And the Designer selects a new local file "dashboard-v2.html"
    And the Designer confirms the replacement
    Then the SPA writes the new content to "stages/design/artifacts/dashboard-layout.html" in the active worktree
    And the SPA does NOT invoke any agent-write MCP tool
    And the existing PreToolUse workflow-managed-file hook does not fire for this write
    And the SPA endpoint stamps an action-log entry with author_class "human-via-mcp"
    And the SPA endpoint does NOT update baseline.json directly
    And on the next agent tick the drift-detection gate detects the SHA mismatch
    And the workflow emits a "manual_change_assessment" action with the DriftFinding author_class "human-via-mcp"

  Scenario: Product Owner attaches a new knowledge file via the SPA
    Given the SPA is showing the Knowledge Upload Panel
    And no file named "competitive-analysis.pdf" exists in "knowledge/"
    When the Product Owner selects "Upload" in the Knowledge Upload Panel
    And selects "competitive-analysis.pdf" from the local filesystem
    And confirms the upload
    Then the SPA writes "knowledge/competitive-analysis.pdf" into the worktree
    And the SPA endpoint stamps an action-log entry with author_class "human-via-mcp"
    And the SPA endpoint does NOT update baseline.json directly
    And on the next agent tick the drift-detection gate detects "knowledge/competitive-analysis.pdf" as a new file with change_kind "added"
  # ---------------------------------------------------------------------------
  # Replace vs upload semantics
  # ---------------------------------------------------------------------------

  Scenario: Replace preserves original filename; upload uses supplied filename
    Given the existing artifact "hero-layout.html" is listed under "stages/design/artifacts/"
    When the Designer replaces "hero-layout.html" by uploading "hero-layout-v3.html" in replace mode
    Then the file is written as "stages/design/artifacts/hero-layout.html" (original name preserved)
    And no separate "hero-layout-v3.html" file is created in the worktree

  Scenario: Upload in create mode with filename collision is rejected
    Given the knowledge file "market-brief.md" already exists at "knowledge/market-brief.md"
    When the Product Owner attempts to upload "market-brief.md" using mode "create"
    Then the SPA returns error code "filename_collision"
    And the SPA prompts the Product Owner to either rename the file or switch to "upsert" mode
    And no file is overwritten
  # ---------------------------------------------------------------------------
  # Per-stage availability scenario outline
  # ---------------------------------------------------------------------------

  Scenario Outline: Upload affordance is available for stages with a defined upload target
    Given the SPA is showing stage "<stage>"
    When the User opens the upload affordance for stage "<stage>"
    Then the SPA shows the "<target_surface>" upload target as available
    And the User can complete an upload to that surface

    Examples:
      | stage       | target_surface                |
      | inception   | knowledge/                    |
      | design      | stages/design/artifacts/      |
      | development | stages/development/artifacts/ |
      | product     | stages/product/artifacts/     |

  Scenario: Upload affordance is hidden for a stage with no defined upload target
    Given the SPA is showing a stage with no configured upload target
    When the User opens the upload menu for that stage
    Then no upload or replace affordance is shown for that stage
  # ---------------------------------------------------------------------------
  # Hook-bypass invariant
  # ---------------------------------------------------------------------------

  Scenario: SPA upload does not trigger the PreToolUse workflow-managed-file hook
    Given the Designer is uploading "stages/design/artifacts/mockup.png" via the SPA replace modal
    When the upload completes
    Then the PreToolUse hook that guards units/*.md, feedback/*.md, intent.md, and state.json is not fired
    And the write proceeds directly from the SPA endpoint to disk
  # ---------------------------------------------------------------------------
  # Size limit
  # ---------------------------------------------------------------------------

  Scenario: Upload exceeds the configured size limit
    Given the configured upload size limit is 50 MB
    When the User selects a file of size 120 MB for upload
    Then the SPA refuses the upload before any bytes are written to disk
    And the SPA returns HTTP 413 with error code "payload_too_large"
    And no temporary file is created in the worktree
  # ---------------------------------------------------------------------------
  # Locked worktree
  # ---------------------------------------------------------------------------

  Scenario: Upload is attempted while the worktree is locked by another process
    Given the active worktree is locked by a concurrent operation
    When the User confirms an upload
    Then the SPA endpoint returns HTTP 409 with error code "intent_locked"
    And the SPA shows "Worktree is busy; try again"
    And no partial file is left on disk
  # ---------------------------------------------------------------------------
  # Archived intent
  # ---------------------------------------------------------------------------

  Scenario: Upload is rejected for an archived intent
    Given the intent "demo-intent" has been archived since the SPA session started
    When the Reviewer attempts to upload a file
    Then the SPA endpoint returns HTTP 404 with error code "intent_not_found" or HTTP 409 with a descriptive message
    And no file is written to disk
  # ---------------------------------------------------------------------------
  # Visibility: assessment pending badge
  # ---------------------------------------------------------------------------

  Scenario: Uploaded file shows pending-assessment badge until next tick classifies it
    Given the SPA is showing the "Outputs" section of stage "design"
    When the Designer completes a replace upload of "dashboard-layout.html"
    Then the SPA immediately reflects the new file's metadata (size, modified-at)
    And the artifact card for "dashboard-layout.html" shows a drift-detected state badge
    And the badge persists until the next "manual_change_assessment" classification completes on the next tick
