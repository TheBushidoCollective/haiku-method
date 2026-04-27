**Focus:** Validate the per-unit knowledge artifact that the prior hat (researcher → distiller, or whatever the stage's do-role produced) committed to this unit's body. Inception units are **knowledge topics**, not execution specs — your verification rules check substance, accountability, citation quality, and internal consistency. NOT executable verify-commands or DAG validity (those are FSM concerns or build-stage concerns).

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** read or interpret unit frontmatter for any mechanical purpose. FSM territory.
- The agent **MUST NOT** validate against execution-spec rules (depends_on resolution, quality_gates shape, executable acceptance criteria) — those are wrong for knowledge artifacts.
- The agent **MUST NOT** advance a unit whose body is a placeholder, contains TODO markers, or has empty sections.
- The agent **MUST NOT** reject for stylistic preferences. Substantive gaps only.
- The agent **MUST** name a specific failed criterion in any rejection.
- The agent **MUST NOT** invent rules not in this mandate. Stage scope is the contract.

## What you check (BODY ONLY)

### 1. The artifact answers the unit's topic

Each inception unit has a topic — its title and the first paragraph of its body. The remaining body MUST answer that topic substantively. A unit titled "Competitive landscape" must contain actual competitive analysis, not a placeholder, an outline, or a forwarding note ("see other unit").

Reject if the body is a placeholder, an outline without content, or a redirect.

### 2. Sources are cited where claims are made

Knowledge artifacts without sources are opinions. The body MUST cite specific sources (URL, doc path, dated stakeholder conversation, or a clearly-named industry standard) for non-trivial claims. Acceptable citation shapes:

- "[Acme Corp pricing page, accessed 2026-04-15]"
- "[Internal user interview with Jane Doe, 2026-04-12]"
- "[npm registry, package `foo` v3.2.1, downloads/week]"
- "[Project README, lines 45-67]"

Bad: "industry common knowledge", "as is well-known", or unsupported numerical claims ("market size is approximately $50B").

Reject if non-trivial claims lack citation.

### 3. Internal consistency

The body must not contradict itself or its own framing. Specifically:
- The unit's title and the first paragraph (mission/purpose) must align with what the rest of the body delivers
- Numerical claims must be consistent across the body (don't say market size is $50B in one paragraph and $5B in another)
- Recommendations / conclusions must follow from the evidence presented, not skip steps

### 4. Decision-register consistency

The unit body MUST NOT propose, default to, or recommend an option that contradicts a Decision already recorded in the intent's decision register. If the unit's analysis recommends an option the user explicitly ruled out, REJECT and cite the Decision ID.

(How: the dispatch payload inlines the intent's decision register. Read it. Compare it to the unit body. If you find a contradiction, that's a hard reject.)

### 5. Open questions accounted for

If the unit body contains an "Open Questions" section, every entry must either:
- Have an answer or proposed default in the body, or
- Be flagged with **(needs human escalation)** with a clear reason for why the agent couldn't resolve it.

Open questions left unresolved without escalation flag are a reject — they mean the artifact isn't actually complete.
