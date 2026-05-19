# Release Stage — Execution

## Per-unit baton (`release-engineer → platform-cert-specialist → verifier`)

Every release unit walks the three hats in order. The baton is the unit body, accumulating each hat's operational record:

1. **`release-engineer` (plan + do):** Reads polish's qualified `game-build` artifact and concept's named platform list. Walks the per-platform submission checklist (build artifact, metadata, visual assets, localization, platform features, compliance, submission package). Pre-verifies before submission. Stands up the patch pipeline — exercised end-to-end on a synthetic hotfix before launch. Appends `## Release Operations Log` covering each operational step (preconditions / action / post-condition / rollback / status).
2. **`platform-cert-specialist` (do-refine):** Reads each target platform's certification requirement docs (re-read every cycle; requirements drift across SDK versions). Walks the requirement matrix for this build (compliance metadata, build manifest, visual assets, platform features, accessibility, performance, crash and stability). Pre-verifies on cert reference hardware (not developer hardware) including sustained-play telemetry for thermal-sensitive platforms. Tracks cert feedback when submissions land. Appends `## Cert Pre-Verify Log` with per-platform / per-requirement PASS / GAP verdicts.
3. **`verifier` (verify):** Validates each unit body for preconditions / action / post-condition completeness and explicit rollback declaration. Operational units that omit rollback (or "no rollback — forward-fix only" with rationale) for non-idempotent actions are rejected. Operational units with vague post-conditions ("verify by eye that things look good") are rejected.

The hat order is `plan + do → do-refine → verify` because the submission package must be built before it can be cert-pre-verified, the cert pre-verify must land before the verifier can check the operational record, and the verifier's body-only check is the terminal gate before submission proceeds.

## Stage walk

The workflow engine runs every stage in lifecycle order:

1. **Pre-execute review** — Before any unit hat fires, engine-built review agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `cert-readiness` and `patch-pipeline` review agents and any studio-level review agents audit the SPEC the elaborate phase produced. Findings open feedback against the unit spec; closure routes through the fix loop before execute can begin.

2. **Execute** — Every unit's hat chain runs per the baton above.

3. **Quality gates** — Each unit's declared `quality_gates:` commands run; non-zero exit blocks the advance.

4. **Post-execute approval** — Engine-built approval agents (`spec`, `continuity`, `cross-stage-consistency`) plus the stage's `cert-readiness` and `patch-pipeline` review agents and any studio-level review agents fire again, this time auditing the WORK against the spec the pre-execute walk already approved. Same role names, phase-appropriate mandate (post-execute prose lives in `engine-bodies/<role>.eta.md` under `dispatch_approval/`).

5. **Fix loop (if any feedback opens)** — `fix_hats: classifier → release-engineer → feedback-assessor` dispatches per finding. The classifier routes the FB to the right unit or stage; `release-engineer` is the implementer (re-cutting a submission build); the assessor independently decides closure.

6. **Gate** — The stage's gate is `await`. Release waits for the **external event** (platform certification result, storefront approval, launch-day milestone) rather than asking the user to approve locally. The submission has been made; the world responds.

## Reviewer guidance specific to this stage

When a review agent or human reviewer reads the stage's output:

- **Pre-verify on developer hardware rather than cert reference hardware** is the single most common cert-failure cause. Cert-readiness lens enforces reference hardware.
- **Patch pipeline that was documented but never exercised end-to-end** is the dominant launch-week disaster. Patch-pipeline lens requires a dry-run on a real or synthetic hotfix before launch.
- **Operational unit without a rollback or explicit "no rollback" disposition** is a unit that hasn't thought through the failure case. Rejection is the right routing for these.
- **Cert requirements walked against last cycle's platform doc version** rather than current SDK's version surfaces as failed cert items that should have been caught in pre-verify.
- **Platform-specific commitments from concept (achievements, trophies, accessibility, localization)** silently omitted in release submission are findings that route back to release-engineer with the relevant cert specialist guidance.
