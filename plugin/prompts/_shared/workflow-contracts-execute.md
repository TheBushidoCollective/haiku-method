### Workflow Contracts (REQUIRED — reminder during execute)

> ## ⟁ NO ADVANCE WITHOUT VERIFICATION.
> Run the gate command, read the exit code, *then* call `haiku_unit_advance_hat`. Hedged advances burn bolts on broken work.

- The agent operates inside ONE hat at a time. Each hat runs in a fresh subagent with the hat's mandate loaded from `hats/{hat}.md`. Hat context does not leak across hats — that isolation is the framework's defense against self-reinforcing errors.
- After the hat's work is done, the subagent calls `haiku_unit_advance_hat` (success) or `haiku_unit_reject_hat { reason }` (failure). The workflow engine writes the result; the subagent does not.
- Quality gates run automatically at the end of the hat sequence (last hat's `haiku_unit_advance_hat`). A failing gate at unit completion blocks the advance with a concrete error — fix the failure, don't retry the tool call.
- **Per-hat opt-in gates.** A hat may declare `run_quality_gates: true` in its frontmatter. When it does, gates run on THAT hat's `advance_hat` (not just the last hat's), AND failure auto-rejects: bolt counter increments, the same hat retries, no agent decision required. Bolt cap (5) still applies. This is the framework's way of saying "this hat produces verifiable artifacts; gates are part of its definition of done."
- Cross-unit writes within a stage are forbidden without explicit `inputs:` / `outputs:` declarations on the unit.

#### Verification before advance

- Before calling `haiku_unit_advance_hat`, RUN the gate command(s) and READ the exit code. Do not advance on the assumption that the build/tests/lints pass — if your hat declares `run_quality_gates: true`, the workflow auto-rejects on gate failure and burns one of your 5 bolts.
- Your one-line return summary MUST contain a verb of completed action (`edited X`, `added Y test`, `updated Z`) and ZERO hedging words: `should`, `seems`, `probably`, `might`, `looks like`. Hedging means you are not sure — call `haiku_unit_reject_hat` with that uncertainty as the reason instead of advancing with hedged language.

#### Red flags (STOP and re-read this contract if you catch yourself thinking)

- "I'll skip the gate just this once" — the gate is the contract; bypass is a scope violation.
- "I'll touch the related file too while I'm here" — out-of-scope edits create regressions other hats cannot see; if it's broken, log it via the next review.
- **Did you re-run the gate command and read the exit code 0?** If not, you don't know whether the build/tests/lints actually pass — "probably" isn't evidence. Re-run before calling `haiku_unit_advance_hat`.
- "Another hat's responsibility overlaps with mine, I'll cover it" — stay in your lane; another hat will catch what you skip.
- "The user said go fast, so I'll abbreviate the work" — speed comes from fewer rejections, not skipped steps.