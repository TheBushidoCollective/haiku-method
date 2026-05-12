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

Follow the structure the Variability Brief implied. Write to the conventions of the reference AC the user pointed at — match the existing document's pattern in numbering, section headers, code formatting, and tone. **Consistency beats personal preference**: if the team already writes AC as `Section II.4.b` (letter-numbered), do that. If they write it as `AC-1.4.3.2`, do that. Don't impose your own scheme.

#### Structure for variant-based AC

```
1. General Rules
   1. [Things true across ALL variants — component references, default
      states, tabs where nothing appears]
2. [Variant 1 name]
   1. **[Screen / Tab Name]:**
      1. [Component] Placement:
         1. [Specific placement for this variant]
      2. [Other Component]: [show / hide rule]
3. [Variant 2 name]
   1. **[Screen / Tab Name]:**
      1. [Component] Placement:
         1. [Placement if different from Variant 1]
         2. NOTE: This differs from Variant 1 — [explain how].
      2. [Other Component]: Do NOT display
```

Principles:
- **General Rules first** so universal behavior isn't repeated per variant
- **Variant subsections mirror each other** — same screen / tab structure in each so devs can scan across
- **NOTE callouts for differences** — anywhere a variant differs from the previous one, add a `NOTE:` line explaining the difference explicitly
- **Explicit "Do NOT display" statements** — when a component is hidden in a variant, say so directly; silence is ambiguous to devs

#### NOTE callouts

Use `NOTE:` inline within an AC item whenever something needs developer attention that isn't obvious from the numbered items alone:

```
1. [Component] Placement:
   1. Place below [element]
   2. NOTE: This differs from [Variant 1] — in this state the component moves above [other element] because [reason].
```

Common uses:
- A variant behaves differently from the previous one (always note it)
- No designs exist for this item (reference where to look instead)
- An important implementation detail not directly stated in the design
- A reminder about what NOT to do (`NOTE: DO NOT show the adjust button on ended engagements`)

#### State visibility lists

When documenting which states show or hide a component, list the "show" cases first, then explicitly call out the "do not show" cases. Never omit a state — silence is ambiguous to developers:

```
1. [Component] Visibility
   1. Show on:
      1. [State A]
      2. [State B]
   2. DO NOT show on:
      1. [State C]
      2. [State D]
```

For simpler cases, inline it: `[Component]: Do NOT display in [State C] or [State D]`.

#### Inline code values

Use backticks for specific values that engineers will literally implement: time formats (`HH:MM:SS`, `Xh Xm Xs`), sentinel values (`--`, `YES`, `NO`), color tokens (`primary`, `error`, `success`), icon names, enum values.

When specifying icon + color + behavior together:

```
1. Icon
   1. squareicon
   2. icon: `mug-hot`
   3. color: `primary`
```

#### Cross-references

Link related sections rather than restating. When `Section X` is referenced, write it as either:
- `See Section X above` (loose reference)
- `See [Section X](#anchor) for the component AC` (anchored)
- Parenthetical: `([Section VIII.b.1](#anchor))`

Always anchor when the section has a known anchor — it makes AC easier to navigate during review.

#### Common AC patterns

Reusable templates for the AC shapes that recur across applications. Adapt the bracketed values; keep the structure. Whenever a section in your AC looks like one of these, write it in this shape rather than inventing a new one — engineers benefit from the consistency more than from your originality.

**Adding a column to an existing table:**

```
1. Add "[Column Name]" Column to [Table Name]
   1. Add a new column to the [Table Name] table
      1. Column Header: [Column Name]
      2. Column Position: Place after the "[Previous Column]" column
   2. Column Data Display
      1. IF [condition]:
         1. Display [data description]
            1. This is the same value described in [Section X](#anchor)
         2. Format: `[format]`
            1. Example: `[example]`
      2. IF [alternate condition]:
         1. Display: `[sentinel value]`
```

**Updating an existing column with a tooltip:**

```
1. Update [Column Name] Column
   1. Update text to Bold
   2. Add question mark tooltip icon
      1. icon: `question`
      2. color: `info`
      3. Selecting tooltip should open [Modal Name]
         1. See [Section X](#anchor)
```

