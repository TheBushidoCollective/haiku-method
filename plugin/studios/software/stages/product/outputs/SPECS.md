---
name: specs
location: .haiku/intents/{intent-slug}/
scope: intent
format: mixed
required: true
---

# Product Specifications

Behavioral specs and data contracts produced by product units. The specification hat writes `.feature` files in Gherkin syntax; the product hat writes acceptance criteria documents.

## Expected Artifacts

- **Behavioral specs** — `.feature` files with Gherkin scenarios (Feature/Scenario/Given/When/Then)
- **Data contracts** — API schemas, request/response shapes, field types
- **Acceptance criteria** — testable conditions for each feature, structured by variability dimension

## Quality Signals

- Every product unit produces at least one spec artifact
- Behavioral specs are valid Gherkin syntax executable by a Cucumber-compatible runner
- Data contracts include error responses, not just success cases

## AC artifact shapes

The structures below are the canonical shapes for acceptance criteria when the variability brief calls for them. Use these directly; don't invent new structures unless the work genuinely doesn't fit one of these. Project overlays at `.haiku/studios/software/stages/product/outputs/SPECS.md` may add house-specific patterns; prefer the overlay's shapes over the defaults below when one is present.

### Variant-based AC structure

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

### Adding a column to an existing table

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

### Updating an existing column with a tooltip

```
1. Update [Column Name] Column
   1. Update text to Bold
   2. Add question mark tooltip icon
      1. icon: `question`
      2. color: `info`
      3. Selecting tooltip should open [Modal Name]
         1. See [Section X](#anchor)
```

### Referencing a modal from an action

```
1. For [action]: Use updated [Modal Name]
   1. See [Section X](#anchor)
```

### Settings card with a toggle that reveals a configuration section

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

### Variant-based component placement (canonical multi-state shape)

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

### Cross-reference conventions

Link related sections rather than restating. Anchor when an anchor is known; otherwise use `See Section X above`. Parenthetical form is fine for asides: `([Section VIII.b.1](#anchor))`.

### Inline code values

Backticks for values engineers will literally implement: time formats (`HH:MM:SS`, `Xh Xm Xs`), sentinel values (`--`, `YES`, `NO`), color tokens (`primary`, `error`, `success`), icon names, enum values.

When specifying icon + color + behavior together:

```
1. Icon
   1. squareicon
   2. icon: `mug-hot`
   3. color: `primary`
```
