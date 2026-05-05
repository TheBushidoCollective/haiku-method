---
title: >-
  Feedback HTTP routes (POST/PUT/DELETE on /api/feedback/*) not enumerated as a
  distinct entry point
status: closed
origin: adversarial-review
author: threat-coverage
author_type: agent
created_at: '2026-05-03T11:06:00Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'deferred-to-followup-iteration:feedback-http-routes-threat-model-row'
bolt: 0
triaged_at: '2026-05-03T11:06:00Z'
resolution: stage_revisit
replies: []
---

## Finding

`packages/haiku/src/http/feedback-api.ts` registers six routes (read at lines 69, 144, 213, 238, 323, 413, 504) including mutating verbs that let SPA reviewers create / read / update / delete feedback items and replies:
- `POST /api/feedback/:intent/:stage` (create)
- `PUT /api/feedback/:intent/:stage/:feedbackId` (edit body)
- `DELETE /api/feedback/:intent/:stage/:feedbackId` (delete)
- `POST /api/feedback/:intent/:stage/:feedbackId/replies` (reply append)

THREAT-MODEL.md §3 STRIDE catalog and §4 per-feature attack-surface map do NOT enumerate these as a distinct entry-point. They get folded under `manual-change-assessment.feature` (which is about agent-side `haiku_classify_drift`-emitted `feedback_creates[]`) and `drift-assessment-visibility.feature` (which is about reviewer-side rendering). Neither feature names the SPA-side write surface.

## Why this is a threat-coverage gap

The mandate requires "threat model covers all entry points (APIs, webhooks, file uploads, user input)". Reviewer-authored feedback via the SPA is:
- A separate trust boundary from agent-authored feedback (reviewer JWT vs in-process MCP)
- A separate STRIDE row class:
  - **S** (Spoofing): can reviewer A edit reviewer B's feedback by knowing the FB ID?
  - **T** (Tampering): does PUT enforce the same `claimed_author_id` semantics V-03 closed for uploads, or does the reviewer-edit path bypass the rename?
  - **R** (Repudiation): does DELETE leave an audit-log trace, or silently remove the FB?
  - **I**: same XSS surface as V-10 — but does the V-10 sanitizer cover the PUT/POST-replies write paths, or only the agent-emitted `feedback_creates[]` path?
  - **D**: per-IP rate-limit story is the same as upload routes (uncharacterized — see related FB)
  - **E**: chains with V-08 CSRF — these are mutating routes covered by the global CSRF preHandler, but the threat-model treatment of CSRF (§3.6 E-1) only references "explicit-spa-upload.feature"; the feedback POST/PUT/DELETE routes are equally covered but not equally enumerated

The V-10 fix is described in §3.4 I-3 against `manual-change-assessment.feature` (agent-side surface). The actual disk write happens in `state-tools.ts` via `writeFeedbackFile` → `feedback-sanitize.ts`. That sanitizer chokepoint covers the SPA POST/PUT path too — but the threat model never names the SPA POST/PUT path as the surface being protected, so a reader cannot verify the sanitizer-call-site coverage.

## Required fix

Add an entry-point row to §4 per-feature attack-surface map. Recommended structure:

> ### 4.6. SPA feedback CRUD via `/api/feedback/:intent/:stage` (POST/PUT/DELETE) and `/replies` (POST)
> - **Trust boundary**: tunnel-mode reviewer (JWT-bearing) → feedback files via `state-tools.ts writeFeedbackFile` chokepoint
> - **Primary threats**: I-3 (stored XSS via reviewer-authored body, same class as agent-authored), R-N (silent-delete of FB without audit-log trace if applicable), S-N (reviewer A spoofs reviewer B's FB authorship)
> - **Closed**: V-10 sanitizer (same chokepoint covers both paths), V-08 CSRF (global preHandler covers all mutating routes including these)
> - **Deferred**: per-IP rate-limit (R-3); reviewer-identity binding (V-03 Option A — currently `claimed_author_id` is self-stamped on the SPA path the same way as uploads)

And add a corresponding row to §3 STRIDE catalog covering the reviewer-edit / reviewer-delete primitives — these are not symmetric with the upload routes (PUT is an update, DELETE is destructive) and deserve their own STRIDE treatment.

## Files

- `packages/haiku/src/http/feedback-api.ts:69,144,213,238,323,413,504` (the routes)
- `packages/haiku/src/http/feedback-sanitize.ts` (the V-10 sanitizer — same chokepoint)
- `packages/haiku/src/state-tools.ts` (`writeFeedbackFile`, `appendFeedbackReply`, `haiku_feedback_write` — the disk-write chokepoint named in ASSESSMENTS V-10 row)
- `.haiku/intents/out-of-band-human-file-modifications/stages/security/artifacts/THREAT-MODEL.md` §3, §4 (the gaps)
