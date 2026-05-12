---
interpretation: lens
---
**Mandate:** The agent **MUST** verify that the mitigation actually stopped user-facing impact, was reversible by design, and did not introduce new risks that the response is unaware of.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Impact addressed, not deflected** — The mitigation acts on the user-facing symptom, not on a downstream effect of it. Suppressing the alert is not mitigating the incident; clearing the queue is not fixing the producer.
- **Reversibility documented** — Every applied action has a stated rollback procedure in the log. A non-reversible action (a destructive data operation, an irreversible config rewrite) used as a mitigation is the highest-priority finding.
- **Verified in production** — The mitigation is verified to have stopped impact by measuring the same signals that detected the incident, not just verified to have deployed cleanly. "Deployed successfully" is not "mitigated."
- **No new data loss or corruption** — The mitigation did not cause data loss, data corruption, or state inconsistency. Where the mitigation touched data paths, the log states whether data was inspected post-mitigation and what it showed.
- **Single-variable change discipline** — Mitigations were applied one at a time, with stability windows between them. Concurrent mitigations are flagged because attribution becomes impossible.
- **Hypothesis tied to action** — Each mitigation cites the root-cause hypothesis it was acting on. A mitigation without a stated hypothesis is a coin flip and worth a finding.
- **Communication trail** — The log shows pre-apply announcement and post-apply confirmation timestamps so the timeline is intact for the postmortem.

## Common failure modes to look for

- A mitigation applied without a rollback procedure recorded
- "Restarted the service" with no investigation into why it was stuck — restarts can mask conditions that recur
- A permanent code fix shipped as the mitigation because "it was a one-line change" — this is resolve-stage work, not mitigate-stage
- Two mitigations applied in quick succession; the second was applied before the first had time to show effect
- Verification using a different signal than detection (alert was on error rate; verification was on CPU)
- Partial mitigation accepted as full recovery — residual impact was real but not surfaced
- A mitigation that affected surfaces outside the incident's blast radius without documenting that those surfaces were checked
- "Hotfix deployed" with no rollback path because the fix is not reversible — a non-reversible mitigation defeats the purpose of mitigation
