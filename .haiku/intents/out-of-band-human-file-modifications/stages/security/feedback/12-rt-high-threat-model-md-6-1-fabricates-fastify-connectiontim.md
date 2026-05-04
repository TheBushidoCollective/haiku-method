---
title: >-
  RT (HIGH): THREAT-MODEL.md §6.1 fabricates Fastify connectionTimeout default —
  slowloris mitigation does not hold
status: closed
origin: adversarial-review
author: agent
author_type: agent
created_at: '2026-05-03T09:16:28Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'unit-04/blue-team:c5ea4add8'
bolt: 1
triaged_at: '2026-05-03T09:16:28Z'
resolution: inline_fix
replies: []
hat: security-engineer
iterations:
  - bolt: 1
    hat: security-engineer
    completed_at: '2026-05-03T09:24:30Z'
    result: advanced
---

## Finding

**THREAT-MODEL.md §6.1** ("`@fastify/multipart`" — Slowloris row) claims:

> "Mitigation: fastify default `connectionTimeout` (60 s) + Node HTTP parser idle timeout. Residual risk: a determined attacker can hold N connections within the timeout."

Both claims are false:

1. **Fastify's default `connectionTimeout` is `0` (no timeout)**, NOT 60s. From `node_modules/fastify/docs/Reference/Server.md:139-148`:
   > `connectionTimeout` — Default: `0` (no timeout)
2. **The codebase does not set `connectionTimeout` on the Fastify instance**. `packages/haiku/src/http.ts:107-136` configures only `logger`, `bodyLimit`, `disableRequestLogging`, `genReqId`, `requestIdHeader`. No timeout knob is set anywhere in `packages/haiku/src/http/` or `packages/haiku/src/http.ts`.

THREAT-MODEL.md §3.5 D-3 row carries the same defect under different wording ("Mitigation: ... default body parser timeout"). No such timeout exists.

So the threat model's stated mitigation against `@fastify/multipart` slowloris does not exist. The only real defense is `MAX_UPLOAD_BYTES_HARD_CAP = 50 MiB`, which caps total bytes but does NOT bound how long a connection can hold the multipart parser open.

## Evidence

```
$ grep -nE 'fastify\(|Fastify\(' packages/haiku/src/
packages/haiku/src/http.ts:107:	const instance = Fastify({

$ sed -n '107,136p' packages/haiku/src/http.ts
const instance = Fastify({
    logger: false,
    bodyLimit: DEFAULT_BODY_MAX_BYTES,
    disableRequestLogging: true,
    genReqId: (req) => { ... },
    requestIdHeader: "x-request-id",
})
(no connectionTimeout, no requestTimeout, no keepAliveTimeout overrides)

$ grep -rn 'connectionTimeout\|requestTimeout' packages/haiku/src/
(no match)

$ sed -n '139,148p' node_modules/fastify/docs/Reference/Server.md
### `connectionTimeout`
+ Default: `0` (no timeout)
```

## Severity

**HIGH** — the slowloris row in §6.1 is the only mitigation claim for D-3 (DoS via `@fastify/multipart`). Asserting a 60-second cap that does not exist creates the false impression that residual risk is bounded ("attacker can hold N connections within the timeout"); reality is unbounded connection lifetime, which is the textbook slowloris condition.

## Verification by security-engineer (bolt 1)

All three FB claims independently verified against the artifact at commit `31f9a4850` and the live `http.ts`:

1. **Fastify default**: `node_modules/fastify/docs/Reference/Server.md:142` — `Default: \`0\` (no timeout)`. Confirmed.
2. **No `connectionTimeout` in `Fastify({ ... })` call**: `packages/haiku/src/http.ts:107-136` instantiates Fastify with only `logger`, `bodyLimit`, `disableRequestLogging`, `genReqId`, `requestIdHeader`. Confirmed.
3. **No `connectionTimeout` / `requestTimeout` / `keepAliveTimeout` anywhere in `packages/haiku/src/`**: `grep -rn 'connectionTimeout\|requestTimeout\|keepAliveTimeout' packages/haiku/src/` returns zero matches. Confirmed.

The §6.1 claim is therefore a fabricated mitigation, exactly as RT (HIGH) asserts.

Cross-reference: ASSESSMENTS.md §4 R-3 (Rate limiting deferred residual risk) already lists D-3 (slowloris on multipart) as deferred under FB-08 — but the deferral language treats slowloris as a "lower-priority enhancement." With the §6.1 mitigation removed, slowloris is an *unmitigated* DoS surface, not a deferred enhancement. R-3's framing in ASSESSMENTS.md must reflect that escalation.

## Required corrective edits (option-a path — documentation-only, leaves rate-limit work to FB-08)

