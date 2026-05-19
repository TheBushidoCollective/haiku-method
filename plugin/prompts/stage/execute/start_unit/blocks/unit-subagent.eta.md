You are executing unit **<%= unit %>** as hat **<%= hat %>** (bolt <%= bolt %>) in stage **<%= stage %>** of studio **<%= studio %>** for intent **<%= slug %>**.
<% if (worktreePath) { %>
**Unit worktree:** `<%= worktreePath %>` (intent dir: `<%= intentRoot %>`). Read and write the intent files at this path — it contains any prior-hat commits not yet merged to the parent branch. **Your FIRST Bash command MUST be `cd <worktree path>`.** Every git, npm, node, and shell command that follows must run from inside the worktree. Git commits land on the unit's branch only if you are inside the worktree's tree. Absolute paths below are for Read/Write tool references, but shell-layer work (install, build, test, commit) requires the cwd to be the worktree. Verify with `pwd` after `cd` if in doubt.

<%~ worktreeAndTimeoutsBlock %>
<% } %>

<%~ requiredContextPreamble %>

<% if (stageInline) { %><%~ stageInline %><% } %>
<% if (executionInline) { %><%~ executionInline %><% } %>
<% if (hatInline) { %><%~ hatInline %><% if (hatInterpBlock) { %>

<%~ hatInterpBlock %><% } %><% } %>
<%~ unitInline %>
<% if (outputsDir) { %>- Stage output templates — `<%= outputsDir %>/`
<% } %>
<% if (priorRejectBlock) { %>
<%~ priorRejectBlock %>
<% } %>
<% if (unitInputPaths.length > 0) { %>
## Unit inputs (MUST read — scoped to this unit)

Inputs may be markdown, HTML, SVG, PNG/JPG, or PDF — fetch each with the appropriate tool.

<% for (const p of unitInputPaths) { %>- `<%= p %>`
<% } %><% } %>
<% if (upstreamPaths.length > 0) { %>
## Available upstream artifacts (stage-wide — read what's relevant)

Not required reading — open only what your unit's scope needs.

<% for (const p of upstreamPaths) { %>- **<%= p.label %>** — `<%= p.path %>`
<% } %><% } %>
<% if (outputReqs) { %>
<%~ outputReqs %>
<% } %>
<% if (skillLines.length > 0) { %>
<%~ skillsPreamble %>

<% for (const l of skillLines) { %><%= l %>
<% } %><% } %>

## Instructions

<% let step = 1 %>
<% if (isStartUnit) { %><%= step++ %>. Call `haiku_unit_start { intent: "<%= slug %>", unit: "<%= unit %>" }`
<% } %>
<% if (worktreePath) { %><%= step++ %>. Commit frequently inside the worktree: `git add -A && git commit -m "..."`. Do NOT push.
<% } %>
<%= step++ %>. When done: call `haiku_unit_advance_hat { intent: "<%= slug %>", unit: "<%= unit %>" }`
<% if (isFirstHat) { %><%= step++ %>. **If blocked**, you are the first hat in this stage's hat sequence — there is no previous hat to reject back to. Do NOT call `haiku_unit_reject_hat`. Instead: surface ambiguity via `AskUserQuestion` (or `ask_user_visual_question` for visual decisions); if upstream-stage outputs are missing, log a stage_revisit feedback at the upstream stage via `haiku_feedback { intent: "<%= slug %>", stage: "<earlier-stage>", title: "<upstream gap>", body: "<what's missing>", origin: "agent", resolution: "stage_revisit" }` and call `haiku_run_next`; if you've found a real defect in the spec or upstream artifact, log it via `haiku_feedback`. The first hat escalates outward, not backward.
<% } else { %><%= step++ %>. If blocked: call `haiku_unit_reject_hat { intent: "<%= slug %>", unit: "<%= unit %>" }`
<% } %>
<%= step++ %>. **CRITICAL — Relay the Workflow Result path.** When `advance_hat`<% if (!isFirstHat) { %> or `reject_hat`<% } %> returns, its tool response contains a result-file path and instructs you to reply with exactly `Workflow Result: <path>`. Your FINAL MESSAGE to the parent MUST BE EXACTLY that one line — nothing before, nothing after. Do NOT summarize the work, do NOT describe what you did, do NOT paraphrase the result. The parent reads the file to drive the next workflow action. If the tool returned plaintext instead of a result path (e.g. "job ends here — parent will call haiku_run_next"), relay THAT plaintext verbatim as your final message.
<%= step++ %>. Track outputs in unit frontmatter `outputs:` field
<%= step++ %>. If outputs from a previous stage are missing: log a stage_revisit feedback at that stage via `haiku_feedback { intent: "<%= slug %>", stage: "<earlier-stage>", title: "<missing output>", body: "<what's needed>", origin: "agent", resolution: "stage_revisit" }` and call `haiku_run_next` — the pre-tick gate routes the rewind.

<%~ autonomyNote %>

<%~ subagentErrorRecovery %>
