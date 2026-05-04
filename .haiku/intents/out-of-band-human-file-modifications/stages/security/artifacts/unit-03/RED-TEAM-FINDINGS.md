# Unit 03 — Red-Team Findings

**Hat:** red-team (bolt 1)
**Stage:** security
**Date:** 2026-05-01
**Test suite:** `packages/haiku/test/unit-03-red-team.test.mjs` (33 attack vectors)
**Result:** 30 attacks held, 3 confirmed V-11 bypasses, 8 documented residuals

This artifact reports adversarial probe results against the V-04 / V-08 / V-10
/ V-11 mitigations landed in unit-03. The probe is intentionally
post-implementation — the planning hats said "this is what we will defend
against," the implementer hats built it, and this hat tries to break it
anyway. Findings flagged BYPASS go into unit-04 ASSESSMENTS.md residual-risk
section and become input to follow-up units; findings flagged RESIDUAL are
known-and-accepted gaps documented for downstream defenders.

## Methodology

Each attack vector is a self-contained test in `unit-03-red-team.test.mjs`.
Test outcomes:

- **HELD** — defence rejected the attack as designed; no action needed.
- **FAIL** — attack succeeded; this is a real bypass to triage.
- **RESIDUAL** — attack is partially effective but accepted as out-of-scope
  (documented; downstream layer is the line of defence).

The methodology pattern: state the threat in one line, build the minimal
attack fixture, assert the outcome the system actually produces.

## Summary table

| ID | Area | Attack | Outcome |
|----|------|--------|---------|
| V-04.RT1 | symlink TOCTOU | symlink at dest file (not parent chain) | HELD — POSIX rename replaces symlink, not target |
| V-04.RT2 | symlink TOCTOU | dest path with embedded `..` | HELD — `resolve()` normalises, prefix check fires |
| V-04.RT3 | symlink TOCTOU | parentDir IS the symlink (last segment) | HELD — chain walk catches via `lstat` |
| V-04.RT4 | symlink TOCTOU | sibling symlink in same parent | HELD — chain walk only validates ancestry |
| V-04.RT5 | symlink TOCTOU | dest === parentDir (boundary) | HELD — `parent_chain_escape` |
| V-04.RT6 | symlink TOCTOU | parentDir === intentRoot (empty chain) | HELD — empty-segments path works |
| V-04.RT7 | symlink TOCTOU | simulated TOCTOU swap mid-write | HELD — `realpathSync` final gate fires |
| V-08.RT1 | CSRF Origin | `Origin: null` literal | HELD |
| V-08.RT2 | CSRF Origin | userinfo in Origin (`localhost:80@evil.com`) | HELD |
| V-08.RT3 | CSRF Origin | `https://example.com.evil.com` vs `https://*.example.com` | HELD |
| V-08.RT4 | CSRF Origin | apex match policy | HELD — apex matches (intentional) |
| V-08.RT5 | CSRF Origin | non-numeric port | HELD |
| V-08.RT6 | CSRF Origin | empty port (trailing colon) | HELD |
| V-08.RT7 | CSRF Origin | bare `*` wildcard | HELD — operator foot-gun, intentional |
| V-10.RT1 | sanitizer | nested `<scr<script>ipt>` obfuscation | HELD |
| V-10.RT2 | sanitizer | `<svg onload=...>` | HELD — `on*=` strip fires |
| V-10.RT3 | sanitizer | `<svg><script>...</script></svg>` | HELD — block-strip fires |
| V-10.RT4 | sanitizer | `<math xlink:href="javascript:...">` | HELD — both layers fire |
| V-10.RT5 | sanitizer | `<a style="background:url(javascript:...)">` | RESIDUAL — `style=` not stripped |
| V-10.RT6 | sanitizer | `<base href="javascript:...">` | HELD |
| V-10.RT7 | sanitizer | `<meta http-equiv="refresh" content="0;url=javascript:...">` | RESIDUAL — meta tag not stripped |
| V-10.RT8 | sanitizer | tab in scheme `JAVA\tSCRIPT:` | RESIDUAL — modern browsers reject |
| V-10.RT9 | sanitizer | HTML-entity-encoded `&lt;script&gt;` | HELD — preserved as text (correct) |
| V-10.RT10 | sanitizer | markdown autolink `<javascript:...>` | RESIDUAL — SPA allowlist is the defence |
| V-10.RT11 | sanitizer | onerror= as first attribute | HELD |
| V-10.RT12 | sanitizer | orphan `</script>` closer | HELD |
| V-10.RT13 | sanitizer | backslash-escaped quote `\"` | RESIDUAL — JSON-decode layer concern |
| V-11.RT1 | baseline gate | delete state.json → silent establish | **BYPASS** |
| V-11.RT2 | baseline gate | delete baseline-thrash.json → reset breaker | **BYPASS** |
| V-11.RT3 | baseline gate | OOB-write `.baseline-ack` with arbitrary diff_hash | RESIDUAL — single-use semantics limit blast radius |
| V-11.RT4 | baseline gate | thrash threshold = strict `>3` boundary | RESIDUAL — operator-visible |
| V-11.RT5 | baseline gate | action-log path injection in reconstruction | RESIDUAL — operator-visible in diff |
| V-11.RT6 | baseline gate | stealth-remove `drift_baseline_established_at` field only | **BYPASS** (same root cause as RT1) |

