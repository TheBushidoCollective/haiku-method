---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the publish covers the planned channels effectively — each asset is adapted per channel, tracking is live, and the initial engagement snapshot has a baseline the measure stage can compare against. Files feedback on any violation; does NOT re-execute publishes.

## Check

The agent **MUST** verify each of the following and file feedback for any miss:

- **Channel coverage matches plan** — every channel category the audience landscape identified as active for the target segments has a publish row in `DISTRIBUTION-LOG.md`, or an explicit skip-reason
- **Per-channel adaptation evidence** — every publish row has an adaptation summary (the headline used, the lead used, the platform-specific metadata applied); identical content across channels with no adaptation is a finding
- **Tracking active per channel** — every publish row confirms tracking / analytics / link instrumentation is live before the publish went wide; missing or post-hoc tracking is a finding
- **Canonical URL strategy** — for assets cross-posted to multiple written channels, the canonical URL is set so search engines don't deduplicate against the wrong source
- **Render verification** — for each channel, the published artifact's links, embeds, code blocks, and images render correctly in the channel's actual rendering pipeline (not just in preview)
- **Initial engagement snapshot present** — every publish row has either an initial 24-48h engagement snapshot or an explicit `(snapshot pending — measure stage to capture)` marker; invented numbers are a finding
- **Community seeding evidence** — every distributed asset has at least one seeded community thread tracked in the community-manager's response log, or an explicit reason none applies

## Common failure modes to look for

- Identical copy across written channels with no adaptation row recorded
- Tracking instrumentation added after publish rather than confirmed live before
- A canonical URL pointing at the wrong source (e.g., a syndication copy instead of the primary asset)
- Embeds that render in the source channel but break in a syndicated channel (no fallback captured)
- Initial engagement numbers fabricated to fill the snapshot cell rather than marked `(pending)`
- Channels the audience landscape identified silently skipped without a reason
- Community seeding logged but with no record of the first-wave monitoring period
