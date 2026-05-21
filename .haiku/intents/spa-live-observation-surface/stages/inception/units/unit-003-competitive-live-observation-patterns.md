---
title: Competitive live-observation patterns
description: >-
  Survey how comparable developer tools render live-advancing workflow state,
  what they do well, and the distinct challenge this feature faces that none of
  them solve.
model: sonnet
outputs:
  - stages/inception/artifacts/competitive-landscape.md
iterations: []
reviews:
  spec:
    at: '2026-05-21T03:55:14.425Z'
    body_sha256: 1354382c5ed4a0ddc10745a6e60d6e40fae21c07677c664bd178f08d6a7f040b
    input_witnesses:
      files:
        intent.md: f5cf11b098b96775bcb240f072fb65fd76fef74eeaba5147146900fed1477e35
      dirs: {}
  continuity:
    at: '2026-05-21T03:55:28.688Z'
    body_sha256: 1354382c5ed4a0ddc10745a6e60d6e40fae21c07677c664bd178f08d6a7f040b
    input_witnesses:
      files:
        intent.md: f5cf11b098b96775bcb240f072fb65fd76fef74eeaba5147146900fed1477e35
      dirs: {}
approvals: {}
---
## Topic

Survey the prior art for live-advancing workflow UIs so design borrows proven UX patterns instead of inventing them, and so the *distinct* challenge of this feature is named explicitly.

## What the artifact must cover

- At least three named comparable products and the specific live-observation pattern each demonstrates — for example CI run pages streaming step-level status without layout jump, real-time issue boards reconciling list items in place without losing selection, and deployment dashboards with per-step ticking durations plus deep-linked toasts for new outputs. Each named product gets a one-paragraph note on what it does well that's relevant here.
- The "live default, user-scroll pauses, button resumes" affordance from streaming-log tools, as a candidate pattern for honoring "don't interrupt what I'm reading".
- The distinct challenge that separates this feature from all the surveyed tools: the H·AI·K·U SPA must be *both* a live observation surface *and* an interactive review form (feedback composer, gated approval) in the same view, without either interfering with the other. Read-only dashboards and selection-only boards don't face this.

## Completion criteria

- Names ≥3 specific comparable products (not "various CI tools" or "modern dashboards") with a one-paragraph differentiation each.
- States the distinct challenge (live + interactive in one surface) explicitly as its own section, with a sentence on why the surveyed tools don't address it.
- Each comparison is about *UX behavior the design can borrow* (layout stability, in-place reconciliation, toast deep-linking, scroll-pause affordance) — not about which framework or library those products use.
- Where a claim references a specific product's behavior, the product is named precisely; no anonymous "industry standard" assertions stand alone.
