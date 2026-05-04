---
title: >-
  Red-team: V-11 baseline gate bypassable via state.json tamper (3 confirmed
  bypasses)
status: rejected
origin: agent
author: agent
author_type: agent
created_at: '2026-05-03T02:59:40Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-05-03T02:59:40Z'
resolution: inline_fix
replies: []
---

Red-team probe (`packages/haiku/test/unit-03-red-team.test.mjs`, 33 attacks, full report at `stages/security/artifacts/unit-03/RED-TEAM-FINDINGS.md`) confirms V-04, V-08, V-10 mitigations are sound. V-11 has THREE confirmed bypasses (V-11.RT1, V-11.RT2, V-11.RT6) — all same root cause: the "previously established" / "thrash counter" signals live on tamper-mutable JSON files (`state.json`, `baseline-thrash.json`).

The unit-03 threat model is out-of-band file modification. An attacker who can corrupt `baseline.json` (the V-11 attack primitive) can ALSO delete `state.json` or just the `drift_baseline_established_at` field — both are unprotected on-disk JSON. With the field gone, the gate reports "first-tick" and silently establishes attacker content. Same delete trick works on `baseline-thrash.json` to reset the circuit breaker.

**Severity:** MED (V-11 mitigation incomplete against its own threat model)

**Recommended remediation (unit-04 ASSESSMENTS.md residual or unit-05 follow-up):**
- Re-anchor `wasBaselinePreviouslyEstablished` on append-only `action-log.jsonl` (look for `entry_type: "baseline_established"`) instead of `state.json` field.
- Re-anchor thrash counter on action-log entries (`entry_type: "baseline_corruption_event"`).
- Optional hardening: HMAC the action log with a key in `~/.haiku/secret` so OOB tampering is detectable.
- Treat unexpected absence of `state.json` for an active stage as a tamper indicator (fail-closed).

8 lower-severity residuals (V-10 sanitizer scope gaps, V-11 ack-marker permissiveness, action-log path injection in reconstruction) also documented in RED-TEAM-FINDINGS.md for downstream awareness — none are blocking but worth tracking.

V-04, V-08, V-10 sound; V-11 mitigation needs follow-up to fully close its threat model.</body>
<origin>adversarial-review</origin>
<resolution>stage_revisit</resolution>
<source_ref>unit-03 red-team / RED-TEAM-FINDINGS.md</source_ref>
</invoke>

---

**Rejection reason:** V-11 (baseline gate bypass) is unit-03's threat-model territory, not unit-01's V-01/V-02/V-07/V-09 scope. Unit-01 is bounded to upload content validation (MIME/extension allowlist + size cap + rationale caps). The V-11 finding is real and remains tracked in unit-03 scope (unit-03's spec explicitly lists V-11 as one of its four findings to close — see stages/security/units/unit-03-symlink-toctou-and-csrf.md §V-11 mitigation). Unit-04 ASSESSMENTS.md will additionally file a follow-up FB for any residual V-11 risk after unit-03's operator-only ack mitigation lands. Closing this FB on the unit-01 fix-loop would falsely claim closure; rejecting with this rationale prevents unit-01 from blocking on a finding outside its scope while preserving the V-11 work in unit-03's plan-of-record.
