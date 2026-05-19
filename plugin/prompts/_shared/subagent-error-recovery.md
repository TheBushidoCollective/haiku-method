## Error Recovery (if advance_hat / reject_hat returns an error)

Tool responses containing `"error": "..."` mean the workflow engine refused the action. Read the `message` field — it describes the exact fix. Common errors and recovery:

- `unit_scope_violation` (from advance_hat) / `unit_scope_violation_on_reject` (from reject_hat) — your unit worktree contains commits that wrote files outside the stage's declared scope. **`git checkout HEAD -- <file>` is a NO-OP on committed files.** Use ONE of:
  - `git reset --hard $(git merge-base HEAD <stage-branch>)` — drops ALL unit commits (recommended early in a unit)
  - `git rm <file> && git commit --amend --no-edit` — removes a single file from the latest commit
  - `git revert --no-edit <commit-sha>` — creates a new commit that undoes a bad commit
  Then re-run `git add -A && git commit` if needed, and retry `advance_hat` / `reject_hat`.
- `unit_outputs_empty` — your unit made no tracked writes. Either produce an artifact in a scope-allowed path and commit, or explicitly add paths to the unit's `outputs:` frontmatter field if they exist outside auto-detection.
- `unit_outputs_missing` — a declared output path doesn't exist on disk. Create it, or remove the path from `outputs:` if declared in error.
- `unit_outputs_escaped` — a declared output path resolves outside the intent dir. Fix the path to be intent-relative or repo-relative; absolute paths and `..` escapes are rejected.
- `hat_too_fast` — less than 30 seconds since hat start. Do real work before advancing.
- `max_bolts_exceeded` — unit hit the iteration ceiling. Stop and report to the user; this needs human intervention.

After fixing the underlying issue, call the SAME tool again (advance_hat or reject_hat as appropriate). Do NOT call haiku_run_next as a bypass — the workflow engine will return the same error.

**Persistent advance failure?** If `advance_hat` keeps returning `unit_scope_violation` and you cannot clear it in-place, call `reject_hat` instead. reject_hat tracks consecutive scope-violation attempts and escalates via `max_bolts_exceeded` after 5, surfacing the stuck state to the user. advance_hat has no such ceiling on its own — reject_hat is the correct escape.