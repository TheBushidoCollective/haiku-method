---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the post-launch patch pipeline is operational and exercised end-to-end before release. Patch pipeline is the lens — studios that ship games before proving their patch path discover the broken path in the middle of a launch-day incident, when every hour of repair delay compounds player damage.

## Check

The agent **MUST** verify, filing feedback for any violation:

1. The agent **MUST** verify that a patch build can be produced, code-signed, and submitted on every target platform — desktop storefronts, console first-parties, mobile stores — with at least one dry-run demonstrating the full path.
2. The agent **MUST** verify that platform-specific submission turnaround windows are documented per platform (cert lead times, hotfix lanes vs. standard lanes, weekend / holiday cutoffs).
3. The agent **MUST** verify that a live-ops rollback procedure is defined for the cases where it's possible (server-side flags, backend rollbacks, save-format reverts) and explicitly named as "not possible" where it isn't (client patches on locked platforms).
4. The agent **MUST** verify that branch / build hygiene is set up so the next patch can ship from a clean branching strategy without cherry-picking from a development branch under pressure.
5. The agent **MUST** verify that the patch pipeline includes a smoke-test pass on the patched build before submission — a patch that fixes one bug and breaks two doesn't help the launch.
6. The agent **MUST** verify that a communication plan for shipping patches is set up (patch-notes template, store-page update procedure, community channels) so the operational step doesn't block on writing copy.
7. The agent **MUST** verify that each platform's expedited / hotfix submission lane (where the platform offers one) has been confirmed available for this title, with named first-party contacts on file before launch — not discovered mid-incident.

## Common failure modes to look for

- A patch build that's never actually been produced because the studio assumed "we'll do it when we need to"
- Turnaround estimates copied from another title's experience without confirming for the current SKU
- A "rollback procedure" that's actually a Slack thread of who would do what, with no documented steps
- A development branch that's diverged from `release` in ways that block patch cherry-picks
- A patch-notes process where every patch waits on hand-written copy by a single producer
- First-party hotfix contact not established, leaving the team to figure out the right inbox during the incident
