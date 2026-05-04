# RED-TEAM-VERIFICATION.md — Unit-04 Synthesis-Layer Adversarial Review

Companion to `THREAT-MODEL.md` (synthesis), `ASSESSMENTS.md` (audit
trail), and `SECURITY-CONTROLS-VERIFICATION.md` (independent
re-verification). This file is the **red-team-hat output for unit-04** —
the synthesis artifacts themselves are the surface under attack.

**Verifying hat:** `red-team` (unit-04, bolt 1)
**Verification timestamp (UTC):** 2026-05-03T09:15:00Z
**Worktree:** `.haiku/worktrees/out-of-band-human-file-modifications/unit-04-threat-model-and-assessments`

The threat-modeler hat made narrative-and-numeric claims about (a) which
controls exist where and (b) how each cited mitigation works. The
security-engineer hat re-verified the *grep gates* match (15/15
re-passed). Neither hat re-verified the *English mitigation prose* of
THREAT-MODEL.md against the source files it cited. That is this hat's
attack surface.

---

## 1. Methodology

For each control identifier, env var, default value, line-number citation,
and "the X is the compensating control" claim made in narrative form in
THREAT-MODEL.md, the red-team hat:

1. Located the cited file/symbol via `git grep` against the appropriate
   unit branch tip (or current main where the claim is repo-wide).
2. Confirmed the cited identifier exists and matches the prose
   description.