**Referencing a modal from an action:**

```
1. For [action]: Use updated [Modal Name]
   1. See [Section X](#anchor)
```

**Settings card with a toggle that reveals a configuration section:**

```
1. Create [Setting Name] Card
   1. Header
      1. Icon
         1. squareicon
         2. icon: `[icon-name]`
         3. color: `[token]`
      2. title: [Setting Title]
   2. Description
      1. text: [Description copy]
   3. Toggle Row
      1. label: [Toggle label]?
      2. Toggle
         1. Default state: OFF (NO)
         2. When toggled ON (YES), show [Configuration Section]
         3. When toggled OFF (NO), hide [Configuration Section]
   4. Highlighted Reminder
      1. icon: `circle-info`
      2. color: `info`
      3. text: [Reminder copy]
      4. Always show
   5. Save Changes Button
      1. text: Save Changes
      2. color when enabled: `[primary-token]`
      3. Keep disabled if no changes made or validation errors exist
      4. When selected, save and show success toast
```

**Variant-based component placement** (the canonical shape when a component appears in multiple states with placement deltas):

```
1. General Rules
   1. The [Component Name] (see [Section X](#anchor) for full component AC) is added to [Screen Name]
   2. The component should be collapsed by default in all states
   3. The component should NOT display on the **[Tab Name]** in any state
2. [Variant 1]: [State Name]
   1. **[Tab A]:**
      1. [Component] Placement:
         1. Place below [element above]
         2. Place above [element below]
      2. [Secondary Component] Placement:
         1. Place directly below [Primary Component]
         2. Only display if [condition] (see [Section X](#anchor))
   2. **[Tab B]:**
      1. [Component] Placement:
         1. Place below [element above]
         2. Place above [element below]
3. [Variant 2]: [State Name]
   1. **[Tab A]:**
      1. [Component] Placement:
         1. Same placement as [Variant 1] [Tab A]
      2. [Secondary Component]: Do NOT display
   2. **[Tab B]:**
      1. [Component] Placement:
         1. Place below [different element]
         2. NOTE: This differs from [Variant 1] — [explain the change]
      2. [Secondary Component]: Do NOT display
```

When a project-level overlay defines additional house patterns (specific design-system color tokens, icon set, section-numbering scheme, Notion / Confluence / Jira-specific markup), prefer the overlay's shapes over these defaults.

### 5. Self-check before handing off

Before declaring AC complete:

- [ ] Every variant in the Variability Brief has either its own section or an explicit "same as Variant N" note
- [ ] Every state in any visibility list has either a "show" or "do not show" entry
- [ ] Every reference to another AC section uses an anchor link, not a vague "see above"
- [ ] Every value engineers will literally implement is in backticks
- [ ] Every numbered item is independently testable — a QA engineer could write a single test that verifies just that item
- [ ] The document matches the formatting conventions of the reference AC the user pointed at (numbering scheme, header style, code blocks)

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** write implementation details instead of user behavior (`"use a Redis cache"` vs. `"the page loads in under 2 seconds"`)
- The agent **MUST NOT** skip variability identification — variant differences are the #1 source of missed requirements
- The agent **MUST NOT** write vague criteria like `"works well"`, `"is performant"`, `"behaves correctly"` — every criterion must be specific enough that a single test can verify it
- The agent **MUST NOT** omit "do not show / do not display" states — silence is ambiguous; explicit absence is the contract
- The agent **MUST NOT** write AC for an item before classifying whether it's net new, modified, or already existing in the comparison environment (when a comparison environment is available)
- The agent **MUST** present the Variability Brief and the existing-vs-modified-vs-new classification to the user for confirmation before drafting
- The agent **MUST** match the existing AC document's numbering, header, and formatting conventions when the user points at one — consistency over preference
- The agent **MUST** add a NOTE callout anywhere a variant deviates from the previous one
- The agent **MUST** define what "done" looks like from the user's perspective, not the developer's
- The agent **MUST NOT** prioritize by implementation ease instead of user value
