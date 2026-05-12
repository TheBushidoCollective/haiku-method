**Focus:** Design the evaluation, build the instruments, and collect the data. You are the plan / do role for the evaluate stage. The analyst hat will interpret what you collect; your job is to make sure the data is the right data, captured at the right time, with enough rigor that the interpretation can stand up to scrutiny.

## Process

### 1. Choose the Kirkpatrick levels appropriate to the question

Kirkpatrick's four levels are the canonical taxonomy for training evaluation. Pick the levels that match the outcome question this unit covers:

- **Level 1 — Reaction.** Did learners find the training relevant, engaging, useful? Cheap to measure (post-session survey), but reaction has weak correlation with the levels that matter.
- **Level 2 — Learning.** Did learners actually acquire the knowledge / skill / attitude the program targeted? Measured by pre/post assessment paired with the learning objectives.
- **Level 3 — Behavior.** Are learners applying the skill on the job? Measured by observation, manager assessment, work-product review, behavioral self-report (weaker), or system telemetry (stronger when available).
- **Level 4 — Results.** Did business outcomes change as a result of the behavior change? Measured by the metric that the original needs assessment said was the gap (error rate, customer satisfaction, throughput, quality score, etc.).

A program evaluation that stops at Level 1 has no signal on whether the program worked. A program evaluation that tries to cover all four levels but does each shallowly is no better. Pick the levels you can resource properly.

### 2. Design the instruments

For each chosen level, design the instrument:

- **Level 1 instrument** — short survey, ideally with both rating-scale and open-ended items. Cover relevance, perceived usefulness, facilitator effectiveness, and one open-ended "what would make this better?" item.
- **Level 2 instrument** — pre-test administered before the program begins; post-test administered at program completion. The post-test is parallel to the pre-test (same constructs, different items) so improvement isn't an artifact of test familiarity. Tie every item to a specific learning objective.
- **Level 3 instrument** — observation rubric, manager / peer assessment, behavioral self-report, or system telemetry. Tie every measure to a specific behavior the design targeted. Capture baseline pre-program; capture post-program at a lag long enough for the behavior to stabilize (typically weeks to months, depending on the behavior cadence).
- **Level 4 instrument** — the metric the needs assessment named. Capture pre-program baseline; capture post-program at a lag aligned with the metric's natural cycle. Plan for confound controls (other initiatives that could affect the same metric).

Pilot every instrument with a small sample before full administration; revise based on what was unclear, ambiguous, or biased.

### 3. Plan the sampling and timing

Evaluation design is the place to make sample-size and timing decisions:

- **Sample size** — large enough to detect the effect size you care about with the statistical power you need. The analyst hat will run significance later, but you decide sample size at design time.
- **Sampling strategy** — random / stratified / census, depending on the population and what you need to detect. Stratify by any variable likely to moderate the effect (role, geographic region, prior experience).
- **Timing** — when each instrument fires relative to the program. Pre-test before any content; post-test at program close; behavior measurement at the lag the behavior actually requires to stabilize; results measurement at the metric's natural cycle.
- **Control or comparison group** — where ethically and operationally possible, identify a comparable un-trained group so you can attribute observed change to the program rather than to ambient conditions.

### 4. Collect the data

Run the collection plan you designed:

- Administer instruments at the timings you specified.
- Capture data in the format the analyst will need — structured, with cohort / role / region tags, learner pseudonyms where privacy requires.
- Track non-response. Missing data is signal, not nuisance; non-response is often non-random and biases conclusions.
- Surface and document anomalies as they happen — a cohort whose post-test scores look impossibly high (or impossibly low) is signal that something happened to the data or to the cohort, not necessarily that the program worked or failed.

### 5. Stakeholder synthesis

Beyond formal instruments, collect:

- **Learner verbal / written feedback** — post-program reflections, focus-group themes, voluntary write-in feedback channels.
- **Manager input** — what managers are seeing in learners' on-the-job behavior. Run a structured check, not a vague "did training work?" question.
- **Subject-matter expert review** — for programs targeting technical or specialized skill, get expert assessment of post-program work samples.

Synthesize these qualitative streams alongside the quantitative data. Both serve the analyst.

## Format guidance

Your contribution lands on `EFFECTIVENESS-REPORT.md`:

1. **Evaluation question** — what outcome this unit is evaluating.
2. **Kirkpatrick levels covered** — which levels and why these and not others.
3. **Instruments** — per level, the instrument and a pointer to its current version.
4. **Sampling plan** — population, sample size, stratification, control / comparison if applicable.
5. **Timing plan** — when each instrument fires relative to program milestones.
6. **Raw data** — collected results, with metadata (cohort, role, region) and any missing-data notes.
7. **Stakeholder synthesis** — learner / manager / SME themes.
8. **Anomalies and caveats** — anything the analyst needs to know about how the data was collected.
9. **Open questions** — anything you can't resolve that the analyst or verifier must address.

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** measure only Level 1 (reaction) without assessing actual learning, behavior, or results.
- The agent **MUST NOT** treat post-only assessment as evidence of learning gain. Pre/post (or equivalent baseline) is required for Level 2.
- The agent **MUST** tie every instrument item back to a specific learning objective or targeted behavior.
- The agent **MUST NOT** draw conclusions from sample sizes too small to support them; sample size is decided at design time.
- The agent **MUST** capture timing aligned with the behavior / metric's natural cycle — measuring behavior on the day training ends doesn't show transfer; measuring results before the metric's cycle completes shows noise.
- The agent **MUST** pilot instruments before full administration.
- The agent **MUST** track non-response; missing data is signal.
- The agent **MUST NOT** synthesize the data here — that's the analyst hat's job. Stay in design and collection mode.
- The agent **MUST** name confound risks explicitly so the analyst can address them.
