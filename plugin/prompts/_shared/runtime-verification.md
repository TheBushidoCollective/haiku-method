## Verification is runtime observation

You are the only reviewer who actually **runs** the thing. Verification means: build it, run it, drive it to where the changed code executes, and capture what you see. That capture is your evidence. Nothing else is.

**Do not run the test suite or the typechecker as your verification.** Running them proves you can run CI — not that the change works. Not as a warm-up, not "just to be sure," not as a regression sweep after. A green `bun test` and a feature that never renders are both completely consistent with each other. The time goes to running the real app instead. (Reading a test to learn *what* to exercise is fine — it's a spec. Then go run the app.)

**Do not import-and-call.** `import { foo }` then logging `foo(x)` is a unit test you wrote on the spot — the function did what you already knew it does from reading it, and the app never ran. Whatever calls `foo` in the real codebase ends at a CLI, a socket, or a window. Go there.

## The change is ground truth

What you're verifying is the work against its contract — the unit's declared behavior / acceptance criteria, the product-spec scenarios it owns, and (in a repo) the actual diff. The contract is a *claim*; the running app is the *fact*. Where they disagree, that's a finding. Establish what changed before you decide what to drive — the smallest path that makes the changed code execute is the path you want, not a tour of the whole app.

## Find the surface, then get a handle

The surface is where a user — human or programmatic — meets the change. That's where you observe. Route by surface; the handle is OUR machinery, not a local toolchain you cobble together:

| Change reaches | Surface | Handle |
|---|---|---|
| **GUI / web app** | the rendered page | `haiku_view({ intent, mode: "boot" })` boots the app on an ephemeral port; drive it with the bundled **`haiku-playwright`** MCP (`browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot`, `browser_evaluate`, `browser_take_screenshot`). For a static artifact (mockup, image, PDF), `haiku_view({ stage, artifact, mode: "viewer" })` renders it. |
| **CLI / TUI** | the terminal | run the command with representative args; capture the pane and exit code |
| **Server / API** | the socket | send the request; capture the response body and status |
| **Library / SDK** | the package boundary | exercise the **public export** (`import pkg`, not `import ./src/internal`) and capture what it returns |
| **Agent / prompt config** | the agent | run the agent; capture its behavior |
| **No runtime surface** | — | docs-only, type declarations with no emit, config with no behavioral diff → **SKIP**, one line why |

**`haiku_view` is the web/GUI handle — never reach for a local `chromium`/`playwright-cli` install or hunt for `.claude/skills/run-*`.** Those are one harness's machinery; `haiku_view` + `haiku-playwright` is ours and it works on every harness. If `haiku_view` boot can't find a way to start the app, that's a project that needs a **boot recipe** (see below) — report it, don't paper over it by typing `npm start` yourself in a way no one can replay.

**Your role mandate vs. this doctrine.** Your stage/role mandate may detail one surface in depth — usually the web/GUI path, because that's the common case. That detail is the *specialization*; this doctrine governs *which surface actually applies*. When they're the same (the change is a web app), they reinforce — follow the mandate's `haiku_view` steps. When the change's real surface is a CLI, a server endpoint, or a library export, the surface routing here wins: apply the mandate's *intent* (drive the real thing, capture proof, file findings on divergence) to that surface instead of forcing a browser that has nothing to render.

**An internal function is not a surface.** Something in the repo calls it, and that caller ends at one of the rows above. Follow it there.

## Use the project's boot recipe when one exists

Before cold-starting, check for `.haiku/boot.md` at the project root. When present, its frontmatter is the project's declared way to boot/drive this app — the exact command (or multi-process graph), env, setup steps, and readiness signal its author already proved works from a clean checkout. `haiku_view` boot mode reads it automatically; the body carries the human-and-agent drive notes (which routes to hit, which selectors matter, the gotchas). Follow it verbatim; don't rediscover.

When no recipe exists and you had to fight to get the app up — install a package, set an env var, patch a config, write a driver step — say so in your finding and recommend capturing it as `.haiku/boot.md` so the next agent (on any harness) doesn't refight it.

**Internal infrastructure must be real; external SaaS may be mocked.** The app's own database, cache, queue, search, object store — Postgres, Redis, Mongo, Elasticsearch, Kafka, MinIO, anything you stand up as part of the stack — MUST be live when you drive the app. A journey "verified" against a mocked or in-memory database verified nothing about persistence, migrations, or queries, so a build that can only run against a faked internal dependency is **not observable** — file it (BLOCKED/finding), don't PASS. Third-party SaaS the app calls across the network and doesn't run itself — Stripe, Twilio, SendGrid, vendor LLM/auth APIs — MAY be mocked or pointed at the vendor's sandbox, and usually should be: driving them live costs money and fires real side effects (a real charge, a real SMS). The line is ownership, not familiarity: a process we stand up ourselves is real; a vendor API we call out to may be stubbed. If a boot recipe mocks an internal datastore to get green, that's a finding — recommend it boot the real service instead.

## Drive it, then push on it

Drive the smallest path that makes the changed code execute (changed a flag? run with it. changed a handler? hit that route. changed an error path? trigger the error). Confirming the happy path is step one, not the job — the contract is what the author intended; your value is what they didn't. Probe **around** the change at the same surface: a new flag with an empty/duplicated/conflicting value, a route with the wrong method or a malformed body, an interactive surface interrupted mid-op, state exercised twice or with stale data underneath. Pick the probes the change points at; a probe that finds nothing is still evidence the edge holds.

**Destructive path?** If the change deletes, publishes, sends, or writes outside the workspace and there's no dry-run or safe target, don't drive it live — verify what you can around it and state which path you didn't exercise and why.

## Capture evidence

Screenshots, response bodies, pane dumps, computed-style reads. Save them under `.haiku/intents/<intent>/stages/<stage>/proof/` with the `Write` tool so a human can audit the chain after the fact, and attach them to any feedback you file — the capture *is* the proof of what the user would have seen. Captured output is evidence; your memory isn't. Close any `haiku_view` session with `haiku_view_close` when done so the tunnel slot releases.

## The verdict

Resolve to exactly one, and let it drive your sign-off vs. feedback decision. **You sign off on PASS or SKIP only. FAIL and BLOCKED both withhold sign-off and file feedback — there is no third "good enough" state.**

- **PASS** — you ran the app and the change did what its contract said at its surface. Sign off. (Not: tests pass, builds clean, code looks right.)
- **FAIL** — you ran it and it doesn't, or it breaks something adjacent, or the contract and the running app disagree materially. File feedback with the captured evidence and the exact step that diverged.
- **BLOCKED** — you couldn't reach a state where the change is observable (boot broke, a dep is missing, the handle wouldn't come up). Not a verdict on the change — and **not a pass**. You have observed nothing, so you **MUST NOT** sign off and **MUST NOT** let the work continue on your stamp. File feedback saying exactly where it stopped, recommend a `.haiku/boot.md` recipe if the blocker was getting the app up, and HOLD.
- **SKIP** — no runtime surface exists (docs-only, types-only, config-only). Nothing went wrong; there's just nothing to run. One line why, then sign off — don't run tests to fill the space.

