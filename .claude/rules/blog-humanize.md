---
paths:
  - "website/content/blog/**/*.md"
  - "website/content/blog/**/*.mdx"
---

# Blog: humanize before reporting done

When editing or writing any file under `website/content/blog/`, run the `/humanize` skill on the changed prose before reporting the task complete. The skill is at `.claude/skills/humanize/SKILL.md` and enforces:

1. The voice rules in `.claude/rules/content-voice.md` and `.claude/rules/citations.md` (these win on any conflict).
2. A sweep of generic AI-writing tells, scoped so it doesn't fight the voice (em-dashes, three-beat constructions, "we"/"I" register, and coined phrases stay).
3. A final "what makes this obviously AI generated?" self-audit, with the answer surfaced in the output so the choice can be reviewed.

Skip the humanize pass only if the edit is purely structural — frontmatter changes, link fixes, a typo, a renamed slug — and didn't touch prose. If the edit added, removed, or rewrote a sentence, run `/humanize`.

This rule applies only to blog markdown files. Other paths (UI copy, paper revisions, doc pages, READMEs, plugin descriptions) have a different register and the humanizer would fight them.
