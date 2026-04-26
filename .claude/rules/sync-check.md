# Sync Check Rule

Before completing any work that modifies the plugin, paper, or website, verify cross-component consistency:

## Before any structural change:
- [ ] Read `plugin/studios/ARCHITECTURE.md` first — it is the canonical source of truth for studio/stage/unit/hat/feedback structure. Conflicts between it and other docs are resolved by fixing the other docs. Conflicts between it and the implementation are resolved by fixing the implementation (unless an explicit revision proposal updates the doc first).

## After modifying plugin/studios/ or plugin/studios/*/stages/:
- [ ] Is the concept documented in the paper?
- [ ] Does the website docs section reference it (if user-facing)?
- [ ] Do requires/produces chains form a valid pipeline?
- [ ] Does the stage's `hats:` list follow plan → do → verify (architecture §3)? Does each hat-to-hat handoff have a meaningful baton (rally-race test)?
- [ ] If you added a hat, is its name distinct from phase names (`elaborate`/`execute`/`review`/`gate`)? See architecture §3.1.
- [ ] If the stage produces knowledge artifacts (research/distillation role), does its `phases/ELABORATION.md` describe knowledge-artifact criteria (substance, citation, accountability) — NOT executable verify-commands?
- [ ] If the stage produces execution-unit specs (build role), does its `phases/ELABORATION.md` describe build-class criteria (depends_on, executable quality_gates, criteria-with-verify-commands)?

## After modifying the paper:
- [ ] Does the plugin implement what the paper describes?
- [ ] If aspirational (not yet implemented), is it clearly marked as such?

## After modifying website/content/:
- [ ] Are claims about the methodology accurate to the paper?
- [ ] Are claims about the plugin accurate to the implementation?

## After adding or renaming terminology:
- [ ] Updated in paper glossary
- [ ] Updated in CLAUDE.md terminology table
- [ ] Updated in all stage files that reference it
- [ ] Updated in website docs

## Terminology reminders:
- Studio = named lifecycle template (profile implementation), contains stages
- Stage = lifecycle phase within a studio, contains file-based hats and review gates
- Hat = behavioral role scoped to a stage (defined as files in `stages/{stage}/hats/`, not standalone)
- Bolt = iteration cycle (tracked as `iteration` in state), NOT the same as Unit
- Studio > Stage > Unit > Bolt is the four-layer hierarchy, all distinct concepts
