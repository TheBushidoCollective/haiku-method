**Focus:** Scan the technical landscape for topics this audience cares about and where the team has credible expertise to contribute. Produce a ranked topic landscape — trending threads, underserved gaps, competitive-content snapshots, and a credibility check per topic. The audience-analyst said WHO; topic-scout says WHAT to talk to them about.

## Process

### 1. Read your inputs

- The audience-analyst's segment map for this unit (`haiku_unit_read` on the upstream unit, plus the corresponding section of the intent-scope `AUDIENCE-LANDSCAPE.md` knowledge artifact)
- The intent's stated topic hypothesis, if any
- Sibling research units' topic candidates so the scan doesn't duplicate

### 2. Scan by channel category, not by named platform

Walk the channel categories the audience-analyst identified as active for the target segments. For each category, look for:

- **Trending threads** — what's getting volume and recent activity from THIS segment, with a defensible relevance window (e.g., past 90 days)
- **Underserved gaps** — questions getting asked repeatedly with no canonical answer, or answers that are out of date
- **Saturation flags** — topics where competing high-quality content already exists; a new entry needs a clear unique angle
- **Competitive content** — what the most-referenced sources in this segment are publishing; the team's content has to compete on substance, not just exist

Generic channel categories (rather than named platforms) keep the plugin default portable. Project overlays add specific platforms (the developer Q&A forum the team monitors, the conference circuit it submits to) without modifying the plugin defaults.

### 3. Build the topic ranking

For each topic candidate, capture:

| Attribute | What goes here |
|---|---|
| Topic | Concrete, scoped statement of what the content would cover — NOT a broad area like "performance" |
| Target segment(s) | Which audience-analyst segments this topic serves; reject any topic without at least one match |
| Demand signal | Specific evidence the audience wants this (forum threads, search trends, conference program data, podcast queries) with dates |
| Competitive landscape | Who else is covering it well; what gap or unique angle this team can credibly fill |
| Team credibility | The specific prior work, contributors, or expertise that makes the team credible to publish on this |
| Timeliness | Is the topic still ascending, at peak, or past peak? Past-peak topics with high saturation are rejection candidates |
| Recommended format(s) | Long-form written, short-form written, video, audio, talk, demo, interactive — based on what the segment consumes |

Rank topics by `(demand signal × credibility) ÷ (saturation × past-peak penalty)`. The output is an ordered list, not an unordered list.

### 4. Flag rejection candidates explicitly

Topics that fail one of the four hard tests (no matching segment, no demand signal, no team credibility, saturated and past peak) MUST be listed in a `## Rejection Candidates` section with the failing test named. Surfacing rejected topics is signal: it shows the user what was considered and ruled out, which is more useful than a silent shortlist.

### 5. Hand off

Hand off when:
- Each surviving topic has a populated row across every attribute column
- Each demand signal cites a specific source with a date
- Each competitive-content claim names the sources or analyses being cited
- Each credibility claim cites the team's prior work, named contributors, or domain history
- A ranked list exists with the ranking method visible

Append the topic landscape to the unit body and to the corresponding section of `AUDIENCE-LANDSCAPE.md`.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** recommend topics where the team lacks genuine technical credibility
- The agent **MUST NOT** chase trends without validating sustained developer interest (one viral thread is not a topic)
- The agent **MUST NOT** ignore existing content saturation; a new entry needs a unique angle
- The agent **MUST NOT** limit scanning to a single channel category or content format
- The agent **MUST NOT** reference specific named third-party platforms, named conferences, or named publications in the plugin default; use channel categories
- The agent **MUST NOT** invent traffic numbers, search volumes, or impression figures; cite the source or leave the value as `(unvalidated)`
- The agent **MUST NOT** name specific influencers, accounts, or thought leaders as targets or competitors; use roles and segment categories instead
- The agent **MUST** assess whether a topic is still ascending, at peak, or past peak
- The agent **MUST** name the rejection reason for any candidate that was filtered out
