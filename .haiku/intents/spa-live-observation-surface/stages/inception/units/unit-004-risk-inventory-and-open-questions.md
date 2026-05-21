---
title: Risk inventory and open questions
description: >-
  Enumerate the failure modes that make this feature easy to get wrong, plus the
  architectural choices that must be deferred to design, each with a proposed
  default for veto-style approval.
model: sonnet
outputs:
  - stages/inception/artifacts/risks-and-open-questions.md
iterations: []
reviews:
  spec:
    at: '2026-05-21T03:55:14.425Z'
    body_sha256: a610603c4992c10684a9b020d602880b8d2b6a46945f1922ccf21cabd5f0c8f1
    input_witnesses:
      files:
        intent.md: f5cf11b098b96775bcb240f072fb65fd76fef74eeaba5147146900fed1477e35
      dirs: {}
  continuity:
    at: '2026-05-21T03:55:28.688Z'
    body_sha256: a610603c4992c10684a9b020d602880b8d2b6a46945f1922ccf21cabd5f0c8f1
    input_witnesses:
      files:
        intent.md: f5cf11b098b96775bcb240f072fb65fd76fef74eeaba5147146900fed1477e35
      dirs: {}
approvals: {}
---
## Topic

Surface the risks that make live observation easy to ship badly, and the open architectural questions design must resolve. This unit protects the downstream stages from sinking effort into a dead-end and gives the human a veto point on the choices that matter.

## What the artifact must cover

A risk inventory and an open-questions register. Known risks to capture (extend as research warrants), each with severity (low/med/high), a detection signal, and a mitigation surface:

- View jumps / lost state on update — high. If reconciliation drops scroll position, expanded cards, selection, or in-flight feedback text, reviewers disable the surface faster than they enabled it.
- Reviewer feedback lost on live re-render — the composer draft racing a session refresh.
- State divergence between the push event and the subsequent state pull — a stale-cache window briefly showing inconsistent state.
- Branch-overlap risk: the in-flight `out-of-band-human-file-modifications` intent is modifying the same review-page shell, session wire schema, and session-API surface this feature touches. Capture it as a merge-order/coordination risk, not a blocker.

Open questions — each MUST carry a proposed default for veto-style approval OR a `(needs human escalation)` flag (these are design-stage decisions; do not resolve them here):

- Reconciliation granularity: full session refetch per tick vs server-pushed diffs.
- Toast deduplication / batching when multiple outputs land in one tick.
- Non-blocking behavior-change sync surface: which tool descriptions and prompts assert the old blocking behavior of `haiku_review_open` and must be re-audited when it goes non-blocking.
- Sort-order preservation during a session vs dynamic re-sort that risks scroll surprise.

## Completion criteria

- Risk inventory lists ≥5 distinct failure modes, each with severity (low/med/high) and a detection signal.
- Branch-overlap with `out-of-band-human-file-modifications` is named explicitly, with the specific overlapping surfaces and a coordination/merge-order mitigation — framed as a risk, not a rejection.
- Open-questions section lists every deferred architectural choice; each entry has either a proposed default (stated in one sentence) for veto approval OR an explicit `(needs human escalation)` flag.
- No open question is actually a hard blocker dressed as a defer-later item; any true gate is escalated, not parked.
- Risks are framed as problem-space concerns; mitigations name a *surface* to address (e.g. "isolate composer state from the session payload") without prescribing the implementation.
