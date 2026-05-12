**Focus:** Apply the fastest safe action that stops user-facing impact. Speed matters because impact compounds — every minute a SEV-1 runs adds users affected, revenue exposure, and regulatory-clock pressure. Safety matters because a wrong mitigation can convert a contained outage into an uncontained one. Every mitigation must be reversible, must address the hypothesized cause (not a guess), and must be observable — you need a signal that confirms it worked.

## Process

### 1. Pick the safest reversible action

Common mitigation moves, ordered roughly by reversibility:

- **Roll back the most recent deploy** — fast, well-understood, reverses the most common cause of new incidents
- **Flip a feature flag off** — fast, reverses anything gated behind the flag
- **Scale a resource up** — addresses saturation, easy to revert
- **Drain traffic from a failing region / shard** — isolates impact, redirectable
- **Apply a known-good config rollback** — depends on having a previous good config recorded
- **Restart a stuck service** — last-resort, reversible by definition but can mask the cause and lose ephemeral state

A hotfix is a permanent fix in mitigation clothing — avoid it. The resolve stage builds the permanent fix; the mitigate stage stops the bleeding with reversible moves.

### 2. Name the hypothesis the mitigation acts on

State which root-cause hypothesis the chosen mitigation is acting on, taken from the investigate stage's working hypothesis. Example: "Acting on the connection-pool-saturation hypothesis; rolling back deploy X-123 which doubled the pool-consuming worker count." A mitigation that doesn't tie to a hypothesis is a coin flip.

If multiple competing mitigations could address the same hypothesis, pick the most-reversible one first. If the hypothesis is wrong, you'll learn from the signal not recovering and you can step back without compounding the problem.

### 3. Document the exact change before applying

Before executing, write down in `MITIGATION-LOG.md`:

- The exact action: command, config-change snippet, flag name and target value, scale target
- The expected effect: which signal should change, by how much, on what timeline
- The rollback procedure for the mitigation itself: how to undo it if it makes things worse
- The blast radius of the mitigation: what else could be affected by this action

This is the single most important habit during a high-pressure response. The documented change is what the verifier checks against and what the postmortem references; the rollback line is what saves the incident if the mitigation backfires.

### 4. Apply one change at a time

Apply the documented action, then stop. Wait for the signal to stabilize before applying another change. If two mitigations are applied simultaneously and recovery follows, attribution is impossible — both look credited, and the system gets two unnecessary changes in its history.

If the first mitigation doesn't recover the signal within the expected timeline, hand the case back to the IC and the investigator before stacking a second mitigation. A non-recovering signal usually means the hypothesis was wrong, not that more mitigations are needed.

### 5. Communicate every action

The IC and comms lead need to know every mitigation as it's applied. Internal stakeholders need to know what's being done so they don't deploy a conflicting change. Customer comms downstream depends on knowing what's been tried. State the action in the incident channel before applying it (so others can object) and after applying it (so the timeline records it).

## Format guidance

Each mitigation unit's entry in `MITIGATION-LOG.md` should include:

- Hypothesis acted on: the working root-cause hypothesis from investigate
- Action chosen: from the reversibility-ordered list above, with rationale for the choice
- Exact change: command, config diff, flag-and-value, scale target
- Pre-apply timestamp: when you announced the action
- Apply timestamp: when the change took effect
- Expected signal: what should change, by how much, on what timeline
- Rollback procedure: exact steps to undo the mitigation
- Mitigation blast radius: what else could be affected by this action

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** apply a mitigation without a rollback procedure for the mitigation itself
- The agent **MUST NOT** ship a permanent code fix as a mitigation when a faster reversible mitigation exists — the resolve stage builds permanent fixes
- The agent **MUST** document the exact command or config change applied before applying it
- The agent **MUST NOT** apply multiple mitigations simultaneously — single-variable changes are the only attributable changes
- The agent **MUST NOT** stack a second mitigation when the first didn't recover the signal within the expected window — escalate back to the IC and investigator instead
- The agent **MUST** name which root-cause hypothesis the mitigation is acting on; a mitigation without a hypothesis is a guess
- The agent **MUST NOT** skip the communication step — every action applied without announcement creates timeline gaps and risks a conflicting change from another responder
- The agent **MUST** wait for the signal to stabilize before declaring the mitigation effective — recovery measured at a single data point is not recovery
- The agent **MUST NOT** select a non-reversible action when a reversible one is available; reversibility is the safety budget for a wrong hypothesis
