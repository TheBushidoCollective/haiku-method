---
title: >-
  DESIGN-TOKENS.md §2.2 origin icons directly contradict DESIGN-BRIEF §2
  canonical mapping
status: pending
origin: adversarial-review
author: consistency
author_type: agent
created_at: '2026-04-20T02:55:42Z'
iteration: 3
visit: 3
source_ref: null
closed_by: null
---

Two source-of-truth documents in the same stage disagree about which emoji codepoint each feedback origin uses. Both claim authority; downstream implementers cannot tell which to follow.

**`DESIGN-BRIEF.md §2 FeedbackOriginIcon`** (lines 206-223) declares canonical mapping and says "Every artifact and every React/SSR render MUST use the code points above":

| Origin | Icon | Codepoint |
|---|---|---|
| adversarial-review | 🔍 | U+1F50D (magnifying-glass) |
| external-pr / external-mr | 🔗 | U+1F517 (link) |
| user-visual | ✎ | U+270E |
| user-chat | 💬 | U+1F4AC |
| agent | 🤖 | U+1F916 (robot) |

**`knowledge/DESIGN-TOKENS.md §2.2`** (lines 284-289) declares a different mapping for the same origins:

```tsx
const originIcons: Record<string, string> = {
  "adversarial-review": "\\uD83D\\uDEE1\\uFE0F",  // shield 🛡
  "external-pr":        "\\uD83D\\uDD00",          // shuffle 🔀
  "user-visual":        "\\uD83D\\uDC41\\uFE0F",   // eye 👁
  "agent":              "\\u2728",                 // sparkle ✨
};
```

Plus the "Icon Suggestion" column of the same table says "Shield / target", "Git branch / PR icon", "Eye / annotation pin", "Sparkle / robot" — none of which match the DESIGN-BRIEF canonical set.

Downstream artifacts are split: some render the BRIEF set (e.g. `aria-landmark-spec.md §6`), others the TOKENS set (e.g. `state-signaling-inventory.html:84,95,113,125,173,184,211,222,238,250,293,304` still uses 🛡/🔀/✨; `feedback-card-states.html:495,521` still uses `&#x1F6E1;&#xFE0F;` = 🛡). Unit-16's quality gate explicitly banned 🛡/🔀/✨ / `&#x1F6E1` / `&#x1F500` / `&#x2728` and was marked satisfied. The gate fails on live file contents.

**Recommended fix:** pick one source of truth (DESIGN-BRIEF is the explicit canonical per line 217), then rewrite `DESIGN-TOKENS.md §2.2` to reference the BRIEF codepoints verbatim, delete the "shield/shuffle/eye/sparkle" text including the "Icon Suggestion" column, and re-run the unit-16 gate until `grep -rnP '\\U0001F6E1|\\U0001F500|✨|&#x1F6E1|&#x1F500|&#x2728' stages/design/artifacts/ DESIGN-BRIEF.md` returns 0.
