You are researching and producing the "<%= artifactName %>" discovery artifact for intent "<%= slug %>" in stage "<%= stage %>" of studio "<%= studio %>".
<% if (worktree) { %>
## Isolation worktree (REQUIRED)

Do ALL work for this subagent inside the dedicated worktree at:

    <%= worktree %>

This worktree is on branch `<%= branchName %>`, forked from the stage branch at dispatch time.

<% if (expectedArtifactPath) { %>## Required artifact path (EXACT)

You MUST create exactly ONE file at this absolute path:

    <%= expectedArtifactPath %>

This is the path the engine's existence check reads. Writing the artifact anywhere else (a different filename, a different directory, intent main instead of the worktree) will cause `haiku_discovery_complete` to return `discovery_artifact_missing` and the cursor to keep flagging discovery as incomplete on every tick.

<% } %>**Rules:**
- Write the populated discovery artifact at the EXACT path above (inside the worktree, not on intent main).
- Commit your work via `git -C "<%= worktree %>" add -A && git -C "<%= worktree %>" commit -m "..."` (no push).
- When the artifact is complete and committed, call `haiku_discovery_complete { intent: "<%= slug %>", stage: "<%= stage %>", template: "<%= artifactName %>" }`. The engine verifies the file exists at the expected path, then takes a per-stage lock and merges your branch into the stage branch, then reaps the worktree + branch. On clean success the tool returns `{ ok: true }` and you're done. On `discovery_artifact_missing` you skipped or misplaced the write — the response carries the expected path; write the file there, commit, and re-call. On `discovery_merge_conflict` the response lists the conflict files — surface that to the parent agent so the integrator can resolve. On `discovery_merge_failed` the response carries the git error — surface it and stop.
- Do NOT run `git worktree remove`, `git branch -d`, or `git merge` yourself — `haiku_discovery_complete` owns those.
<% } %>
## Required context (inlined below)

The intent goal, stage scope, and your discovery template are embedded below — no need to fan out Read tool calls for them.

<%~ intentInline %>
<% if (stageInline) { %><%~ stageInline %><% } %>
<%~ templateInline %>

## Scope (STRICT)

- You research **only** the axis defined by the "<%= artifactName %>" template. Other discovery artifacts in this stage are being researched by **sibling subagents in parallel** — do NOT investigate adjacent domains, do NOT pre-empt their work, do NOT leave notes for them.
- If you encounter information that belongs primarily in a sibling artifact, do NOT write it to the sibling's file path — that creates merge conflicts at the integrator step. Note it briefly as a *context boundary* in your own artifact (e.g. *"depends on auth model — see security artifact"*) and let the sibling agent author the substance. Cross-cutting constraints that genuinely shape multiple axes (security boundaries, hard dependencies) should be noted in your artifact too, in the boundary section, so they're not lost if the sibling misses them.
- Your write path is ONE file at the template's `location:`. Any other file write — sibling artifacts, intent.md, unit specs, knowledge files outside your `location:` — is a scope violation.
- Do NOT attempt to summarize or synthesize across sibling artifacts. The elaborate phase does that on the next workflow tick, after all discovery merges back.

## Instructions

1. Research the problem space along the axis defined by your template.
2. Use the template's Content Guide as the document structure.
3. Meet the template's Quality Signals as your acceptance bar.
4. Write the populated document to the stage's discovery path as defined in the template's `location:` frontmatter above — **inside your isolation worktree** when one is allocated. **This is your ONLY write path** — any file written elsewhere is a scope violation.
5. Commit the artifact inside your worktree (see the Rules block above for the exact git invocation).
6. Call `haiku_discovery_complete { intent: "<%= slug %>", stage: "<%= stage %>", template: "<%= artifactName %>" }` to merge your work into the stage branch. The engine takes a per-stage lock so parallel siblings serialize. Surface any conflict / failure response to the parent agent.
7. Be thorough on YOUR axis — this artifact informs all downstream work. Thoroughness within scope is the goal; thoroughness across scope is a violation.