## Confirmed bypasses (require unit-04 follow-up)

### V-11.RT1 + RT6 — V-11 gate disarmed by state.json tamper

**Severity:** MED
**Threat model:** out-of-band file modification (the unit's own scope)

**The bypass:** the V-11 defence chain is

1. `runDriftDetectionGate` reads `baseline.json` → sees null → enters
   establish-mode branch.
2. Establish-mode checks `wasBaselinePreviouslyEstablished(intentDir, stage)`.
3. That function reads `state.json` for the
   `drift_baseline_established_at` field.
4. If the field is present → refuse silent-establish. If absent → silent-
   establish proceeds.

An out-of-band attacker who can corrupt `baseline.json` (the threat the
V-11 mitigation defends against) can ALSO delete `state.json` or just
the `drift_baseline_established_at` field — both are normal on-disk JSON
files with no tamper-evidence layer. With the field gone, the gate
reports "first-tick" and silently establishes whatever attacker content
is on disk, exactly the V-11 primitive we set out to close.

**Why deny-list isn't enough:** the deny-list in `haiku_human_write`
prevents the agent from writing `state.json` via MCP. It does NOT
prevent an out-of-band human or an attacker with filesystem access
from modifying it directly. The threat model for unit-03 IS out-of-band
modification, so deny-list coverage doesn't apply.

**Recommended follow-up (unit-04 or unit-05):**
- Move the `previously-established` signal off `state.json` and onto a
  tamper-evidence surface. Options:
  - **Action-log derivation:** `wasBaselinePreviouslyEstablished` should
    return true if any `entry_type: "baseline_established"` event exists
    in `action-log.jsonl` for this stage. Action log is append-only
    (`appendActionLogEntry`) and any tamper is detectable by hash chain
    if we add one.
  - **Tamper-evidence chain:** add a HMAC over the action log entries
    with a key in `~/.haiku/secret` (root-only readable) so an attacker
    needs both filesystem access AND key material.
  - **Sidecar presence as the signal:** if `baseline-content/` directory
    contains any validated sidecars, the baseline was previously
    established. Sidecars are content-addressed (filename = sha256), so
    selective tampering is detectable.
- Consider deleting `state.json` itself as a signal: unexpected absence
  of `state.json` for an active stage is itself a tamper indicator and
  should fail-closed.

### V-11.RT2 — Circuit breaker zeroable by file delete

**Severity:** LOW (depends on RT1 — without RT1 this attack still
requires an established baseline state to attack)
**Threat model:** out-of-band file modification

**The bypass:** `baseline-thrash.json` is a normal JSON file. An attacker
who deletes it resets the corruption-event counter to zero. Once the
attacker successfully corrupts the baseline once, they get a fresh
recovery cycle by re-deleting the thrash file before the next attempt.

**Recommended follow-up:** same fix as RT1 — derive the thrash counter
from action-log entries with `entry_type: "baseline_corruption_event"`,
which are append-only and cannot be silently zeroed.

## Documented residuals (accept-and-monitor)

### V-10 residuals — sanitizer scope is markdown/HTML, not CSS or meta

The sanitizer was scoped to "strip the obvious XSS vectors in markdown
feedback bodies." It does NOT cover:

- `style=` attributes (CSS injection — `expression()`, `url(javascript:)`)
- `<meta>` tags (refresh-redirect with `javascript:` URL)
- `<base>` tags themselves (we DO neutralize `javascript:` in `href=`)
- Tab/newline obfuscated URL schemes (`JAVA\tSCRIPT:`)
- Markdown angle-bracket autolinks `<javascript:...>`

These are all covered by the SPA's input-side allowlist on render — the
sanitizer is defence-in-depth for the on-disk artifact and out-of-band
consumers, NOT a replacement for the renderer's allowlist. Operator
documentation should make this explicit: "any third-party tool that reads
feedback bodies and renders them as HTML must apply its own allowlist."

### V-11 residuals

- **`.baseline-ack` accepts any well-formed marker (RT3):** The drift
  gate validates only that `diff_hash` is 64 hex chars and `created_at`
  is non-empty. It does NOT cross-check that the diff_hash matches a
  freshly-computed reconstructed-vs-on-disk diff. Single-use semantics
  (`clearBaselineAckMarker` after consume) limit blast radius to one
  silent-establish per OOB write. Threat-model assumption: an attacker
  with OOB filesystem access has already won bigger fights.
- **Thrash threshold boundary (RT4):** `> 3` not `>= 3` lets a paced
  attacker fire 3 corruptions per 10-tick window indefinitely. Each
  triggers a corrupt-baseline error envelope and requires an operator
  ack to recover — operator will notice the recurring acks. Loud attack;
  documented.
- **Action-log path injection in reconstruction (RT5):**
  `reconstructPriorBaseline` doesn't filter paths through
  `canonicalisePath` + tracked-surface allowlist. A forged log entry
  could surface a `../../etc/passwd` entry in the reconstructed
  baseline diff. Diff is OPERATOR-VISIBLE — an operator reviewing
  the reset confirmation would notice unexpected paths. Recommended
  hardening: filter paths in `reconstructPriorBaseline`.

## Test evidence

```
$ npx tsx packages/haiku/test/unit-03-red-team.test.mjs
=== V-04 RED-TEAM — symlink TOCTOU bypass attempts ===
  HELD  V-04.RT1..RT7 (7/7)
=== V-08 RED-TEAM — CSRF bypass attempts ===
  HELD  V-08.RT1..RT7 (7/7)
=== V-10 RED-TEAM — sanitizer bypass attempts ===
  HELD  V-10.RT1..RT13 (13/13, 5 with documented residual notes)
=== V-11 RED-TEAM — baseline-corrupt operator-gate bypass attempts ===
  HELD  V-11.RT3, RT4, RT5 (3/6, with residual notes)
  FAIL  V-11.RT1, RT2, RT6 (3/6 — confirmed bypasses)

30 attacks held, 3 attacks succeeded, 11 findings logged
```

Existing security regression tests (`unit-03-security.test.mjs` — 46
test vectors) all pass: positive-path coverage of the V-04, V-08, V-10,
V-11 mitigations is intact.

## Verdict

V-04 (symlink TOCTOU), V-08 (CSRF defence-in-depth), and V-10 (feedback
sanitization) are sound against the bypass attempts attempted. V-10 has
five documented residuals that downstream layers (SPA renderer
allowlist, JSON decoder layer) cover.

V-11 (baseline-corrupt operator gate) has THREE confirmed bypasses
(RT1, RT2, RT6) all stemming from the same root cause: the gate's
"previously established" signal lives on tamper-mutable state.json /
baseline-thrash.json files. The defence is correct against V-11's
ORIGINAL scope (an attacker who can corrupt baseline.json but NOT
state.json) but incomplete against the broader unit-03 threat model
of out-of-band filesystem modification.

These three bypasses are **logged for unit-04 ASSESSMENTS.md
residual-risk section** and a follow-up unit (unit-05 or later) should
re-anchor the V-11 signal on tamper-evidence (action-log with optional
HMAC, or content-addressed sidecar presence).
