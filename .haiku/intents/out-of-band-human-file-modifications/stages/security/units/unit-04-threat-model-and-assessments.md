---
title: Threat model + per-fix assessments + deferred-risk register
depends_on:
  - unit-01-upload-content-validation
  - unit-02-author-identity-binding
  - unit-03-symlink-toctou-and-csrf
inputs:
  - .haiku/intents/out-of-band-human-file-modifications/knowledge/VULN-REPORT.md
  - >-
    .haiku/intents/out-of-band-human-file-modifications/knowledge/DESIGN-DECISIONS.md
  - >-
    .haiku/intents/out-of-band-human-file-modifications/knowledge/IMPLEMENTATION-MAP.md
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/silent-filesystem-drop-detection.feature
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/agent-writes-on-behalf-of-human.feature
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/manual-change-assessment.feature
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/explicit-spa-upload.feature
  - >-
    .haiku/intents/out-of-band-human-file-modifications/features/drift-assessment-visibility.feature
outputs:
  - >-
    .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md
  - >-
    .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md
  - stages/security/artifacts/ASSESSMENTS.md
  - stages/security/artifacts/THREAT-MODEL.md
  - stages/security/artifacts/SECURITY-CONTROLS-VERIFICATION.md
  - stages/security/artifacts/RED-TEAM-VERIFICATION.md
  - stages/security/artifacts/BLUE-TEAM-VERIFICATION.md
  - stages/security/artifacts/verify-prose-claims-attack-replay.sh
  - stages/security/artifacts/verify-prose-claims.sh
model: sonnet
quality_gates:
  - name: threat-model-exists
    command: >-
      test -f
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md
  - name: assessments-exists
    command: >-
      test -f
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md
  - name: threat-model-stride-six-categories
    command: >-
      bash -c 'for s in spoofing tampering repudiation "information disclosure"
      "denial of service" "elevation of privilege"; do grep -qiE "$s"
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md
      || { echo missing: $s; exit 1; }; done'
  - name: threat-model-trust-mode-boundary
    command: >-
      bash -c 'grep -qi "tunnel mode"
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md
      && grep -qi "loopback\|local mode"
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md
      && grep -qE "EPHEMERAL_SECRET|tun.*claim|sid.*claim"
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md'
  - name: threat-model-concurrency-model
    command: >-
      grep -qiE 'concurrency|eventual.consistency|locking'
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md
  - name: threat-model-enumerates-dependencies
    command: >-
      bash -c 'for d in fastify gray-matter opentelemetry jsonwebtoken; do grep
      -qi "$d"
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md
      || { echo missing: $d; exit 1; }; done'
  - name: threat-model-covers-each-feature
    command: >-
      bash -c 'for f in silent-filesystem-drop-detection
      agent-writes-on-behalf-of-human manual-change-assessment
      explicit-spa-upload drift-assessment-visibility; do grep -qE "$f"
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md
      || { echo missing: $f; exit 1; }; done'
  - name: threat-model-covers-classify-drift-and-guard-bypass
    command: >-
      bash -c 'grep -qE "haiku_classify_drift"
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md
      && grep -qE "guard-workflow-fields|PreToolUse.*bypass|Bash.*bypass"
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md'
  - name: assessments-cites-each-vuln
    command: >-
      bash -c 'for v in V-01 V-02 V-03 V-04 V-05 V-06 V-07 V-08 V-09 V-10 V-11;
      do grep -qE "$v\\b"
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md
      || { echo missing: $v; exit 1; }; done'
  - name: assessments-cites-each-fix-unit
    command: >-
      bash -c 'for u in unit-01-upload-content-validation
      unit-02-author-identity-binding unit-03-symlink-toctou-and-csrf; do grep
      -qE "$u"
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md
      || { echo missing: $u; exit 1; }; done'
  - name: assessments-records-deferred-residual-risks
    command: >-
      bash -c 'for r in "serve-side hardening" "audit-log hash-chain" "rate
      limit" "O_NOFOLLOW" "sandboxed sub-origin"; do grep -qiE "$r"
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md
      || { echo missing residual risk: $r; exit 1; }; done'
  - name: assessments-has-gate-pass-evidence-column
    command: >-
      grep -qiE
      'gate_pass_evidence|gate.*evidence|exit.code.*at.*time|verified.at.commit'
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md
  - name: no-vague-mitigation-statements
    command: >-
      bash -c '! grep -nE "^- *(improve security|harden|review|investigate)$"
      .haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md'
status: completed
bolt: 1
hat: blue-team
started_at: '2026-05-03T08:52:23Z'
hat_started_at: '2026-05-03T09:17:44Z'
iterations:
  - hat: threat-modeler
    started_at: '2026-05-03T08:52:23Z'
    completed_at: '2026-05-03T09:06:07Z'
    result: advance
  - hat: security-engineer
    started_at: '2026-05-03T09:06:07Z'
    completed_at: '2026-05-03T09:11:14Z'
    result: advance
  - hat: security-reviewer
    started_at: '2026-05-03T09:11:14Z'
    completed_at: '2026-05-03T09:12:21Z'
    result: advance
  - hat: red-team
    started_at: '2026-05-03T09:12:21Z'
    completed_at: '2026-05-03T09:17:44Z'
    result: advance
  - hat: blue-team
    started_at: '2026-05-03T09:17:44Z'
    completed_at: '2026-05-03T09:33:47Z'
    result: advance
completed_at: '2026-05-03T09:33:47Z'
---
# Unit 04 — Threat model + assessments + deferred-risk register

## Scope

Author the two synthesis artifacts the security stage owes:

