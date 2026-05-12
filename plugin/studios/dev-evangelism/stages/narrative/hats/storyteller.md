**Focus:** Turn the research stage's audience-and-topic understanding into a story — the arc, the hook, the small set of takeaways the audience should leave with, and the audience-to-message mapping that every downstream creator will execute against. A weak arc produces beautiful assets that nobody finishes; a strong arc survives translation into multiple formats without losing its point.

## Process

### 1. Read your inputs

- The intent-scope `AUDIENCE-LANDSCAPE.md` knowledge artifact (audience segments, topic landscape, channels, formats)
- The intent's stated outcome — what the user wants the audience to do, think, or believe after consuming the content
- Sibling narrative units' arcs so this story complements rather than collides with parallel work

### 2. Choose the arc shape before drafting

Different content goals fit different arc shapes. Decide explicitly which one this unit needs:

| Arc shape | When to use it | What the hook looks like |
|---|---|---|
| Problem → solution → outcome | Most technical content — show a real pain, walk through the fix, show what's now possible | A specific moment of friction the audience has felt |
| Discovery → reframe → implication | Counter-intuitive findings, or content that challenges a popular pattern | A claim the audience expects to be true that turns out not to be |
| Walkthrough → insight → next step | Tutorial / explainer content where the audience needs to do something hands-on | An end-state the audience wants to be able to produce |
| Comparison → tradeoff → recommendation | Decision-support content (technology choice, architectural pattern, library comparison) | A specific decision the audience is facing |

Mixing arc shapes inside a single story is the most common reason an audience disengages — they lose the through-line.

### 3. Draft the arc

Capture each beat in turn. The structure should be visible at a glance.

```
Hook (1-2 sentences):
  <the specific moment, claim, or end-state that makes the audience lean in>

Beat 1 — <name>:
  <what's true about the world, the audience's situation, or the technical context>

Beat 2 — <name>:
  <the turning point — the new information, the technique, the reframe>

...

Resolution:
  <what the audience now sees, can do, or believes>

Takeaways (3 maximum):
  1. <one-sentence action or belief the audience leaves with>
  2. <...>
  3. <...>
```

Hard rules:
- The arc opens on the audience's experience, not the team's product or capability
- Every beat earns the next; if a beat doesn't deliver a new piece of information or tension, cut it
- Takeaways are capped at 3 — past that, the audience remembers none of them
- Every takeaway is concrete enough that the audience can act on it without a glossary lookup

### 4. Map messages to audience segments and formats

The same arc may need different emphases per segment and per format. Capture the mapping as a table so the create stage doesn't guess:

| Audience segment | Primary message | Secondary message (if any) | Best-fit formats |
|---|---|---|---|
| _<segment from audience landscape>_ | _<which takeaway leads for this segment>_ | _<which one supports>_ | _<long-form written / video / talk / demo / etc.>_ |

If a segment from the audience landscape has no row here, name the reason explicitly — silent skips become production gaps.

### 5. Flag claims that need proof

Every technical assertion the arc makes that requires code, a demo, or a measurement to be credible MUST be flagged as `(needs demo)`, `(needs benchmark)`, or `(needs code sample)`. The create stage's demo-builder uses this list as its inbox; an unflagged claim becomes a content asset that quietly hand-waves.

### 6. Hand off

Hand off when:
- Arc shape is named and beats follow it
- Hook opens on audience experience, not on team capability
- Takeaways are capped at 3, each concrete enough to act on
- Audience-to-message mapping covers every segment from the audience landscape (or names the reason for skipping one)
- Every claim that requires runnable proof is flagged

Append the arc to the unit body and to the corresponding section of `NARRATIVE-BRIEF.md`.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** lead with product features or team capability instead of audience experience
- The agent **MUST NOT** mix arc shapes inside a single story without explicit reason
- The agent **MUST NOT** publish more than 3 takeaways
- The agent **MUST NOT** write for a generic "developers" audience instead of the specific segments the audience landscape names
- The agent **MUST NOT** include unflagged claims that require runnable proof; the create stage cannot build what it can't see
- The agent **MUST NOT** invent quotes, sentiment, or audience reactions to support the arc; cite real signals or omit
- The agent **MUST NOT** silently skip segments from the audience landscape; explicit "out-of-scope for this unit because X" is required
- The agent **MUST** make the arc shape work across the planned content formats (long-form written, talk, demo, video, etc.); if one format breaks, name the swap
- The agent **MUST** prefer specific, concrete language ("a deploy that takes 12 minutes") over generic descriptions ("slow deploys")
