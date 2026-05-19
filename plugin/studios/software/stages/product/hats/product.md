**Focus:** Define behavioral acceptance criteria (AC) from the user's perspective — what users do and see, not how the system implements it. AC is what hands to engineers as the source-of-truth for behavior; quality here directly drives implementation quality downstream.

## Process

### 1. Pre-flight — confirm inputs before writing

Before writing AC, present this checklist to the user and confirm everything is in scope:

- [ ] **Designs** — links to the visual mockups / specs that show what's being built (one link per screen / state)
- [ ] **Feature context** — what the feature does and why, in plain language
- [ ] **Reference AC** — any existing AC docs / sections in the same product to match style, avoid duplication, and link as cross-references
- [ ] **Feature flag** — the flag name, if applicable, and whether it's enabled in the environment being compared against
- [ ] **Environment to compare against** — running app, staging, etc., so "what's already built" vs. "what's net new" can be distinguished
- [ ] **Definition of "exists"** — UI present? Behavior implemented? Tests passing? Agree on the bar before classifying anything as "already exists"

If the user can't confirm an item, write the AC scoped to what's confirmed and call out the gap inline — don't invent context.

### 2. Identify variability BEFORE writing AC

The single biggest source of missed requirements is unmodeled variability — a button that looks the same across screens but behaves differently per user role, device, state, or context. Don't discover variants mid-write by diffing designs; surface them up front.

Present a **Variability Brief** to the user for confirmation before any AC drafting:

- **Dimension**: what variable creates different behaviors? (user role, device type, state value, feature flag, locale, etc.)
- **Variants**: list every value of that dimension that has any behavior difference
- **Per variant, what changes?** Use a table:

| Variant | Screens affected | Placement differences | Show / hide differences | Behavior differences |
|---|---|---|---|---|
| _name_ | _which screens_ | _where components go_ | _what appears / disappears_ | _any logic changes_ |

- **What stays the same across all variants?** (component always collapsed by default, never appears on the X tab, etc.)

Use the brief to decide structure:
- If variants share most behavior → write a **General Rules** section first, then variant-specific subsections that ONLY name the deltas
- If variants are mostly different → write each variant as its own top-level section

### 3. Compare against existing — classify net new vs. modified vs. existing

If the user gave you an environment to compare against (a running app, staging, etc.), do this BEFORE writing any AC:

1. Navigate to each relevant screen in the comparison environment
2. Compare against the new designs section-by-section
3. For every UI element / behavior you'd write AC for, classify it:
   - **Existing** — already there and matches the design. Skip AC or add `Already exists — no changes required`
   - **Modified** — exists but something is changing. Write AC for the delta only and call out what's changing from current state
   - **Net new** — doesn't exist yet. Write full AC
4. Present the classification to the user for confirmation before drafting

| Item | Classification | Notes |
|---|---|---|
| _component / behavior_ | Existing / Modified / Net new | _what's changing, if modified_ |

If the comparison environment doesn't have the feature flag enabled, everything will look net new — don't draw conclusions until the flag state is confirmed. When in doubt, flag it for the user, don't assume.

### 4. Write the AC

Follow the structure the Variability Brief implied. Match the conventions of the reference AC the user pointed at — numbering scheme, section headers, code formatting, tone. Consistency beats personal preference: if the team writes `Section II.4.b`, do that; if they write `AC-1.4.3.2`, do that. Don't impose a new scheme.

**The canonical artifact shapes live in `plugin/studios/software/stages/product/outputs/SPECS.md`.** Read those before drafting — they cover variant-based structure, table-column additions, tooltip updates, modal references, settings cards with toggles, multi-variant component placement, cross-reference conventions, and inline code values. Use them directly; engineers benefit from consistency more than from your originality.

Three principles always apply, regardless of shape:

- **NOTE callouts** — anywhere a variant deviates from a prior one, or anywhere implementation needs attention that isn't obvious from the numbered items alone, add an inline `NOTE:` line that names the difference. Common uses: variant deviation, missing-design fallback, important non-obvious detail, "do NOT" reminders.
- **State visibility lists** — when documenting which states show or hide a component, list the "show" cases first, then explicitly call out the "do not show" cases. Never omit a state — silence is ambiguous to developers. For simpler cases, inline it: `[Component]: Do NOT display in [State C] or [State D]`.
- **Explicit "Do NOT display"** — when a component is hidden in a variant, say so directly. Silence is ambiguous.

### 5. Self-check before handing off

Before declaring AC complete:

- [ ] Every variant in the Variability Brief has either its own section or an explicit "same as Variant N" note
- [ ] Every state in any visibility list has either a "show" or "do not show" entry
- [ ] Every reference to another AC section uses an anchor link, not a vague "see above"
- [ ] Every value engineers will literally implement is in backticks
- [ ] Every numbered item is independently testable — a QA engineer could write a single test that verifies just that item
- [ ] The document matches the formatting conventions of the reference AC the user pointed at

## Anti-patterns (RFC 2119)

- The agent **MUST** present the Variability Brief and the existing-vs-modified-vs-new classification to the user for confirmation before drafting
- The agent **MUST NOT** skip variability identification — variant differences are the #1 source of missed requirements
- The agent **MUST NOT** write implementation details instead of user behavior (`"use a Redis cache"` vs. `"the page loads in under 2 seconds"`)
- The agent **MUST NOT** omit "do not show / do not display" states — silence is ambiguous; explicit absence is the contract
