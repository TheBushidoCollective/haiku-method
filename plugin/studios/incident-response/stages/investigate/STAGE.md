---
name: investigate
description: Root cause analysis, log analysis, and timeline reconstruction
hats: [investigator, log-analyst, verifier]
fix_hats: [classifier, investigator, feedback-assessor]
review: auto
elaboration: autonomous
inputs:
  - stage: triage
    discovery: incident-brief
---

# Investigate

Take the confirmed incident brief from triage and answer two questions: what is the actual root cause, and what is the full timeline from the first anomaly to detection. Investigation runs in parallel with mitigation — the investigators do not wait for the bleeding to stop before chasing the cause, and the mitigators do not wait for a confirmed root cause before stopping user impact. This stage's job is to produce the diagnosis that the resolve stage will use to build the permanent fix and that the postmortem will use to tell the story.

## Per-unit baton

Each investigate unit walks `investigator → log-analyst → verifier` in order. A unit here is one investigation finding — a single hypothesis, a single subsystem timeline, or a single causal chain being tested:

- **`investigator`** (plan) forms a hypothesis, identifies the data sources that would confirm or refute it, and frames the test. The baton: a stated hypothesis with named evidence sources and a falsifiable prediction.
- **`log-analyst`** (do) executes the test by pulling logs, metrics, and traces from the named sources, correlating timestamps across systems, and producing structured evidence. The baton: a `ROOT-CAUSE.md` slice with cited log excerpts, timestamped events, and a verdict on the hypothesis.
- **`verifier`** (verify) checks the finding against the stage's body-level rules — root cause distinguished from proximate trigger, alternatives ruled out with evidence, timeline gaps explained. Advances or rejects to the responsible hat.

## Inputs and outputs

Consumes `triage/incident-brief` — the snapshots, impact numbers, and surface list captured during triage. Produces `ROOT-CAUSE.md` containing the timeline, the causal chain, the ruled-out hypotheses, and the contributing factors. This output feeds the resolve stage (which builds the permanent fix) and the postmortem stage (which tells the organizational-learning story).

## Fix loop and gate

When review feedback opens against a finding, `fix_hats: [classifier, investigator, feedback-assessor]` dispatches per finding. The investigator re-owns the corrected finding because hypothesis framing and evidence interpretation are investigator-scope. The gate is `auto` because investigation findings flow forward continuously; the postmortem stage is where humans review the consolidated narrative.
