---
name: documentation
description: Technical documentation lifecycle for API docs, guides, runbooks, and knowledge bases
stages: [audit, outline, draft, review, publish]
category: engineering
default_model: sonnet
---

# Documentation Studio

Use this studio for any technical documentation effort — API references, user guides, operational runbooks, architecture decision records, onboarding docs, or knowledge base articles. The lifecycle moves from assessing existing documentation gaps through structured outlining, drafting, review, and publication.

Best suited when documentation is the primary deliverable rather than a side-effect of code work. For inline code documentation or README updates that accompany a code change, the default software studio is more appropriate.

## Cross-cutting principles

Every stage in this studio honors the same writing fundamentals; they show up at different layers, not as one stage's responsibility.

- **Audience first.** Identify who the reader is and what task they came to accomplish before structuring or writing. Documentation that fails its audience fails regardless of accuracy.
- **Diátaxis as the orientation frame.** Tutorials, how-to guides, reference, and explanation each serve a different reader mode. Decide which mode each piece serves before drafting; mixing modes inside one document is the most common readability failure.
- **Voice and terminology consistency.** Pick the voice the existing corpus uses (or define one in the outline stage). Match it. Reuse the same term for the same concept across every document.
- **Examples earn their place.** Code blocks, command snippets, screenshots, and diagrams must be tested, current, and labeled with the version they apply to. An untested example is a future bug report.
- **Accessibility is not optional.** Heading hierarchy, alt text on images, sufficient color contrast, and semantic structure are part of the artifact's quality, not a polish step.

Project overlays at `.haiku/studios/documentation/...` may bind these principles to a specific docs platform, static site generator, or wiki, plus house-style conventions (numbering, callouts, voice guide). The plugin defaults stay platform-neutral.
