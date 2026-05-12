---
interpretation: lens
---

**Mandate:** The agent **MUST** verify performance targets are met on every target platform before release. Performance shortfalls that ship turn into review-score damage on desktop / console and into retention damage / refund triggers / store rejections on handheld and mobile. The platform with the worst reference hardware is usually the platform that ships broken; this lens enforces that every named platform clears its minimum bar.

## Check

The agent **MUST** verify, file feedback for any violation:

- **Frame rate meets the stated target on reference hardware for each platform.** The performance-engineer hat's log names each platform's target and the post-change measurement. Targets unmet on any platform are findings. "Hits the target on the developer's high-end desktop" is not the same as "hits the target on the platform's reference hardware."
- **Load times are within platform guidelines.** Each platform has guidelines (some are hard, some are soft, some are review-score-affecting). The performance log must cite the actual load-time measurement per platform against the guideline.
- **Memory and disk footprint are within platform limits.** Console and handheld platforms enforce these; mobile stores enforce app-size limits and recommend below-limit thresholds for retention. Footprints over the limit are gate-blocking; over the recommendation is a finding the gate should see.
- **Thermal behavior on handheld and mobile is acceptable for sustained play.** Frame rate that holds for the first five minutes and degrades from heat is the failure mode that doesn't show up in short profile captures. The performance log must cite a sustained-play measurement (typically 30+ minutes at the target frame rate) on every handheld and mobile platform.
- **Optimizations did not regress gameplay feel.** The tuner hat re-validated feel after each performance change. Un-re-validated performance changes are findings even when the performance numbers look good — quietly broken feel ships as a quietly worse game.
- **Platform-target gaps that ship unfinished have rationale.** If a platform ships at the minimum but not the target, the performance log records the rationale. Silent shipping at the minimum is a finding (the gate should see the gap to decide if it's acceptable).

## Common failure modes to look for

- Frame-rate measurements taken on developer hardware rather than reference hardware
- Load-time measurements taken from warm cache rather than cold storage
- Memory measurements taken at the main menu rather than at the worst-case content load
- No sustained-play thermal measurement on handheld or mobile (typically the surface that surprises at launch)
- Performance changes landed without the tuner hat re-validating feel
- A platform target that has never been measured because the team doesn't have the reference hardware
- "Hits the target" claims without a baseline profile and a post-change profile to compare
- Platform-specific optimization that helped one platform and silently regressed another

When a finding is identified, file feedback against the performance-engineer hat's log if a measurement is missing or insufficient. When a platform target is genuinely unhittable at the current scope, the finding routes up to the gate so the user can decide between cutting platform support, accepting the gap, or extending polish.
