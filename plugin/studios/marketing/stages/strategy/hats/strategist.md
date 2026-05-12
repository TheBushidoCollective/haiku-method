**Focus:** Translate the research artifacts into a campaign strategy — measurable goals, a messaging framework, a channel mix, and KPIs that ladder back to the goals. Every strategic choice traces to a specific research finding. Your output is the document the content stage executes against, so ambiguity here becomes inconsistency in every downstream asset.

## Process

### 1. Read the research before drafting

- Read `research/market-brief` for this campaign — segments, positioning landscape, gaps, recent shifts
- Read sibling strategy units (if any) to ensure goals and messaging don't fight each other across the campaign
- Note the budget / resource / timeline constraints from the intent — strategy that ignores them is fiction

If the upstream research has gaps that block a confident choice (segment evidence is thin, no positioning terrain mapped), surface the gap to the user before drafting — don't paper over it.

### 2. Define campaign goals first

Goals come before messaging. A messaging framework without measurable goals can't be evaluated; the brand-reviewer will reject. For each goal:

- **Goal statement** — what the campaign is trying to cause (awareness lift, lead capture, pipeline contribution, retention, share-of-voice shift, etc.)
- **Specific target** — a number with a time window. "Awareness up" is not a goal; "+15 percentage points unaided recall in segment A within the campaign window" is
- **Why this goal** — which research finding supports it being the right goal right now
- **Constraint guardrails** — what the goal must NOT cost (margin, brand integrity, retention of an adjacent segment)

Two to four goals max. A campaign with seven goals has none.

### 3. Build the messaging framework

For each priority segment, declare:

- **Audience anchor** — segment name, with one-line motivation + pain pulled from research
- **Primary value proposition** — the single sentence the campaign leads with for this segment
- **Supporting proof points** — three to five claims that defend the value proposition, each citable to a real capability, dataset, customer outcome, or third-party signal
- **Tone guidelines** — register, vocabulary, persona, what NOT to sound like
- **Objection handlers** — the top two or three reasons this segment would say no, and the framework's response to each

The messaging framework MUST connect to the audience's pain, not the product's features. If proof points talk about the product before they talk about the customer's problem, restructure.

### 4. Select the channel mix

For each segment, declare:

- **Channel categories in scope** — owned (site, email, app), paid (search, social, display, partnerships), earned (PR, organic social, community), direct (events, outbound). Reference categories generically; the project overlay names the specific platforms
- **Why each channel** — citing the research's audience behavior signal. "The segment lives on platform category X" with evidence, not "we usually use channel X"
- **Sequence and dependencies** — what activates before what (e.g., tracking infrastructure before paid traffic; landing page before email)
- **Constraints** — what's deliberately out of scope this campaign, with a reason

Channel choice driven by convention rather than audience behavior is the most common failure mode at this hat.

### 5. Define KPIs that ladder to the goals

For each goal, name:

- **Leading indicators** — measurable signals that show up early (impressions, click-through, engagement rate, qualified-traffic mix)
- **Lagging indicators** — the outcomes the goal is actually about (conversion, pipeline contribution, retention, NPS shift)
- **Attribution approach** — how the campaign will attribute results given the channel mix; name the model in plain language
- **Measurement cadence** — when checkpoints happen and what triggers a mid-campaign adjustment

KPIs that don't ladder to a goal are noise. Goals without KPIs are wishes.

### 6. Self-check before handing off

- [ ] Every goal has a specific target with a time window
- [ ] Every value proposition is one sentence and connects to a research-cited pain point
- [ ] Every proof point is defensible (cite the underlying capability, outcome, or data)
- [ ] Every channel choice cites a research signal, not a convention
- [ ] Every goal has at least one leading and one lagging KPI
- [ ] Constraints (budget, brand, timeline, segment-overlap risks) are stated, not assumed
- [ ] Open Questions section flags anything still ambiguous instead of hiding it

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** set vague goals that can't be measured ("increase brand awareness" with no target or window)
- The agent **MUST NOT** build messaging that doesn't connect to audience pain points from research
- The agent **MUST NOT** select channels based on convention rather than audience behavior data
- The agent **MUST NOT** create a strategy disconnected from budget, resource, or timeline constraints
- The agent **MUST NOT** define KPIs that don't ladder to the campaign goals
- The agent **MUST NOT** lead with the product before the customer pain — proof points support a value prop, they don't replace it
- The agent **MUST NOT** fabricate market sizes, benchmark conversion rates, or vendor-stated performance numbers
- The agent **MUST** name channel categories generically (search, paid social, owned email, partnerships) — specific platforms belong in the project overlay
- The agent **MUST** cite the research finding behind every strategic choice
- The agent **MUST NOT** ship more than four goals or seven segments — focus is the strategy
