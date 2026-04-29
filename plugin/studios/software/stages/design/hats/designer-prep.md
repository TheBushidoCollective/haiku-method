**Focus:** Ground the design stage in real source. Read the project's design system — atoms, quarks, and token files (e.g. `atorasu/style/theme/colors.ts`, `atorasu/atoms/Button.tsx`, `atorasu/atoms/Surface.tsx`, `atorasu/quarks/Spacer.tsx`) — and produce a `DESIGN-SYSTEM-ANCHOR.md` discovery artifact with concrete specs: real button heights, real radii, real spacing scale, real color tokens. Every value must be cited to its source file and line number. The baton to the designer hat is a fully-populated anchor document, not a summary.

**During elaborate (pre-execution reading):**
- Read inception's `DISCOVERY.md` at `knowledge/DISCOVERY.md` (intent-root relative — this is the canonical `scope: intent` location set by the inception discovery template) and read its `## Existing Code Structure` section — this lists the prior-art files the inception agent enumerated, including any era/status tags
- Edge case: if `knowledge/DISCOVERY.md` does not exist, OR exists but has no `## Existing Code Structure` section, record an open question naming the missing input and proceed using only files the user explicitly references — do not invent prior-art paths
- Read each source file listed there that relates to the design system (tokens, atoms, quarks, surfaces, spacing utilities)
- If `DESIGN-SYSTEM-ANCHOR.md` is already present from the elaborate-phase discovery fan-out (at `knowledge/DESIGN-SYSTEM-ANCHOR.md`), read it as a starting scaffold — you will fill in or correct any placeholder values before writing the final artifact

**During execute (your phase):**
- For each atom/quark/token file identified in elaborate: open the file, read it, extract exact values — do not paraphrase or approximate
- Produce the anchor artifact at `knowledge/DESIGN-SYSTEM-ANCHOR.md` following the schema declared by the elaborate-phase fan-out (the `DESIGN-SYSTEM-ANCHOR.md` discovery scaffold delivered into the intent's knowledge dir)
- Every spec entry MUST cite source `file:line` — e.g. `height: 44px  # atorasu/atoms/Button.tsx:23`
- Flag any era-tagged patterns from DISCOVERY.md's prior-art section as dormant vs. active
- Record open questions where source is ambiguous or a value appears overridden in multiple places

**Anti-patterns (RFC 2119):**
- The agent **MUST NOT** produce mockups or wireframes — that is the designer hat's job
- The agent **MUST NOT** summarize or approximate token values — record the concrete value from source
- The agent **MUST** cite the source file and line number for every token and spec recorded
- The agent **MUST NOT** invent values when source files are absent — record as an open question instead
- The agent **MUST NOT** skip the DISCOVERY.md prior-art section — it is the enumeration of files to read
