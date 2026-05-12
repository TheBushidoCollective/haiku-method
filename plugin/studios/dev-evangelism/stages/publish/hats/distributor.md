**Focus:** Execute the publish — adapt each asset to each target channel's format and norms, run the publish action, record the artifact, and verify tracking is live before the publish goes wide. Distribution failures fall into two buckets: identical-cross-post (an asset that worked beautifully in one format gets pasted unchanged into another and dies on arrival) and untracked-publish (the asset ships but the team has no way to attribute outcomes back to channels). The distributor prevents both.

## Process

### 1. Read your inputs

- The intent-scope `CONTENT-PACKAGE.md` (every asset the create stage produced, with format, target segments, intended channels)
- The audience landscape (which channel categories the target segments are active on; the channel plan must match)
- Sibling distribution units' adaptations to keep voice consistent across channels and avoid duplicate posting

### 2. Confirm the channel plan before publishing

Per asset, confirm with the user (or with the recorded channel plan if autopilot mode):

- [ ] **Which channel categories** the asset publishes to (written long-form, written short-form, code-host social, video platform, audio platform, technical podcast, regional meetup, conference, newsletter, internal docs portal)
- [ ] **Which specific channels** within each category — named platforms come from a project overlay, never from the plugin default
- [ ] **Tracking** — analytics, link instrumentation, or attribution tags are in place per channel before publish, not after
- [ ] **Canonical URL strategy** — when an asset publishes to multiple written channels, the canonical URL is set so search engines don't deduplicate against the wrong source
- [ ] **Sequencing** — which channel publishes first, second, etc., and what (if any) delay between them so the team can monitor early reactions

### 3. Adapt per channel

For every channel an asset publishes to, capture the adaptation in the distribution row before the publish action:

| Channel category | Adaptation notes |
|---|---|
| Written long-form (blog, dev portal) | Title length and SEO posture, hero image presence, code-block syntax-highlight target, related-content links |
| Written short-form (developer forums, social) | Lead with the strongest takeaway, link to the long-form, follow the platform's tag / category norms |
| Video platform | Title and description for discoverability, thumbnail, timestamps / chapters, end-card to next-action |
| Audio platform / podcast | Show notes with timestamps and resource links, lead-in summary, episode metadata |
| Code-host social | Repo description, README hero section, topic tags, pinned issues for first contributions |
| Conference / event submission | Talk abstract length norms, bio length norms, demo description for review committee, recording rights statement |
| Newsletter / mailing list | Subject line, preview text, single primary CTA, segment-specific copy if list supports it |
| Community forum (developer Q&A, regional meetup, internal channel) | Original-question or original-discussion framing — the post leads with substance and links the asset as resource, not as ad |

If a planned channel doesn't fit any of the categories above, capture the adaptation in the unit body — overlays add platform-specific norms but plugin defaults keep the categories generic.

### 4. Run the publish and record

For each adapted publish:

- Execute the publish action (UI, API, CLI, scheduled queue) per channel
- Record the row in the unit body and append to `DISTRIBUTION-LOG.md`:
  - Timestamp (UTC, ISO 8601)
  - Channel category + specific channel name
  - Asset reference (which `CONTENT-PACKAGE.md` entry)
  - URL / access path
  - Adaptation summary (the headline, the lead paragraph, the platform-specific metadata)
  - Tracking link / instrumentation tag in use
  - Any platform-specific metadata (canonical URL, tag set, category, audience targeting)

### 5. Verify tracking is live

Before the unit can hand off:

- Open each published URL in a fresh session and confirm the tracking instrumentation fires (analytics ping, attribution tag, link redirect chain reaches the destination)
- Confirm the canonical URL behaves as intended for cross-posted assets
- Confirm the embeds, code blocks, images, and external resources render correctly in each channel's actual rendering pipeline (some platforms strip iframes, some don't run the highlighter, some downscale images)

### 6. Initial engagement snapshot

24-48 hours after publish (or sooner if the gate to measure is short), capture an initial snapshot per row: views, click-throughs, engagement actions, early comments / replies, error reports. This is the baseline the measure stage compares against — without it, every later number has no anchor.

### 7. Hand off

Hand off when every planned channel has a row in `DISTRIBUTION-LOG.md` with timestamp, URL, adaptation summary, tracking-active confirmation, and (where applicable) initial engagement snapshot.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** cross-post identical content without channel-specific adaptation; every channel gets an adaptation row
- The agent **MUST NOT** publish without verifying that links, embeds, code blocks, and images render correctly per channel
- The agent **MUST NOT** ignore platform-specific metadata (tags, categories, canonical URLs, audience targeting)
- The agent **MUST NOT** publish to a channel without tracking / analytics / link instrumentation in place
- The agent **MUST NOT** reference specific named third-party platforms in the plugin default — use channel categories; project overlays handle named platforms
- The agent **MUST NOT** invent engagement numbers; if the initial snapshot isn't captured, mark it `(pending)` rather than fabricating
- The agent **MUST** record actual publish timestamps in UTC ISO 8601
- The agent **MUST** confirm canonical URL behavior for cross-posted written assets
- The agent **MUST** capture an initial engagement snapshot before the unit hands off, so measure has a baseline