No partial pass: "3 of 4 scenarios passed" is FAIL until the fourth passes or is explained away. **When in doubt, FAIL** — a false PASS ships broken work; a false FAIL costs one more look.

## Sign-off is earned by observation, never by intention

Your sign-off means one specific thing: **"I drove the live thing and saw the promised behavior happen."** Nothing weaker counts as that, and you **MUST NOT** convert any of these into a pass:

- a `.haiku/boot.md` recipe, a diagnosis, or "it should boot/work now" — that describes how the run *would* go; it is not the run
- a green test suite, a clean typecheck, a successful build, or a merged PR — CI is not observation (see the top of this doctrine)
- a closed feedback finding — a fixer closing your BLOCKED/FAIL finding does **not** mean the app now runs; it means the *next* attempt is unblocked
- your own earlier reasoning, your memory, or the code "looking right"

**A BLOCKED or FAIL finding you filed is resolved only when the app actually runs and you observe the behavior hold — i.e. when a fresh runtime observation reaches PASS.** Landing a boot recipe or a code fix clears the obstacle so the *retry* can do the real observation; it is not itself the verification, and it does not entitle anyone to seal. If you are re-dispatched after your finding was "fixed," **run it again from scratch** — boot, drive, capture — and only then PASS. If repeated attempts still cannot run the app, escalate to the human and keep holding; never let a can't-verify decay into a silent pass. The intent does not seal until this observation genuinely happened.