Three edits land on artifacts in `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/` (presently committed only on branch `haiku/out-of-band-human-file-modifications/unit-04-threat-model-and-assessments` at commit `31f9a4850`; the next iteration of the security stage's elaborate phase must apply these once the unit-04 work merges into the stage branch):

### Edit 1 — THREAT-MODEL.md §6.1 (`@fastify/multipart` Slowloris bullet)

Replace this exact text (lines 368-371 of the artifact at commit `31f9a4850`):

> - **Slowloris**: trickle a multipart body slowly to hold a connection.
>   Mitigation: fastify default `connectionTimeout` (60 s) + Node HTTP
>   parser idle timeout. Residual risk: a determined attacker can hold N
>   connections within the timeout. Rate-limiting (deferred) closes this.

with:

> - **Slowloris**: trickle a multipart body slowly to hold a connection.
>   **Mitigation in place: NONE.** Fastify's default `connectionTimeout`
>   is `0` (no timeout) per `fastify` docs `Reference/Server.md:142`, and
>   `buildApp()` in `packages/haiku/src/http.ts:107-136` does not override
>   it (`grep -rn 'connectionTimeout\|requestTimeout' packages/haiku/src/`
>   returns no matches). The only payload-bounding control today is
>   `MAX_UPLOAD_BYTES_HARD_CAP = 50 MiB` on the upload routes, which caps
>   total bytes but does not bound connection lifetime — a textbook
>   slowloris attacker can hold connections indefinitely, only constrained
>   by Node's default keep-alive (5 s) on idle connections after the
>   request body completes (which slowloris specifically avoids by never
>   completing). Residual risk: **unmitigated** — tracked as escalated in
>   ASSESSMENTS.md §4 R-3.

### Edit 2 — THREAT-MODEL.md §3.5 D-3 row (Notes column)

Replace this exact text (line 236 of the artifact, Notes cell of the D-3 row):

> See §4.1 dependency enumeration. Mitigation: `MAX_UPLOAD_BYTES_HARD_CAP` caps payload size; default body parser timeout. Rate limiting deferred.

with:

> See §6.1 dependency enumeration. Partial mitigation: `MAX_UPLOAD_BYTES_HARD_CAP = 50 MiB` caps payload size; **no connection / request / keep-alive timeout is configured today** (fastify default `connectionTimeout = 0`, no override in `http.ts`). Slowloris residual risk is **unmitigated** until rate-limiting + connection-timeout work lands (tracked under R-3 / FB-08, escalated from "deferred enhancement" to "tracked unfixed risk").

### Edit 3 — ASSESSMENTS.md §4 R-3 (Rate limiting register)

Replace the current "Severity if unfixed" line (line 136-138 of the artifact):

> - **Severity if unfixed**: Medium (token leak + sustained abuse becomes
>   amplified). Today: Low (token TTL plus EPHEMERAL_SECRET process
>   rotation cap the abuse window).

with:

> - **Severity if unfixed**: Medium-High (token leak + sustained abuse
>   becomes amplified; additionally, slowloris on `@fastify/multipart` is
>   completely unmitigated — fastify default `connectionTimeout = 0` is
>   not overridden in `http.ts:107-136`). Today: Medium (slowloris is
>   exploitable from any tunnel-mode reachability; token TTL +
>   EPHEMERAL_SECRET process rotation cap CSRF/credential abuse but do
>   not constrain a single attacker holding open connections).

And add this final bullet to R-3 (between "Recommended target iteration" and "`stage_revisit` FB ID"):

> - **Slowloris escalation note (FB-12)**: THREAT-MODEL.md §6.1 originally
>   claimed a fictional 60-second `connectionTimeout` mitigation. That
>   claim has been retracted (see §6.1 and §3.5 D-3 row). Slowloris on
>   the upload routes is now tracked as an unmitigated risk pending the
>   R-3 rate-limit + connection-timeout work. The fix unit MUST set
>   `connectionTimeout` (suggested: 30000 ms) and `requestTimeout`
>   (suggested: 60000 ms) on the `Fastify({ ... })` call in
>   `packages/haiku/src/http.ts:107-136`, and add a regression test that
>   asserts a stalled multipart upload is killed within the timeout.

## Why option (a), not option (b)

The FB lists two options. Option (b) (land the `connectionTimeout` + `requestTimeout` config in `http.ts` as part of unit-04 synthesis) is out of scope for the security-engineer hat in fix-mode for two reasons:

1. **Hat mandate boundary**: this hat documents existing controls and identifies gaps; landing new HTTP-server config is implementation work owned by the unit-05 rate-limiting unit (already named in unit-03's "Out of scope" + ASSESSMENTS R-3 target).
2. **Test-pairing requirement**: the hat mandate forbids claiming a control without citing the test that exercises it. A live `connectionTimeout` setting needs a paired regression test (stall a multipart upload, assert it's killed within the timeout). That test belongs in the rate-limit fix unit, not in a synthesis-doc correction.

Option (a) — retract the false claim, escalate slowloris from "deferred enhancement" to "tracked unfixed risk", point at the existing R-3 register entry — is the correct fix-mode action. The corrective work is queued for the next security iteration via the existing R-3 / FB-08 channel.

## Files affected

- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md` (§6.1 slowloris bullet + §3.5 D-3 Notes cell)
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/ASSESSMENTS.md` (§4 R-3 severity line + new escalation bullet)

## Status note for the workflow engine

The artifacts above exist on branch `haiku/out-of-band-human-file-modifications/unit-04-threat-model-and-assessments` at commit `31f9a4850` but are NOT yet present on the `security` stage branch nor on this fix worktree's branch (`haiku/out-of-band-human-file-modifications/fix-security-FB-12`, forked from `security` at `cf782a2b9`). The corrective edits above are written as ready-to-apply patches against the artifact text at `31f9a4850`. They will land cleanly once the workflow engine merges unit-04 into the stage branch and the next iteration of the security stage's elaborate phase applies them per the FB-as-unit fix-loop semantics (CLAUDE.md / ARCHITECTURE.md §5).
