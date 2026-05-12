---
interpretation: lens
---
**Mandate:** The agent **MUST** verify that the research stage's audience segmentation and topic landscape target genuine developer needs that this team has credibility to address. Files feedback on any violation; does NOT edit the research artifacts.

## Check

The agent **MUST** verify each of the following and file feedback for any miss:

- **Segment evidence** — every audience segment in the landscape is grounded in observable behavior (forum activity, analytics, conference programs, stakeholder interviews with dates) — not in job title alone or in assumption
- **Segment behavior split** — the landscape distinguishes builders (developers who ship with the technology) from evaluators (developers deciding whether to adopt); collapsing both into one segment is a gap
- **Topic-audience match** — each recommended topic maps to at least one named segment from the audience landscape; topics with no matching segment are scope creep
- **Team credibility check** — each recommended topic names the specific prior work, contributors, or expertise that justifies the team publishing on it; topics flagged `(credibility gap)` get surfaced to the user, not silently dropped
- **Saturation analysis** — for each recommended topic, the competitive content landscape is described with sources cited, not just summarized; an "underserved" claim with no comparison is unsupported
- **Timeliness window** — each topic carries a stance on whether it's ascending, at peak, or past peak; past-peak high-saturation topics that aren't explicitly flagged are findings

## Common failure modes to look for

- Job-title-only segmentation ("senior engineers") with no behavior context
- Channel claims that name no source ("developers are active on X" with no citation)
- Topics ranked without a visible ranking method (or with a ranking that contradicts the demand and credibility evidence)
- Demand signals cited as "trending" without a date window or volume context
- Rejection candidates dropped silently rather than listed with the failing test named
- Audience-size or community-volume figures presented as fact without a source
