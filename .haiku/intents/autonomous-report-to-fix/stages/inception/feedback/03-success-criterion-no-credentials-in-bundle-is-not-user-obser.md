---
title: Success criterion "no credentials in bundle" is not user-observable
status: fixing
origin: adversarial-review
author: feasibility
author_type: agent
created_at: '2026-05-05T23:16:20Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-05-05T23:16:20Z'
resolution: null
replies: []
---

**Mandate area:** Success criteria must be measurable in user-observable terms.

**Finding:** The success criterion stated in `stages/inception/artifacts/success-criteria-and-acceptance-shape.md` reads:

> "The session bundle that leaves the user's machine contains no credentials, API keys, environment variables, absolute home paths (`/Users/…`), or other sensitive patterns — scrubbing happens before POST, not at rest."

This criterion is **not measurable in user-observable terms**. The user has no mechanism to independently verify that the bundle is clean before or after transmission. The scrubbing happens inside the plugin process; the user sees only the structural summary proposed in `open-questions-with-defaults.md` (unit-06: "session turn count, tool call count, subagent chain depth, and a count of each scrubbed data class"). That summary tells the user *how many* items were stripped, not whether any were missed.

A scrubbing false negative — a credential that passes through — is invisible to the user at submission time. The only "detection signal" named in the risk inventory (unit-05, "Risk: Scrubber False Negatives") is a post-transmission backend check: "a post-scrub bundle contains a string matching a known credential prefix." This check happens server-side, after the data has already left the user's machine. From the user's perspective the criterion is untestable.

**Why this matters at inception:** The feasibility mandate requires that success criteria be measurable in user-observable terms. This one is not — it is only verifiable by the backend (post-transmission) or by auditing the plugin source code. If the acceptance shape for the feature depends on a criterion the user cannot evaluate, the feature cannot be accepted in a user-observable way, which is a strategic viability problem: users must simply trust the scrubber rather than confirm the criterion.

**Recommended resolution:** Either (a) restate this criterion in terms of what the user *can* observe (e.g., "the user is shown a disclosure listing every data class stripped before POST, and can abort before transmission"), which aligns with the Option B consent UX proposed in unit-01 and unit-06 — converting the criterion from an internal correctness claim to an observable process claim; or (b) explicitly mark this criterion as an internal quality gate (not a user-facing acceptance criterion) and pair it with a separate, observable acceptance criterion covering the consent-and-disclosure step. The design stage cannot close this gap; it must be resolved at inception scope.

**Files:** `stages/inception/artifacts/success-criteria-and-acceptance-shape.md`, "Acceptance shape" table row "PR opened"; `stages/inception/artifacts/risk-inventory.md`, "Risk: Scrubber False Negatives" detection signal.
