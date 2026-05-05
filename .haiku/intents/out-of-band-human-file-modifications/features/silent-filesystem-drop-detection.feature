Feature: Silent filesystem drop detection
  As a Designer or Product Owner working alongside a H·AI·K·U intent
  I want files I drop into the worktree to be noticed by the workflow on the next tick
  So that my changes are never silently overwritten by the agent's next action

  Background:
    Given an active intent "demo-intent" in stage "design" running in studio "software"
    And a tracked surface baseline exists for stage "design"
    And the tracked surface for stage "design" includes "stages/design/artifacts/"
    And the tracked surface for stage "design" also includes "stages/design/outputs/" as an alias for "stages/design/artifacts/"
    And no pending-assessment markers exist for any tracked file
    And the next workflow operation is the agent calling haiku_run_next
  # ---------------------------------------------------------------------------
  # Motivating scenario 1: Designer replaces layout
  # ---------------------------------------------------------------------------

  Scenario: Designer replaces a stage output layout file
    Given the file "stages/design/artifacts/dashboard-layout.html" was last written by the agent with SHA "agent-sha-001"
    When the Designer replaces "stages/design/artifacts/dashboard-layout.html" via direct filesystem write with new content having SHA "human-sha-002"
    And the agent calls haiku_run_next
    Then the pre-tick drift-detection gate detects the SHA mismatch on "stages/design/artifacts/dashboard-layout.html"
    And the workflow emits a "manual_change_assessment" action
    And the action payload contains a DriftFinding with change_kind "modified" for "stages/design/artifacts/dashboard-layout.html"
    And the DriftFinding includes a unified text diff between SHA "agent-sha-001" and SHA "human-sha-002"
    And the agent is instructed to classify the change before any normal stage handler runs
  # ---------------------------------------------------------------------------
  # Motivating scenario 2: PO edits deliverable and asks AI to extend
  # ---------------------------------------------------------------------------

  Scenario: Product Owner edits an existing stage output deliverable
    Given the file "stages/design/artifacts/spec.md" was last written by the agent with SHA "agent-sha-010"
    When the Product Owner hand-edits "stages/design/artifacts/spec.md" outside any UI producing SHA "human-sha-011"
    And the agent calls haiku_run_next
    Then the pre-tick drift-detection gate detects the SHA mismatch on "stages/design/artifacts/spec.md"
    And the workflow emits a "manual_change_assessment" action
    And the DriftFinding for "stages/design/artifacts/spec.md" has change_kind "modified"
    And the DriftFinding diff_unified field shows only the lines the Product Owner changed
  # ---------------------------------------------------------------------------
  # Motivating scenario 3: User uploads knowledge
  # ---------------------------------------------------------------------------

  Scenario: User drops a brand-new knowledge file into the elaborate phase
    Given a tracked surface baseline exists for stage "inception"
    And the tracked surface for stage "inception" includes "knowledge/"
    And the file "knowledge/market-research.pdf" has no baseline entry (it is a new file)
    When the User drops "knowledge/market-research.pdf" into the worktree via direct filesystem write
    And the agent calls haiku_run_next
    Then the pre-tick drift-detection gate detects an added file under the tracked surface
    And the workflow emits a "manual_change_assessment" action
    And the DriftFinding for "knowledge/market-research.pdf" has change_kind "added" with before_sha256 null
    And the DriftFinding has is_binary true and diff_unified null (PDF is binary)
    And the agent is instructed to classify the addition before continuing elaborate
  # ---------------------------------------------------------------------------
  # Alias coverage: outputs/ and artifacts/ are the same tracked surface
  # ---------------------------------------------------------------------------

  Scenario: Gate tracks both artifacts/ and outputs/ alias as the same surface
    Given the file "stages/design/artifacts/hero.html" was last written by the agent with SHA "agent-sha-020"
    And the file "stages/design/outputs/hero.html" is a filesystem alias for "stages/design/artifacts/hero.html"
    When the Designer replaces "stages/design/outputs/hero.html" via direct filesystem write with SHA "human-sha-021"
    And the agent calls haiku_run_next
    Then the pre-tick drift-detection gate detects the SHA mismatch
    And the DriftFinding baseline key is "stages/design/artifacts/hero.html" (canonical artifacts/ form)
    And the workflow emits a "manual_change_assessment" action with change_kind "modified"
  # ---------------------------------------------------------------------------
  # Edge cases: tick model boundaries
  # ---------------------------------------------------------------------------

  Scenario: Multiple files change between two ticks
    Given files "stages/design/artifacts/a.html", "stages/design/artifacts/b.html", and "stages/design/artifacts/c.html" were last written by the agent
    When the Designer replaces all three files via filesystem writes
    And the agent calls haiku_run_next
    Then the workflow emits exactly one "manual_change_assessment" action
    And the action payload findings array contains exactly three DriftFindings
    And each DriftFinding carries its own change_kind, diff_unified, before_sha256, and after_sha256

  Scenario: Zero changes since the last tick
    Given no tracked file has changed since the last baseline acknowledgment
    When the agent calls haiku_run_next
    Then the pre-tick drift-detection gate detects no SHA mismatches
    And no "manual_change_assessment" action is emitted
    And the normal stage handler runs unblocked

  Scenario: Change is detected on next tick not during in-flight bolt
    Given the agent is mid-bolt processing a unit
    When the Designer replaces "stages/design/artifacts/layout.html" while the bolt is in flight
    Then no detection event fires during the in-flight bolt
    And the agent's mid-bolt work continues uninterrupted against the pre-edit version of the file
    When the agent calls haiku_run_next after the bolt completes
    Then the pre-tick drift-detection gate observes the SHA mismatch
    And the workflow emits a "manual_change_assessment" action with change_kind "modified"
  # ---------------------------------------------------------------------------
  # Edge cases: baseline establishment (first tick after upgrade)
  # ---------------------------------------------------------------------------

  Scenario: First tick after feature ships establishes baselines without firing assessments
    Given the intent "demo-intent" existed before the drift-detection feature shipped
    And no "stages/design/baseline.json" exists for stage "design"
    When the agent calls haiku_run_next for the first time after the feature ships
    Then the drift-detection gate runs in baseline-establishment mode
    And the gate enumerates all files in the tracked surface and writes their SHA-256 hashes to baseline.json
    And each baseline entry has acknowledged_by "agent" as the conservative default
    And zero "manual_change_assessment" actions are emitted on this first tick
    And state.json records drift_baseline_established_at for stage "design"
    And subsequent ticks run in drift-detection mode against the newly established baseline
  # ---------------------------------------------------------------------------
  # Kill-switch: drift_detection: false plugin-setting disables the entire gate
  # Closes COVERAGE-MAPPING.md §13 hard blockers SC-1.7, SC-2.10, SC-4.10.
  # AC reference: ACCEPTANCE-CRITERIA.md AC-G1-KS. Design citation: DESN-05
  # (failure-mode rollback / fail-safe). Origin: DISCOVERY.md §9 projected
  # "Operator disables drift detection mid-incident" scenario.
  # ---------------------------------------------------------------------------

  Scenario: Kill-switch disabled — drift-detection gate is a complete no-op
    Given the plugin-settings flag "drift_detection" for intent "demo-intent" is set to false
    And the file "stages/design/artifacts/dashboard-layout.html" was last written by the agent with SHA "agent-sha-100"
    And the Designer has replaced "stages/design/artifacts/dashboard-layout.html" via direct filesystem write with SHA "human-sha-101"
    When the agent calls haiku_run_next
    Then the pre-tick drift-detection gate performs zero SHA computations against tracked-surface files
    And the gate does not read "stages/design/baseline.json"
    And the gate does not enumerate "stages/design/artifacts/", "stages/design/outputs/", or "knowledge/"
    And no DriftFinding is emitted for "stages/design/artifacts/dashboard-layout.html"
    And no "manual_change_assessment" action is queued on the workflow for this tick
    And no pending-assessment marker is written, modified, or read
    And no entry is appended to any "stages/design/drift-assessments/DA-*.json" record on account of this gate
    And the tick proceeds directly to per-state dispatch as if zero drift events occurred

  Scenario: Kill-switch re-enabled — gate does not auto-re-establish baseline on toggle-on
    Given the plugin-settings flag "drift_detection" for intent "demo-intent" was set to false on the prior tick
    And the file "stages/design/artifacts/dashboard-layout.html" drifted from baseline SHA "agent-sha-200" to "human-sha-201" while the kill-switch was off
    And the operator now sets the plugin-settings flag "drift_detection" back to true
    When the agent calls haiku_run_next on the next tick after re-enable
    Then the drift-detection gate does NOT auto-establish a fresh baseline against the post-edit content
    And no DriftFinding is retroactively emitted for changes that occurred while the kill-switch was off
    And the existing "stages/design/baseline.json" (if present) is reused unchanged for subsequent comparisons
    And re-arming the feature against the current worktree state requires an explicit "haiku_repair" invocation by the operator
  # ---------------------------------------------------------------------------
  # Edge cases: editor temp files
  # ---------------------------------------------------------------------------

  Scenario: Editor temp files do not produce false drift events
    Given the tracked surface includes "stages/design/artifacts/"
    When a human editor briefly creates "stages/design/artifacts/.spec.md.swp" during a vim save
    And the temp file is removed before the next tick fires (final renamed file "spec.md" replaces prior)
    And the agent calls haiku_run_next
    Then the pre-tick drift-detection gate does not emit a drift event for "stages/design/artifacts/.spec.md.swp"
    And the gate emits a drift event only for "stages/design/artifacts/spec.md" if its SHA changed
    And no spurious DriftFinding appears for transient temp files matching common editor patterns
  # ---------------------------------------------------------------------------
  # Edge cases: deletions
  # ---------------------------------------------------------------------------

  Scenario: Tracked file is deleted from the worktree
    Given the file "stages/design/artifacts/old-mock.html" exists with baseline SHA "agent-sha-030"
    And the file's author_class in the baseline is "agent"
    When the User deletes "stages/design/artifacts/old-mock.html" from the filesystem
    And the agent calls haiku_run_next
    Then the pre-tick drift-detection gate detects the deletion
    And the workflow emits a "manual_change_assessment" action
    And the DriftFinding has change_kind "deleted" with after_sha256 null and before_sha256 "agent-sha-030"
    And the diff_unified field is null for the deleted file
  # ---------------------------------------------------------------------------
  # Edge cases: binary / mime-only changes
  # ---------------------------------------------------------------------------

  Scenario: Binary file replacement is detected with SHA delta only (no textual diff)
    Given the file "stages/design/artifacts/mockup.png" has baseline SHA "img-sha-001"
    When the Designer replaces "stages/design/artifacts/mockup.png" with a new image file with SHA "img-sha-002"
    And the agent calls haiku_run_next
    Then the drift-detection gate detects the SHA mismatch
    And the DriftFinding has is_binary true
    And the DriftFinding has diff_unified null (no content diff for binary files)
    And the DriftFinding includes before_sha256 "img-sha-001" and after_sha256 "img-sha-002"
    And the workflow emits a "manual_change_assessment" action for the agent to classify
  # ---------------------------------------------------------------------------
  # Edge cases: pending-assessment marker suppresses re-detection
  # ---------------------------------------------------------------------------

  Scenario: File with open pending-assessment marker is suppressed on next tick
    Given the file "stages/design/artifacts/layout.html" was classified as "surface-as-feedback" in a prior tick
    And a pending-assessment marker exists for "stages/design/artifacts/layout.html" linked to "FB-05"
    And the file's on-disk SHA matches the baseline_sha_at_creation in the marker
    When the agent calls haiku_run_next
    Then the drift-detection gate reads the open marker for "stages/design/artifacts/layout.html"
    And the gate suppresses drift detection for "stages/design/artifacts/layout.html"
    And no DriftFinding is emitted for "stages/design/artifacts/layout.html"
  # ---------------------------------------------------------------------------
  # Clearance trigger contract (DATA-CONTRACTS.md §4.4 + unit-01 AC-G5/AC-SF3):
  # only terminal feedback states (`closed`, `rejected`) clear the PendingMarker.
  # `addressed` is a mid-state that can be reopened — it does NOT clear the marker.
  # ---------------------------------------------------------------------------

  Scenario Outline: Pending-assessment marker is cleared when feedback reaches a terminal state
    Given a pending-assessment marker exists for "stages/design/artifacts/layout.html" linked to feedback "FB-05"
    And "FB-05" has status "open"
    When "FB-05" transitions to status "<terminal_status>"
    Then haiku_baseline_clear_marker fires with trigger "feedback-<terminal_status>"
    And the pending-assessment marker for "stages/design/artifacts/layout.html" is cleared
    And the baseline SHA for "stages/design/artifacts/layout.html" updates to the file's current SHA at clearing time
    And on the next tick the drift-detection gate treats "stages/design/artifacts/layout.html" as baseline-matched

    Examples:
      | terminal_status |
      | closed          |
      | rejected        |

  Scenario: Pending-assessment marker is NOT cleared when feedback transitions to addressed
    # Rationale: `addressed` is a mid-state that can be reopened. Only immutable terminal
    # states provide the guarantee required to update the baseline safely (AC-G5, AC-SF3).
    Given a pending-assessment marker exists for "stages/design/artifacts/spec.md" linked to feedback "FB-06"
    And "FB-06" has status "open"
    When "FB-06" transitions to status "addressed"
    Then haiku_baseline_clear_marker is NOT called
    And the pending-assessment marker for "stages/design/artifacts/spec.md" remains open (cleared_at is null)
    And the baseline SHA for "stages/design/artifacts/spec.md" is unchanged
    And the drift-detection gate continues to suppress re-detection of "stages/design/artifacts/spec.md" on the next tick
  # ---------------------------------------------------------------------------
  # Error scenarios
  # ---------------------------------------------------------------------------

  Scenario: Baseline storage is corrupt on tick
    Given the "stages/design/baseline.json" file contains invalid JSON
    When the agent calls haiku_run_next
    Then the drift-detection gate emits a "baseline_corrupt" signal and halts
    And the tick does not advance to per-state dispatch
    And the workflow engine surfaces the error "Baseline file for stage 'design' is corrupt. Run haiku_repair to re-establish the baseline."

  Scenario: Files outside the tracked surface are not detected
    Given the tracked surface for stage "design" is "stages/design/artifacts/" and "knowledge/"
    When the User edits "README.md" at the repository root
    And the agent calls haiku_run_next
    Then the drift-detection gate does not emit a DriftFinding for "README.md"
    And no "manual_change_assessment" action is emitted on account of that file