3. Where a default value was claimed (e.g. "fastify default
   connectionTimeout (60s)"), looked up the actual default in the upstream
   docs / code rather than trusting the prose.

Falsifiable claims that fail this check are recorded as red-team findings
(FB-NN files) so the threat-modeler / security-engineer hats can correct
them in a follow-up bolt.

---

## 2. Findings

### Findings filed (HIGH)

| ID | Surface | One-liner |
|---|---|---|
| **FB-11** | THREAT-MODEL.md §5 | Fabricated kill-switch identifier — claims env var `HAIKU_DRIFT_DETECTION=0`; reality is `settings.drift_detection === false` (config field, not env var). Operator-alert deferred risk cannot be implemented against the wrong identifier. |
| **FB-12** | THREAT-MODEL.md §6.1 | Fabricated Fastify `connectionTimeout` default — claims "fastify default `connectionTimeout` (60 s)" mitigates slowloris; actual Fastify default is `0` (no timeout) and `buildApp()` never sets one. Slowloris D-3 mitigation does not hold. |

Both findings are HIGH because they are exactly the failure mode the
synthesis layer is supposed to prevent: a confident, prose-stated
mitigation that does not survive a one-line `grep` against the source.

### Findings considered and dropped

The following were inspected and judged accurate or out-of-scope for
this red-team pass:

| Surface | Verdict | Notes |
|---|---|---|
| THREAT-MODEL.md §1.3 — `EPHEMERAL_SECRET = randomBytes(32)` at `tunnel.ts:11` | Accurate | `git show 06cbb625c:packages/haiku/src/tunnel.ts` line 11 confirms `const EPHEMERAL_SECRET = randomBytes(32)`. |
| THREAT-MODEL.md §1.4 — `alg !== "HS256"` rejection at `tunnel.ts:135-148` | Accurate | Lines 135-148 contain explicit `alg !== "HS256"` rejection plus HMAC verify path with HS256-only flow. |
| THREAT-MODEL.md §3.2 T-1 / T-2 — `safeMkdirAndRename` used by both `state-tools.ts` (via `haiku_human_write`) and `upload-routes.ts` | Accurate | Both call sites confirmed: `haiku_human_write.ts:686`, `upload-routes.ts:456` and `:692`. |
| ASSESSMENTS.md §2 — every cited grep gate at every cited SHA | Re-passed | Re-ran the grep against `git show <sha>:<file>` for V-01..V-11 spot-check; matches the security-engineer hat's 15/15 re-pass. |
| ASSESSMENTS.md §4 — FB-06..FB-10 existence | Confirmed | Files exist on the security stage's main intent dir (created by threat-modeler hat). They are workflow-managed FBs — `ls` in the unit worktree shows only FB-01..FB-05 because the worktree branch is behind on the FB writes; `haiku_feedback_list` against the canonical state confirms FB-06..FB-10 exist with status `closed: deferred-to-followup-iteration:*`. |
| THREAT-MODEL.md §6.4 — `jsonwebtoken` not actually used | Accurate | `tunnel.ts` uses hand-rolled `crypto.createHmac`; no `jsonwebtoken` import anywhere in `packages/haiku/src/`. |
| THREAT-MODEL.md §1.4 — `?t=<jwt>` ban on mutating verbs | Accurate | `http/csrf.ts` defines the rejection reason `query_param_token_disallowed_on_mutating_route`. |
| THREAT-MODEL.md §2.2 — eventual-consistency justification for V-04 acceptance | Sound argument | Locking primitive rejection rationale (vim doesn't honor flock) holds. Single-shot TOCTOU close + drift-gate compensating control is internally consistent. |

### Findings NOT in scope of this red-team pass

The hat's mandate is the synthesis layer (THREAT-MODEL.md, ASSESSMENTS.md,
SECURITY-CONTROLS-VERIFICATION.md). The following were explicitly NOT
attacked because they are sibling-unit work already covered by their
own red-team / blue-team passes:

- V-01..V-11 implementation correctness — covered by unit-01 / unit-02 /
  unit-03 hats; their RED-TEAM-*.md artifacts are the audit trail.
- VULN-REPORT.md per-finding evidence — same.
- The actual `safeMkdirAndRename` race window and whether realpathSync
  re-check is fully race-free against tight-loop symlink flipping —
  ASSESSMENTS.md §4 R-4 already records this as deferred residual risk
  with FB-09; the red-team accepts that classification.

---

## 3. Pre-conditions for this verification's validity

Per THREAT-MODEL.md §1.5, the four trust assumptions must continue to
hold for the V-NN severities to remain accurate. This red-team pass
*assumes* those assumptions hold; if any weakens, every finding gets
re-rated and this red-team pass must re-run.

Additionally specific to this hat:

- The `git show <sha>:<file>` extraction is taken at face value —
  i.e. the unit branch tips `f83f45fe5`, `fe91e1e64`, `06cbb625c` are
  the actual fix-code deliverables. If the workflow engine later
  rewrites those SHAs during stage-branch consolidation, the cited line
  numbers in THREAT-MODEL.md and ASSESSMENTS.md must be re-verified
  against the post-merge SHAs. (This is a generic post-merge audit
  reminder, not a red-team finding against the current artifacts.)

---

## 4. Disposition

- **FB-11 (HIGH)** and **FB-12 (HIGH)** filed against the security stage
  for the next fix-loop bolt; both are corrections to THREAT-MODEL.md
  prose. Neither requires code changes — both are documentation fixes
  with the corresponding source-of-truth identifier already named in
  the finding.
- All other inspected claims pass red-team review.
- `haiku_unit_advance_hat` invoked at the end of this bolt — the
  next hat (security-engineer or feedback-assessor depending on the
  stage's `hats:` rotation) inherits the two findings.

---

## 5. References

- `THREAT-MODEL.md` — synthesis (this stage)
- `ASSESSMENTS.md` — audit trail (this stage)
- `SECURITY-CONTROLS-VERIFICATION.md` — independent re-verification
  (this stage, security-engineer hat)
- `VULN-REPORT.md` — per-finding evidence (discovery hat)
- `packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts` —
  source for the FB-11 kill-switch identifier
- `packages/haiku/src/http.ts` — source for the FB-12 missing
  `connectionTimeout` config
- `node_modules/fastify/docs/Reference/Server.md` — upstream documentation
  for the FB-12 default-value falsification