1. **THREAT-MODEL.md** — STRIDE-based threat enumeration. MUST cover the trust-mode boundary (local vs tunnel), concurrency model (eventual-consistency), third-party dependencies (`@fastify/multipart`, `gray-matter`, `@opentelemetry/*`, `jsonwebtoken`), all five entry-point features, plus `haiku_classify_drift` as its own MCP-tool entry point and the `guard-workflow-fields` PreToolUse-bypass class (drift gate is the compensating control).

2. **ASSESSMENTS.md** — links each of the 11 VULN-REPORT findings to its addressing unit, includes a `gate_pass_evidence:` column (commit SHA + run timestamp + exit code where the gate was last seen passing), AND records deferred residual risks per the triage decision.

## Trust-mode boundary (the load-bearing axis)

VULN-REPORT explicitly states the local-vs-tunnel mode distinction is the foundation for every severity rating: "If the THREAT-MODEL artifact concludes the tunnel-mode trust boundary is weaker than assumed... every Medium and High severity here may need to be revised upward." The threat model MUST:

- Name the local mode (loopback, fully trusted) and tunnel mode (JWT-bound, attacker-reachable) as distinct trust regions.
- Document the `EPHEMERAL_SECRET` lifecycle — when generated, when rotated, what its lifetime is, what happens on rotation.
- Document the JWT `tun` and `sid` claim semantics — what each binds to and what an attacker can/can't forge.
- Include the consequence rule: if any of these assumptions weaken, every V-NN severity gets re-rated.

## Concurrency model

Eventual-consistency is load-bearing for V-04 (TOCTOU symlink) and V-05 (tick-counter determinism). The threat model MUST either:
- (a) Confirm eventual-consistency is the design and accept residual TOCTOU window from V-04, OR
- (b) Propose a locking primitive and document how unit-03's V-04 fix integrates with it.

## Feature coverage (STRIDE rows mapped to entry points)

Each STRIDE category MUST have at least one threat row mapped to a named entry-point feature:
- `silent-filesystem-drop-detection.feature` — drift gate trust boundary; baseline corruption (V-11), silent-establish migration.
- `agent-writes-on-behalf-of-human.feature` — `haiku_human_write` author-attribution boundary; V-03, V-04, V-05.
- `manual-change-assessment.feature` — `haiku_classify_drift` write surface; V-09 (rationale fields), V-10 (feedback bodies).
- `explicit-spa-upload.feature` — SPA upload entry points; V-01, V-02, V-06, V-07, V-08.
- `drift-assessment-visibility.feature` — SPA assessment-rendering surface; V-01/V-02 reflected XSS landing here, plus V-10 unsanitized feedback rendering.

Plus an explicit row for the `guard-workflow-fields` PreToolUse-bypass class: agent uses Bash to write workflow-managed files, bypassing PreToolUse; `silent-filesystem-drop-detection` is the compensating control; residual risk if drift-detection kill-switch is enabled.

## Dependency enumeration

THREAT-MODEL.md MUST enumerate per-dependency threats for at least:
- `@fastify/multipart` — parser confusion, decompression bomb, slowloris.
- `gray-matter` — YAML deserialization, prototype pollution.
- `@opentelemetry/*` — outbound exfiltration, PII leak.
- `jsonwebtoken` — alg-confusion, key-confusion via `EPHEMERAL_SECRET` rotation.

## Deferred residual risks (triage decision — record as `stage_revisit` FBs)

The pre-execute review surfaced these as out-of-scope for this stage's iteration. ASSESSMENTS.md MUST record each as a residual risk with rationale AND file a `stage_revisit` FB pre-tagged for a follow-up security iteration:

1. **Serve-side hardening (V-01/V-02 fix #2/#3)** — invert `serveFile` MIME map; add CSP + sandbox headers + `Content-Disposition: attachment` for non-image/PDF; sandboxed sub-origin for stage-output HTML.
2. **Audit-log hash-chain (V-03 fix #3)** — `prev_hash` field on `write-audit.jsonl` / `action-log.jsonl`; tamper-detection on read.
3. **Rate limiting (mandate gap)** — per-IP rate limit on mutating tunnel-mode routes; per-session cap on `haiku_classify_drift`; cumulative-bytes-per-intent quota.
4. **Race-free `O_NOFOLLOW`-everywhere (V-04 fix #1, if not landed in unit-03)** — full `openat`/`renameat` migration vs the realpathSync fallback.
5. **Sandboxed sub-origin for stage-output mockups (V-02 follow-up)** — separate origin so HTML mockups can render but can't reach the main origin's cookies/storage.

For each deferred item, ASSESSMENTS.md includes: title, owning vuln(s), rationale for deferral, severity if unfixed, recommended target iteration, and the `stage_revisit` FB ID.

## Approach

Author both artifacts under `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/`. The threat model is the synthesis of the vuln report; ASSESSMENTS.md is the audit trail.

Per-finding ASSESSMENTS.md table columns: `vuln_id`, `severity`, `description`, `addressing_unit`, `gate_command`, `gate_pass_evidence` (commit SHA + run time + exit code), `residual_risk`. The author hat MUST execute each gate command at write time and capture its output before recording 'closed'.

## Depends_on

Frontmatter declares `depends_on: [unit-01-upload-content-validation, unit-02-author-identity-binding, unit-03-symlink-toctou-and-csrf]` so the workflow engine serializes this unit AFTER the fix units.

## References

- VULN-REPORT.md (the discovery)
- All four sibling units' specs
- Sibling features under `.haiku/intents/out-of-band-human-file-modifications/features/`
