---
title: >-
  DESIGN-SYSTEM-ANCHOR.md token example uses raw hex values, contradicting the
  named-token requirement
status: closed
origin: adversarial-review
author: consistency (from design)
author_type: agent
created_at: '2026-04-28T23:52:29Z'
iteration: 1
visit: 1
source_ref: null
closed_by: 'fix-loop:FB-03:bolt-2-manual'
bolt: 2
triaged_at: '2026-04-28T23:52:29Z'
resolution: null
replies: []
---

## Finding

The worked example in `plugin/studios/software/stages/design/discovery/DESIGN-SYSTEM-ANCHOR.md` §2 ("Tokens") shows raw hex values as the canonical output format:

```
- brand-primary: #1A73E8    # colors.ts:12
- surface-bg: #FFFFFF       # colors.ts:18
- text-primary: #212121     # colors.ts:24
```

This directly contradicts the design system's named-token requirement, which is enforced in three places:
- `plugin/studios/software/stages/design/hats/designer.md:8` — "no raw hex values, no magic numbers"
- `plugin/studios/software/stages/design/hats/designer.md:28` — "MUST NOT use raw hex colors instead of named tokens"
- `plugin/studios/software/stages/design/hats/design-reviewer.md:10` — "MUST NOT accept raw hex values — named tokens are REQUIRED"

## Spirit-violation

The anchor template instructs the designer-prep agent that `brand-primary: #1A73E8` is the correct output shape. The designer hat is then told to read the anchor first and use "those values, not guesses" (`designer.md:4`). This creates a compliant-looking pipeline that reliably routes raw hex values into the designer's working context — the exact failure mode the named-token requirement exists to prevent.

The anchor template's purpose is to extract source-code ground truth for downstream use. Raw hex values belong in the anchor as the *source value* — but the template must also instruct the prep agent to map each value to its named token (or flag it as a gap if no named token exists). Without that mapping step, the anchor becomes a raw-value delivery vehicle.

## Recommendation

Update the DESIGN-SYSTEM-ANCHOR.md template's §2 Tokens content guide and worked example to:
1. Add a `token-name` column alongside the raw value: e.g. `brand-primary: #1A73E8  (token: color-brand-primary)  # colors.ts:12`
2. Add an instruction that the prep agent MUST map every extracted color to its named token from `DESIGN-TOKENS.md`, and must flag any color that has no named token as an open question
3. Add a Quality Signal entry: "Every color entry shows both its raw source value (for verification) and its named token alias"

This way the anchor serves its verification purpose (you can check the hex against source) while not normalizing raw hex as the format downstream hats consume.
