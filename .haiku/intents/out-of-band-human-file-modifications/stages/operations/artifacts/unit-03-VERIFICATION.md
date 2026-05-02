# unit-03-ci-drift-safety — verifier sign-off

Verifier hat record for the operations-stage CI drift-safety unit. The unit shipped two CI / docs deliverables (named drift-test coverage guard wired into the GitHub Actions MCP Tests job, plus a kill-switch section + verification recipe in `plugin/README.md`); this document records the per-criterion pass/fail decisions.

## Artifacts under review

- `scripts/check-ci-covers-drift-tests.mjs` — node script that asserts the four named drift / reconciliation test files (`drift-detection-gate.test.mjs`, `upstream-reconciliation.test.mjs`, `drift-baseline.test.mjs`, `drift-markers.test.mjs`) (1) exist on disk, (2) are picked up by `packages/haiku/test/run-all.mjs`'s discovery filter, and (3) each contain at least one `assert.` call (the SRE pass added the assertion-count guard to defeat empty-but-present files).
- `.github/workflows/ci.yml` — adds a `Verify drift-test coverage` step in the MCP Tests job, between `Build haiku-api` and `Run MCP test suite`, invoking `node scripts/check-ci-covers-drift-tests.mjs`.
- `plugin/README.md` — adds a `## Kill-switch — disabling drift detection` section that names the project-level YAML flag (`drift_detection: false` in `.haiku/settings.yml`), the scope of what it disables (the drift-detection gate; reconciliation and baseline establishment continue), and points to `.haiku/knowledge/RUNBOOK.md` for incident playbooks. The SRE pass added a `Verifying the kill-switch is live` paragraph naming the observable signal (`drift_disabled_warning` returned from `haiku_baseline_init`) and the YAML literal-vs-string trap (`false` ≠ `"false"` ≠ `False`).

## Verifier checks (per `hats/verifier.md`)

### 1. Preconditions, action, post-condition all stated — PASS

The kill-switch section in `plugin/README.md` carries all three:

- *Preconditions* — "If it ever misfires (false positives during a noisy refactor, an integration that legitimately rewrites tracked surfaces, load shedding under heavy churn)" enumerates the operational triggers under which the operator should consider flipping the flag.
- *Action* — a literal YAML snippet (`drift_detection: false`) with the exact file location (`.haiku/settings.yml`) and the explicit scope of effect ("That single key disables the drift-detection gate for the project").
- *Post-condition* — call `haiku_baseline_init` against any intent and observe the `drift_disabled_warning` key in the response when the kill-switch is active. Absence of the key on the next call is the explicit failure signal ("the YAML key is malformed").

The CI guard script carries an analogous triple:

- *Preconditions* — implicit in CI placement: node available, MCP Tests job has built `haiku-api`. The script header documents the contract being protected ("the drift-detection-gate and upstream-reconciliation tests are the only safety net catching a silent regression of the two pre-tick gates").
- *Action* — `node scripts/check-ci-covers-drift-tests.mjs`.
- *Post-condition* — exit code 0 = pass, exit code 1 = gap, with named `MISSING:` / `NOT DISCOVERED:` / `NO ASSERTIONS in:` failure prefixes per file.

### 2. Verifiable post-condition — PASS

Both deliverables produce a clear pass/fail signal:

- The kill-switch verification recipe names a real, implemented, tested signal: `drift_disabled_warning` is emitted by `packages/haiku/src/tools/orchestrator/haiku_baseline_init.ts` (three call sites at lines 255, 329, 469) and is asserted in `packages/haiku/test/haiku-baseline-init.test.mjs` ("tool succeeds with a drift_disabled_warning when drift_detection: false"). This is not a hypothetical contract — it's the observable side effect of the existing implementation.
- The CI guard script's exit code is binary, the failure messages name the specific file that's missing/empty, and the script was smoke-tested by emptying `drift-markers.test.mjs` (returned exit 1; restored after verification — see commit `ca0c7acc0` body).

Locally re-ran the script during this verification: all four files present, run-all.mjs would discover them, and each carries runnable assertions (drift-detection-gate 117, upstream-reconciliation 43, drift-baseline 65, drift-markers 54). Output reproduces the documented contract.

The CI YAML is structurally valid (parsed cleanly through the `yaml` npm parser during this verification — no indentation errors, no unclosed mapping).

### 3. Rollback / recovery named — PASS

- The kill-switch is itself the rollback for the drift-detection gate; the action is explicitly idempotent and reversible: "Flip it back to `true` (or remove the key entirely) once the noisy condition clears."
- For incident playbooks beyond the kill-switch flip itself ("how to roll back a corrupt baseline", "how to clear stuck reconciliation findings"), the README points to `.haiku/knowledge/RUNBOOK.md` (the unit-01 deliverable that ships in the same operations stage).
- The CI guard step is idempotent (running it twice produces the same result; failing it does not mutate state) and is reversible by removing the workflow step. No rollback section is required for an additive CI check.

### 4. Decision-register consistency — PASS

The kill-switch contract honored by `plugin/README.md` matches design-stage Decision 8.5 (`stages/design/artifacts/ARCHITECTURE.md` §8.5 "Kill-Switch — `drift_detection: false`") and the canonical inception decision in `knowledge/ARCHITECTURE.md` §5.7 "The Kill-Switch Is Plugin-Wide, Not Per-Intent":

- *Flag location* — README documents `.haiku/settings.yml`; ARCHITECTURE §8.5 specifies "a boolean field at the plugin-settings level". Match.
- *Default* — both unstated default and explicit reset use `true`; ARCHITECTURE §8.5 says "the default value when the field is absent is `true`". Match.
- *Scope of effect* — README says the gate becomes a no-op while reconciliation and baseline establishment continue; ARCHITECTURE §8.5 lists the same scope ("the pre-tick drift-detection gate becomes a complete no-op"). Match.
- *Plugin-wide, not per-intent* — README does not introduce a per-intent override; ARCHITECTURE §5.7 explicitly defers per-intent kill-switches to v2. Match.

The CI guard's named files (`drift-detection-gate`, `upstream-reconciliation`, `drift-baseline`, `drift-markers`) match the test-file names that actually exist in `packages/haiku/test/` and exercise the contracts named in design-stage decisions.

No contradiction with any recorded Decision.

### 5. Open questions accounted for — PASS

Searched all three deliverables (`scripts/check-ci-covers-drift-tests.mjs`, `plugin/README.md` kill-switch section, `.github/workflows/ci.yml` Verify drift-test coverage step) for `TODO`, `FIXME`, `XXX`, and "Open Questions" markers. None present. No deferred work is being smuggled into operations.

## Decision

ADVANCE. All five verifier criteria pass. The CI drift-safety net is in place (assertion-count-guarded coverage check wired into the MCP Tests job) and the operator-facing kill-switch is documented with a verifiable observable signal that matches the implementation.
