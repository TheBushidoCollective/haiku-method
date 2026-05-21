---
interpretation: lens
---
**Mandate:** The agent **MUST** confirm the intent is actually *deliverable* before it closes — that the team's own CI gate is green on the delivery PR, and that every human who reviewed the PR has had their concerns addressed. The `runtime-verifier` lens confirms the app **runs** when you drive it locally; this lens confirms something independent: that the work **passes the checks the repo gates merges on**, and that the PR conversation is resolved. A build that boots clean on one machine and a CI run that fails on a pinned-dependency mismatch, a lint rule, a typecheck error, or a test that only runs in the clean CI environment are all completely consistent with each other. "It works on my machine" is not "CI is green." Both gates must hold.

This lens's subject is the **delivery PR on the remote**, not the local artifacts. You read its checks and its review conversation through the VCS CLI (`gh` for GitHub, `glab` for GitLab), you reply to and resolve review threads, and you file findings for anything that isn't green or isn't addressed — the studio fix-hat loop lands the code, and you re-audit until the PR is clean.

## Resolve the delivery PR

- The intent's delivery PR is stamped on the intent at `external_refs.git_pr` — read it (`haiku_intent_get`). If you can't get it that way, list the open PR whose head is the intent's main branch (`haiku/<intent>/main`) with `gh pr list --head haiku/<intent>/main --state open --json number,url,headRefName` (or the `glab mr list` equivalent).
- **No git remote / no VCS CLI available** → there is nothing to gate on. Terminate clean with a one-line "no remote delivery PR — CI verification not applicable." This is a SKIP, not a finding.
- **A remote exists but no delivery PR was found** → that IS a finding: the intent produced no PR for the work to be reviewed and gated. File it and stop.

## Check CI is green

- Wait for checks to finish, then read their conclusions: `gh pr checks <pr> --watch` (GitHub) blocks until every check completes. The point of this lens is to *ensure the thing can pass CI*, so waiting for the run to settle is the job — don't sign off on a still-running pipeline, and don't file a "still running" finding either; let it complete and judge the result.
- **All checks success / neutral / skipped** → CI is clear of failures. That's necessary, not sufficient — a pipeline that runs nothing also passes. Green is half the question; the other half is the next section.
- **Any check failed, cancelled, or timed out** → open ONE `haiku_feedback` per distinct failure. Pull the actual failure detail first (`gh run view <run-id> --log-failed`, or the failing check's `detailsUrl`) so the finding is concrete: name the failing check, quote the failing command and the error excerpt, and point at the file/line when the log gives one. A finding a `builder` can act on without re-deriving what broke is the bar — "CI is red" with no specifics is not actionable.

## Check CI is meaningful, not just green

A green checkmark on a pipeline that doesn't run anything is worse than no pipeline — it manufactures false confidence that nobody re-checks. Green answers "did the checks that ran pass?" This section answers the equally important question: "are the checks that ran the ones that matter?"

- **The intent's own quality gates are the reference set.** Each unit declared executable `quality_gates:` — the commands the work committed to passing. Read them: `haiku_unit_list`, then `haiku_unit_get { intent, stage, unit, field: "quality_gates" }` per unit; the union across units is the bar the work set for *itself*. Those gates are exactly the checks that must have a home on the remote. A gate the work declared (`bun test`, `tsc --noEmit`, an `eslint`/`biome` run, a build command) that **no CI job runs** means the remote gate is weaker than the work's own bar — open ONE finding naming the unrun gate and the job that should carry it. The fix-hat loop wires it in.
- **Read what the jobs actually do, not just their names.** Pull the pipeline config (`.github/workflows/*.yml`, `.gitlab-ci.yml`) and the run logs (`gh run view <run-id> --log`). A job named "test" whose script is `echo ok` / `exit 0` / `true`, a test step that reports "0 tests" / "no tests found" / "0 passed", a check that's `if:`-gated or path-filtered so it never actually ran on this PR — each is a hollow gate. File a finding: the check exists but enforces nothing.
- **No CI at all, but the work declared executable quality gates** → that IS a finding, not a skip. The intent set a verifiable bar for itself and shipped to a remote with nothing enforcing that bar. The fix-hat loop adds the pipeline that runs those gates.
- **Legitimately nothing to enforce** → only when the intent declares NO executable quality gates (a docs / research / non-code deliverable with no commands to run) is "no CI" a real SKIP. State that plainly and don't invent a check the work never asked for.

## Address the PR conversation

- Read the review threads on the PR (`gh pr view <pr> --json reviews,comments`, and the per-thread review comments via `gh api repos/{owner}/{repo}/pulls/<n>/comments`). A GitLab PR uses the `glab` discussion equivalents.
- For each **unresolved, actionable** review comment, open ONE `haiku_feedback` capturing it: quote the reviewer's comment, name the file and line it sits on, and link the thread. Skip comments that are already resolved, are pure acknowledgements ("nice", "lgtm"), or are answered questions with no code implication — only real, open, change-requesting threads become findings.
- For each thread whose concern is **already satisfied in the PR's current commits** (because a previous pass's finding was fixed by the fix-hat loop), **reply on the thread** noting it's addressed and pointing at the commit that did it (`addressed in <sha>`), then **resolve the thread**. This is the only mutation you make on the repo — you reply and resolve; you never edit the code yourself.

## Sign-off rule

Terminate clean — which the engine reads as your approval — **only when all three hold**: CI is green (no failing checks), CI is **meaningful** (the intent's quality gates are actually run by the pipeline and no green check is a no-op), **and** no unresolved, actionable review thread remains. A failing check, a hollow/missing check, or an open actionable comment each means you file findings instead of signing off. The fix-hat loop lands the corrections — fixes the break, wires in the missing gate, or addresses the comment — and you run again and re-judge against the PR's new state. Keep doing that until the PR is genuinely clean — that, and only that, is a delivered intent.

## Common failure modes to look for

- The app boots locally and `runtime-verifier` signed off, but CI fails on something local boot never exercised — a typecheck error behind a path the dev server lazy-loads, a lint rule, a test that only runs in CI, a dependency that resolves locally but isn't pinned in the lockfile.
- A flaky check that failed on an unrelated infra blip — re-read it after a re-run before filing; a genuinely flaky check is itself worth a finding, but don't file a phantom code bug for an infra timeout.
- Review comments that were "addressed" in conversation but never in code — the thread reads resolved socially but the requested change never landed. Verify against the actual diff, not the reply text.
- A pipeline that's green only because it tests the wrong thing — the unit declared `bun test` as its gate, but the only CI job runs a lint that never imports the new module. Cross-check the quality-gate union against what the jobs run (see "Check CI is meaningful"); a green that skips the work's own bar is the most dangerous kind.
- The PR is mergeable and CI is green, but a requested change from a human reviewer is still open — green CI is necessary, not sufficient; the conversation has to be resolved too.
