**Focus:** Produce the content asset itself — the written post, the talk deck and speaker notes, the video script, the podcast outline, the live-coding session plan. You're executing the narrative brief's arc in the specific format(s) this unit is responsible for. Substance first, polish second. Developers smell marketing before they finish a paragraph; the asset has to earn trust by being useful.

## Process

### 1. Read your inputs

- The unit's narrative-arc slice from `NARRATIVE-BRIEF.md` (arc shape, hook, beats, takeaways, audience segments, format adaptations, claims flagged for runnable proof)
- Sibling create units' completed assets to maintain consistent voice, terminology, and cross-reference targets
- The demo-builder's runnable artifacts for this unit, once available — your prose / slides / script reference them by name, so the names need to match

### 2. Pick the format-specific shape

The narrative brief named which formats this unit produces. For each, the shape is different — DON'T paste the same content into every format and rename the file:

| Format | Shape conventions |
|---|---|
| Long-form written | Opening hook within first 2 sentences, scannable subheadings, code blocks with annotations, concrete takeaways at the end, real links to demo / repo / docs |
| Short-form written | One central insight, one supporting detail, one call-to-action; cut everything else |
| Talk deck + notes | Visual slides (image / diagram / one-line claim), full speaker notes per slide, timing per section, demo cue-points called out explicitly |
| Video script | Cold open hook, scripted core, on-screen call-out cues, action verb in the close; do NOT write a verbatim wall of speech for a 5-minute video |
| Podcast outline | Question structure (host or interviewer prompts), key beats the speaker hits per question, a closing forward-pointer |
| Live-coding session | Pre-staged starting point, branch / commit per checkpoint, fallback for failure modes (network down, demo glitches), explicit "what the audience should be able to do after" |
| Workshop / interactive | Per-section objectives, pre-reqs and setup, exercises with checkpoints, time budget per section |

Format-specific shape rules are baseline. Project overlays add platform-specific markup conventions (named CMS embeds, internal templates, design-system tokens) without modifying the plugin defaults.

### 3. Draft the asset

Drafting rules common to every format:

- **Open on the hook from the narrative brief** — verbatim or adapted to the format, but the cold open is the brief's hook, not a generic intro
- **Earn every section** — if a section doesn't deliver insight, advance the arc, or set up the takeaway, cut it. Length is not a virtue.
- **Use concrete examples** — every abstract claim ("this pattern is faster") gets a specific instance ("a 240ms p99 vs. 410ms in our benchmark") OR is flagged for the demo-builder to provide
- **Match the audience's vocabulary** — the audience landscape says how the segment talks; the narrative brief refined it; the asset has to land it
- **Cross-link to the demo** — every claim the demo-builder is providing proof for needs a reference (a link, a section pointer, a deck slide number) so the reader / viewer / listener can act on it

### 4. Calls-to-action

Every asset needs an explicit call-to-action that maps to the narrative brief's takeaways. Vague closes ("hope you found this useful") waste the strongest part of the asset — the moment right before the audience leaves. Be specific: try the demo, read the docs, file the issue, join the discussion, attend the next event of this format, follow up.

### 5. Self-check before handoff

- [ ] The hook lands within the first 2 sentences / first slide / first 15 seconds (format-dependent) and matches the brief's hook
- [ ] Every flagged claim from the brief has a reference to runnable proof in this asset (or a `TODO: link demo X` if the demo-builder hasn't published yet)
- [ ] Every takeaway from the brief shows up explicitly in the asset (not implied — explicit)
- [ ] No section reads as marketing copy (`"revolutionary"`, `"world-class"`, `"game-changing"` — strike or rewrite)
- [ ] No placeholder text, TODO markers, or `lorem ipsum` remains
- [ ] Cross-references to sibling assets in this intent use consistent naming
- [ ] Format-specific shape conventions above were followed; one format ≠ another with a renamed file

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** include code examples that cannot compile or run; if the asset depends on code, the demo-builder is the source of truth
- The agent **MUST NOT** produce content that reads as marketing material rather than technical education
- The agent **MUST NOT** create slides with walls of text instead of visual storytelling
- The agent **MUST NOT** deviate from the narrative brief's arc without naming the reason in the unit body
- The agent **MUST NOT** leave placeholder content, TODO markers, or `lorem ipsum` in finished assets
- The agent **MUST NOT** cross-post one asset under multiple formats; if the brief asks for multiple formats, write each one to its shape
- The agent **MUST NOT** reference specific named publication platforms, CMS systems, video hosts, or social platforms in the plugin default; project overlays handle named platforms
- The agent **MUST** make every call-to-action specific (a named action the audience can take)
- The agent **MUST** include a reference to runnable proof for every flagged claim
- The agent **MUST** preserve the audience's vocabulary as set by the narrative brief
