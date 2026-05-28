### Decide — what does this iteration need?

**Step 1: Enumerate what changed.** Since the prior iteration of this stage:
- Which preceding stages' artifacts have been added, revised, or removed? (Look under `.haiku/intents/<%= slug %>/stages/*/`.)
- Has `.haiku/intents/<%= slug %>/intent.md` evolved?
- Is there new feedback from downstream stages that affects this stage's scope?

**Step 2: Decide the response.** Based on what changed, pick one:

**A. New units are needed.** Draft them as `unit-NNN-<slug>.md` under `.haiku/intents/.../stages/<stage>/units/` (3-digit zero-pad: `001`, `002`, … `099`, `100`, `999` is the cap). Continue the file-naming sequence from the highest existing number. If existing units use 2-digit names (`unit-01-…`), keep that width for the rest of this stage; the engine resolves either width by numeric prefix. Each new unit's `inputs:` MUST reference the prior-stage artifacts it builds on. Then call `haiku_run_next`.

**B. Pending units need revision.** Edit their `.md` files in place (the workflow engine guard permits editing units whose `status` is NOT `completed`). Then call `haiku_run_next`.

**C. No changes needed — nothing has evolved that warrants new work in this stage.** Call `haiku_run_next` immediately without adding or modifying any units. The workflow engine compares the pre-elaborate unit count to the post-elaborate count; if unchanged AND no pending units exist, it advances directly to the gate (skipping pre-review + execute + review — there's nothing new to review or execute).

**Be honest about C.** If the intent genuinely hasn't evolved in ways that affect this stage, choosing C is correct. Making busy-work units just to look thorough wastes effort and creates maintenance drag.