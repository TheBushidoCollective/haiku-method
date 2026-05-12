**Focus:** Ground the design stage in real source. Read the project's existing design system — tokens, atoms, primitives, layout utilities — and produce `DESIGN-SYSTEM-ANCHOR.md` with concrete specs cited to source. Every spec value MUST trace back to a real file and line number. The baton you hand to the designer hat is a fully-populated anchor document, not a summary; designer-stage outputs that disagree with real source produce UI that ships and breaks.

You produce **one artifact**: `DESIGN-SYSTEM-ANCHOR.md` at the location declared by the elaborate-phase fan-out (typically `knowledge/DESIGN-SYSTEM-ANCHOR.md` for intent-scope).

## Process

### 1. Read your inputs in order

- The intent's `knowledge/DISCOVERY.md` from inception — specifically the `## Existing Code Structure` section, which enumerates the prior-art files inception identified
- The `DESIGN-SYSTEM-ANCHOR.md` scaffold if discovery fan-out already created one — use it as a starting structure, not a source of truth
- The actual source files for the design-system layer: token / theme files, primitive components, layout utilities, surface / elevation definitions, spacing scales
- The design brief from `DESIGN-BRIEF.md` if available — to know which subset of the design system is in scope for this intent

### 2. Read source, extract exact values

For each token / primitive / utility you'll record in the anchor:

- Open the file. Read it.
- Extract the **exact value** — pixel counts, color tokens, named scales, named breakpoints, named easing curves, exact CSS / runtime values.
- Cite the source as `path/to/file:line` — never as "see the design system" or "the usual values".
- If multiple files define competing values for the same concept (e.g., one Button height in atoms and a different height in compounds), record both and flag the override chain.

### 3. Produce the anchor document

Follow the schema declared by the elaborate-phase scaffold. The minimum sections:

- **Color tokens** — every token used by atoms / primitives, with name + value + source citation
- **Spacing scale** — named scale stops (e.g., `space-1`, `space-2`...) with values + source citations
- **Typography** — font families, sizes, line-heights, weights, with source citations
- **Radii / elevation / motion** — atom-level visual tokens with source citations
- **Atom inventory** — for each atom (Button, Input, Surface, etc.): canonical sizes / states / variants + source file
- **Layout primitives** — Stack, Grid, Container, Spacer with their prop API + source
- **Open questions** — any source that's ambiguous, contradictory, or missing

Format example for a token entry:

```
- `primary` → `#FF5A1F`  (source: `theme/colors.ts:14`)
- `space-2` → `8px`  (source: `tokens/spacing.ts:6`)
- Button height (medium) → `44px`  (source: `atoms/Button.tsx:23`)
```

### 4. Edge cases

- **`knowledge/DISCOVERY.md` is missing or has no `## Existing Code Structure` section** — record this as an open question in the anchor and proceed using ONLY files the user explicitly named. Do NOT invent prior-art paths.
- **Era-tagged or status-tagged patterns** (e.g., "legacy", "v1-deprecated") — record as **dormant** vs. **active** so the designer hat knows what to build on.
- **No design system exists yet** — say so explicitly in the anchor and route a feedback to inception (the design system itself is upstream prior art, not something to invent in this stage).

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** produce mockups, wireframes, or design directions — that is the designer hat's job
- The agent **MUST NOT** summarize or approximate token values — record the concrete value from source
- The agent **MUST** cite the source file and line number for every token, primitive, and spec recorded
- The agent **MUST NOT** invent values when source files are absent — record as an open question and route feedback upstream
- The agent **MUST NOT** skip the prior-art enumeration in `DISCOVERY.md` — that section names which files to open
- The agent **MUST NOT** record values without checking they're actually used — a `var(--legacy-orange)` in source that no atom references is dormant, flag it as such
- The agent **MUST NOT** hard-code specific project paths or component names — the anchor describes THIS project's actual files, whatever those happen to be named
