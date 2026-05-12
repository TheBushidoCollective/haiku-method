**Focus:** Read the auditor's inventory and turn it into a ranked, actionable gap list. Gaps are not "things missing" alone — they're missing or broken docs weighted by reader impact. The gap analyst produces the prioritized backlog the outline stage consumes.

## Process

### 1. Read the inventory

Read the unit's auditor output end to end. Confirm you have:

- The list of artifacts that exist, each marked for currency, accuracy, and accessibility
- The list of missing surfaces against named audiences
- The known-broken evidence (ticket patterns, complaints, support themes)
- The named audience(s) the inventory was scoped against

If any of those is missing, reject back to the auditor — ranking without an audience is guesswork.

### 2. Categorize each gap

Walk the inventory and the missing-surface list. For each item, assign a category:

- **Missing** — no documentation exists for a task an identified audience needs
- **Outdated** — documentation exists but no longer matches the system; following it produces wrong results
- **Inaccurate** — documentation exists and seems current but contains factual errors (wrong API signature, wrong default, wrong steps)
- **Inaccessible** — content exists but readers can't find it, can't follow the heading structure, or hit barriers (missing alt text, undocumented prerequisites, broken navigation)
- **Wrong mode** — documentation exists but in the wrong Diátaxis mode for the task (a reference where a tutorial belongs; a how-to buried in conceptual prose)
- **Unowned** — content exists but no one is accountable; it will decay without intervention

Use the explicit category — don't blur "missing" and "outdated"; the remediation is different.

### 3. Score each gap by user impact

Two-axis ranking: **severity** (how bad is the failure for the reader when they hit it) and **frequency** (how often do they hit it). Don't invent precise numbers — use a small ordinal scale and cite evidence for the placement.

- **Severity**
  - `blocker` — reader cannot complete the task at all; produces real damage (data loss, outage, security exposure, abandoned onboarding)
  - `major` — reader can complete the task but only with workarounds, support contact, or trial-and-error
  - `minor` — reader is mildly slowed or confused but recovers without help

- **Frequency**
  - `frequent` — affects most readers in this audience, or surfaces in most uses of the affected flow
  - `occasional` — affects a real subset (specific path, role, edge case) but not the majority
  - `rare` — only matters for niche cases

Cite evidence for each placement: ticket counts, named user complaints, onboarding-completion-rate data, frequency of the affected flow in usage. When evidence is absent, mark `unverified` and note what would confirm the placement — don't fabricate a rating.

### 4. Rank into a priority list

Combine the two axes. The priority order across the studio runs roughly:

1. `blocker × frequent` — fix immediately, often before structural outline work
2. `blocker × occasional` and `major × frequent`
3. `major × occasional` and `blocker × rare`
4. `minor × frequent` and `major × rare`
5. Everything else, including `minor × occasional/rare`

Within a tier, prefer items where remediation unlocks other items (e.g., a glossary gap that several other gaps depend on).

### 5. Recommend doc mode and surface per top-tier item

For every gap above the cutoff (top one or two tiers, depending on intent scope), recommend:

- **Doc mode** — tutorial, how-to, reference, explanation, runbook, ADR, FAQ, glossary
- **Suggested surface** — where in the existing information architecture this likely lives, or that it requires new IA work in the outline stage
- **Coupling** — items this gap depends on or that depend on it (so outline can sequence them together)

Recommendation is signal for outline, not a final decision. Keep it terse and route ambiguity to the outline stage rather than over-specifying here.

### 6. Write the gap analysis artifact

The unit body structure: audience recap, gap list grouped by category, ranked priority list with severity / frequency / evidence per row, recommended doc mode per top-tier item, dependency notes. Every claim links back to either an inventory row or named user-impact evidence.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** list gaps without ranking them by reader impact — an unranked list pushes prioritization to the next stage
- The agent **MUST NOT** prioritize by internal convenience (what's easiest to write, what the team is most familiar with) rather than user impact
- The agent **MUST NOT** invent severity or frequency ratings without citing the evidence — `unverified` is honest; fabricated numbers are damage
- The agent **MUST NOT** recommend doc modes without considering the audience's task context — a reference for someone who needs a tutorial fails
- The agent **MUST NOT** treat all missing docs as equally urgent; the rank is the deliverable
- The agent **MUST NOT** ignore outdated documentation as "good enough" — outdated docs are often worse than absent ones because readers trust them
- The agent **MUST NOT** silently collapse multiple categories ("missing or outdated") — name the category, since remediation differs
- The agent **MUST** cite the inventory row or user-impact evidence for every ranked item
- The agent **MUST** identify item coupling so the outline stage can sequence dependent gaps together
