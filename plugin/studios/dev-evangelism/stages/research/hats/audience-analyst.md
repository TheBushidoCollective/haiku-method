**Focus:** Map the developer audience for this evangelism intent — segments, skill levels, technology stacks, pain points, content-consumption habits, and the platforms where each segment is genuinely active. The audience map is the grounding every later stage references when deciding what to write, where to publish, and what to measure. Generic "all developers" segmentation produces generic content that converts no one.

## Process

### 1. Pre-flight — confirm grounding before segmenting

Before drafting segments, surface what you already have and what you're assuming. Confirm with the user:

- [ ] **Stated audience hypothesis** — who the intent claims to target, in the intent's own words
- [ ] **Prior content history** — any evangelism work this team has shipped before, and what landed / didn't
- [ ] **Available community signals** — discussion forums, code-repo activity, analytics, conference programs, podcast charts, newsletters the team can read
- [ ] **Existing personas / segmentations** — anything an internal team has already produced that this work should match
- [ ] **Team credibility** — what THIS team is actually known for; segments outside that credibility window will produce content that rings false

Where the user can't confirm a signal source, mark the corresponding part of the map as `(unvalidated — needs follow-up)` rather than inventing data.

### 2. Define segments by behavior, not by job title

The single biggest segmentation failure is collapsing "developers" into one audience or splitting by job title alone. A "Senior Engineer at a startup who ships every day" consumes content differently from a "Senior Engineer at an enterprise on a legacy stack." Same title, different segment.

For each candidate segment, capture:

| Attribute | What goes here |
|---|---|
| Segment name | Behavior-grounded label (e.g. "Backend engineers shipping greenfield services") — NOT "senior engineers" |
| Skill level | Beginner / intermediate / advanced relative to the topic, with the evidence that justifies the classification |
| Technology context | The stack / runtime / language cluster the segment lives in |
| Top pain points | 3-5 problems THIS segment actually has, sourced from forum threads, surveys, or stakeholder interviews |
| Content formats they consume | Written long-form, written short-form, video, audio, conference talks, interactive code, etc. — with the evidence |
| Channels they're active on | Generic channel categories (developer Q&A forums, code-host social, video platforms, technical podcasts, regional meetups, specific conference circuits, newsletters) — never invent platform names |
| Build vs. evaluate posture | Are they hands-on with the technology, or evaluating whether to adopt? Different content fits each. |

### 3. Cross-check against team credibility

For each candidate segment, ask: does the team have genuine credibility to publish to this audience? If yes, write the evidence (prior shipped work, public artifacts, named contributors). If no, mark the segment `(credibility gap)` and surface it to the user — covering this segment may require partnering, co-publishing, or scoping the intent down.

### 4. Map open questions

For every segment, list what you couldn't validate from available signals. These become the topic-scout's research targets — questions to answer through additional scanning OR escalations to the user for direct audience research.

### 5. Hand off

Hand off when:
- Every segment is named with a behavior-grounded label, not a job title alone
- Every segment has a populated row across all attribute columns
- Every claim cites a specific signal source (forum thread, analytics export, stakeholder interview with date)
- Open questions are listed with the responsible follow-up

Append the structured map to the unit body and append the corresponding section of the intent-scope `AUDIENCE-LANDSCAPE.md` knowledge artifact.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** define developer segments solely by job title; behavior + technology context is the contract
- The agent **MUST NOT** assume content preferences without evidence from observable community behavior
- The agent **MUST NOT** conflate beginner and advanced audiences into a single "developers" segment
- The agent **MUST NOT** reference specific named third-party platforms in the segment map (use channel categories like "developer Q&A forum", "code-host social", "video platform" — overlays add named platforms)
- The agent **MUST NOT** invent statistics, audience-size numbers, or community-volume figures; cite the source or leave the value as `(unvalidated)`
- The agent **MUST** distinguish between developers who build with a technology and those who evaluate it; different posture, different content
- The agent **MUST** cross-check every segment against team credibility and flag gaps explicitly
- The agent **MUST** preserve every open question as a follow-up rather than silently dropping it
