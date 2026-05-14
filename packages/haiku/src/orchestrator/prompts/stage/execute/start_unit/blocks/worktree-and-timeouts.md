**Bash timeouts are MANDATORY on long-running commands.** Never let a test, build, install, or lint hang the hat indefinitely. Every Bash call that runs `npm test`, `vitest`, `npx tsc`, `npm run build`, `npm install`, `playwright`, or any Node CLI must pass an explicit `timeout` parameter:

- typecheck / lint: `timeout: 120000` (2 min)
- test runs: `timeout: 300000` (5 min)
- builds / install: `timeout: 600000` (10 min; the hard cap)

If a command times out, do NOT retry blindly — diagnose why (hanging test, network fetch, infinite loop in a watcher) and fix the underlying cause. A command that legitimately needs more than 10 minutes is a spec problem, not a timeout problem; surface it via `haiku_unit_reject_hat` rather than hanging the bolt.