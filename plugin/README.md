# H·AI·K·U

**Human + AI Knowledge Unification** — a Claude Code plugin that turns "tell the AI what to do" into a structured workflow with role-based hats, hard quality gates, and completion criteria.

AI can only move as fast as the rails it runs on. H·AI·K·U is the rails.

> **This is a Claude Code plugin, not a JavaScript library.** `import` and `require` won't do anything useful — install it via your Claude harness (instructions below). The npm package exists so the plugin can be distributed and version-pinned through standard tooling.

## The problem

Most AI workflows are a single prompt and a hope. The model produces 400 lines of plausible-looking code, you skim it, you ship it, and the bug shows up in production. The model wasn't wrong because it was dumb — it was wrong because nothing was checking, and nothing was telling it to slow down.

H·AI·K·U adds the structure that stops fast movement from becoming fast-wrong. Every piece of work runs through stages. Every stage has a hat sequence (planner → builder → verifier, or whatever the work demands). Every stage ends in a review gate. State lives on disk, so a context reset isn't a progress reset.

## Install

```
/plugin marketplace add gigsmart/haiku-method
/plugin install haiku --scope project
```

Works in [Claude Code](https://claude.ai/code), [Claude Cowork](https://claude.ai/cowork), and other MCP-compatible harnesses (Cursor, Windsurf, Gemini CLI, OpenCode, Kiro).

### Other MCP harnesses

Configure your harness's MCP server list with:

```json
{
  "mcpServers": {
    "haiku": {
      "command": "npx",
      "args": ["-y", "haiku-method", "mcp"]
    }
  }
}
```

The skills (`/haiku:start`, `/haiku:pickup`, etc.) are Claude-specific — outside Claude, you drive the workflow by calling MCP tools directly (`haiku_run_next`, `haiku_intent_create`, etc.).

## Quickstart

```
/haiku:start              # describe what you want; the plugin scaffolds an intent
/haiku:pickup             # advance the workflow one tick at a time
```

The orchestrator drives the stage loop. It tells you what to do next; you do it; it advances. When a stage finishes, adversarial review agents try to break the output before the gate opens.

## Studios

Studios are the lifecycle templates — pre-built sequences of stages, hats, and gates tuned for a class of work.

| Engineering | Go-to-Market | General Purpose |
|---|---|---|
| Software | Sales | Ideation |
| Data Pipeline | Marketing | Documentation |
| Migration | Customer Success | Project Management |
| Incident Response | Product Strategy | Executive Strategy |
| Compliance | Dev Evangelism | Training |
| Security Assessment | | |
| Quality Assurance | | |
| Hardware Dev | | |
| Game Dev | | |
| Library Dev | | |

Plus support studios for HR, Legal, Finance, Vendor Management, and more. See the full catalog at [haikumethod.ai/studios](https://haikumethod.ai/studios).

## The model

```
Studio > Stage > Unit > Bolt
```

- **Studio** — the lifecycle template
- **Stage** — a phase within the studio with its own hat sequence and review gate
- **Unit** — a discrete piece of work with explicit completion criteria
- **Bolt** — one iteration through the hat sequence on a unit

Studio is *not* the same as Stage. Unit is *not* the same as Bolt. The vocabulary is load-bearing — see the [paper](https://haikumethod.ai/papers/haiku-method) for the full model.

## Why it's different

- **The work fails fast, not slow.** Quality gates run after every stage. A broken build doesn't propagate downstream; it bounces back to the hat that caused it.
- **Context-reset proof.** State lives on disk in `.haiku/intents/<slug>/`. Lose your conversation, restart Claude, swap models — the work picks up where it left off.
- **No magic, just file boundaries.** Every artifact is a markdown file you can read, grep, diff, and commit. The plugin enforces who can write what; nothing else is hidden.
- **Adversarial review is the default.** Every stage spawns review agents whose job is to find what's wrong. Findings become open feedback that has to be addressed (or explicitly rejected) before the gate opens.
- **Hats over agents.** Roles are stage-scoped behavioural definitions, not separate agent processes. The same Claude session puts on the planner hat, then the builder hat, then the verifier hat — context flows through.

## Review gates

Each stage's gate decides whether work advances:

- **`auto`** — the harness advances automatically (low-risk, machine-verifiable work)
- **`ask`** — local human approval via the review web UI
- **`external`** — blocks until a PR/MR is approved on GitHub or GitLab
- **`await`** — blocks until an external event fires (customer reply, pipeline finish, etc.)

Mix them per stage. Compound gates like `[external, ask]` let you choose at runtime.

## Kill-switch — disabling drift detection

H·AI·K·U ships a per-stage drift-detection gate that catches out-of-band edits to tracked files between ticks. If it ever misfires (false positives during a noisy refactor, an integration that legitimately rewrites tracked surfaces, load shedding under heavy churn), turn it off in `.haiku/settings.yml`:

```yaml
drift_detection: false
```

That single key disables the drift-detection gate for the project. Reconciliation, baseline establishment, and every other gate continue to run normally — only drift-finding emission is silenced. Flip it back to `true` (or remove the key entirely) once the noisy condition clears.

**Verifying the kill-switch is live.** After flipping the flag, call `haiku_baseline_init` against any intent — the response will include a `drift_disabled_warning` key when the kill-switch is active. The flag uses the literal lowercase boolean `false`; `"false"` (string) and `False` (Python-cased) are silently ignored. If `drift_disabled_warning` is absent on the next call, the YAML key is malformed.

For incident playbooks — including how to verify the kill-switch is live, how to roll back a corrupt baseline, and how to clear stuck reconciliation findings — see `.haiku/knowledge/RUNBOOK.md` inside any intent that uses drift detection.

## Links

- **Method paper** — [haikumethod.ai/papers/haiku-method](https://haikumethod.ai/papers/haiku-method)
- **Website + docs** — [haikumethod.ai](https://haikumethod.ai)
- **Source** — [github.com/gigsmart/haiku-method](https://github.com/gigsmart/haiku-method)
- **Changelog** — [CHANGELOG.md](https://github.com/gigsmart/haiku-method/blob/main/CHANGELOG.md)

## License

[Apache 2.0](https://github.com/gigsmart/haiku-method/blob/main/LICENSE) — use it, fork it, ship it.
