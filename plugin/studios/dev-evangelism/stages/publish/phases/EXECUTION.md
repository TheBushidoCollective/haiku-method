# Publish Stage — Execution

## Per-unit baton (`distributor → community-manager → verifier`)

Every publish unit walks the three hats in order. Units here are channel deployments — one per channel-asset pair, or per channel cluster — each adapting the asset to a specific channel and recording the publish artifact.

1. **`distributor` (plan / do for the publish):** Reads `CONTENT-PACKAGE.md` and the audience landscape's channel categories. Confirms the channel plan (channel categories per asset, specific channels from the project overlay, tracking instrumentation, canonical URL strategy, sequencing). Adapts the asset to each channel — headline, lead, metadata, tags, format-specific shape. Runs the publish action. Records the row: UTC ISO 8601 timestamp, channel + specific channel name, asset reference, URL, adaptation summary, tracking-active confirmation, initial 24-48h engagement snapshot.
2. **`community-manager` (do for seeding):** Reads the distributor's rows. Seeds discussion in the relevant community categories (developer Q&A forums, code-host social, technical chat communities, discussion boards, newsletters, conference channels, internal communities). Posts with substance — answers, follow-up questions, threading into existing discussion — not as broadcast. Monitors the first 24-48 hours, responds in developer voice, surfaces follow-ups to the unit body so the measure stage's feedback-synthesizer can categorize them later.
3. **`verifier` (verify):** Reads the unit body and `DISTRIBUTION-LOG.md`. Validates publish-row completeness, tracking-active confirmation, adaptation-evidence, and community-seeding evidence. Advances or rejects to the responsible hat. Body-only.

The baton is the distribution record evolving on disk: content package (input) → channel-adapted publishes with tracking live (distributor) → seeded community threads with monitoring log (community-manager) → validated distribution log (verifier).

## After execute completes

When every unit's hat chain has terminal-advanced, the workflow engine moves the stage from `execute` into `review`:

1. **Spec review (engine phase)** — Universal hard gate against the intent's spec.
2. **Quality review (parallel)** — The stage's `reach` review agent fires (plus any studio-level review agents).
3. **Fix loop (if any feedback opens)** — `fix_hats: [classifier, distributor, feedback-assessor]` dispatches against each open feedback. The classifier routes; `distributor` is the implementer (re-running the publish or updating the row); the assessor decides closure.
4. **Gate** — The stage's gate is `auto`. Human approval already happened at the create gate, so publish advances on its own once the verifier confirms every distribution row is complete and tracking is live.

## Reviewer guidance specific to this stage

- **Identical cross-post with no adaptation row** is the highest-frequency finding — channel adaptation is the contract, not optional
- **Tracking added after publish** means attribution is broken for the early engagement window; route back, fix, re-publish if necessary
- **Initial engagement snapshot fabricated** rather than marked `(pending)` corrupts the measure stage's baseline; reject the row
- **Canonical URL pointing at the wrong source** silently kills SEO for the primary asset
- **Community seeding logged without monitoring evidence** means the manager broadcast and left; the contract is presence through the first wave
