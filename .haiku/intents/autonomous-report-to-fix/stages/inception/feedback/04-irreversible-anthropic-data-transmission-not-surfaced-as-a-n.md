---
title: >-
  Irreversible Anthropic data transmission not surfaced as a named strategic
  risk
status: pending
origin: adversarial-review
author: feasibility
author_type: agent
created_at: '2026-05-05T23:16:43Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 0
triaged_at: '2026-05-05T23:16:43Z'
resolution: null
replies: []
---

**Mandate area:** Highest-impact strategic risks must be surfaced — specifically including irreversibility.

**Finding:** The inception artifacts identify the Anthropic API as a single-vendor dependency risk (`risk-inventory.md`, "Risk: Anthropic API Single-Vendor Dependency") and briefly acknowledge that the scrubbed bundle is transmitted to Anthropic in the privacy artifact (`privacy-and-data-handling-principles.md`, "Retention and disclosure — Who can access the bundle"):

> "The Anthropic SDK call made by the fix agent on Cloud Run. The bundle is transmitted to the Anthropic API as part of the prompt context; this transmission falls under Anthropic's API data processing policy. This fact must be disclosed to the user at the point of consent."

However, **the irreversibility dimension of this transmission is not named as a strategic risk**. GigSmart's Cloud Run service can honor a user's deletion request for the stored bundle (within 7 days, per unit-04 proposed default). Anthropic cannot — the session bundle is consumed as model input, and Anthropic's API data retention and deletion policies are outside GigSmart's control entirely.

This is materially different from the storage risks the risk inventory covers:
- GigSmart Cloud Run retention: bounded (30-day default), deletable on request.
- Anthropic API transmission: **irreversible from GigSmart's side**. GigSmart cannot guarantee deletion from Anthropic's inference infrastructure on the user's behalf, cannot confirm whether the data is used for model training (depends on Anthropic's API tier/data agreement), and cannot audit what Anthropic retains.

**Why this matters at inception scope:** Irreversibility is explicitly in the feasibility mandate as a class of highest-impact strategic risk to surface. A user who submits a session bundle under the assumption that GigSmart will delete it within 30 days has no path to ensure the same deletion from Anthropic. This is not a design detail — it shapes:
1. The consent UX: the user must be informed about the Anthropic transmission *at consent time*, not in a privacy policy footnote.
2. The privacy policy language: the update must name Anthropic as a secondary recipient and describe its data handling terms.
3. The feature's regulatory posture under GDPR (right to erasure): GigSmart can fulfill a deletion request for its own stores, but cannot extend that fulfillment to Anthropic's infrastructure.

**The risk inventory entry "Anthropic API Single-Vendor Dependency" names availability and cost risks but not this irreversibility/compliance dimension.** No other risk entry in unit-05 covers it.

**Recommended resolution:** Add a named risk to the risk inventory for "Irreversible secondary transmission to Anthropic API" with severity rated at least high (the privacy policy compliance gap is critical; this is in the same compliance space). The consent step must name Anthropic explicitly as a data recipient, and the privacy policy update must specify that GigSmart cannot honor deletion requests for data already consumed by Anthropic inference endpoints.

**Files:** `stages/inception/artifacts/risk-inventory.md` (no entry for this risk); `stages/inception/artifacts/privacy-and-data-handling-principles.md`, "Retention and disclosure — Who can access the bundle" (acknowledges the transmission but does not name irreversibility); `stages/inception/artifacts/open-questions-with-defaults.md`, "Q: How long should the Cloud Run service retain the raw session bundle" (covers GigSmart retention only, silent on Anthropic).
