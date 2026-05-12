---
interpretation: lens
---

**Mandate:** The agent **MUST** verify the build meets every platform certification requirement before submission. Failed cert wastes days or weeks of the launch window, and launch windows are usually fixed by marketing, partner commitments, or contractual obligation — so time lost in cert is time lost from the actual launch.

## Check

The agent **MUST** verify, filing feedback for any violation:

- **Every line item on each platform's certification checklist has a PASS verdict in the Cert Pre-Verify Log.** Items marked GAP without a named owner and a resolution path are findings. Items missing from the checklist entirely (because the cert specialist didn't walk them) are findings.
- **Required metadata is complete per platform and per region.** Age ratings filed with the appropriate body, content descriptors selected, accessibility tags present, privacy policy linked, EULA accepted, localization complete for required regions. Each platform / region has its own list — the log must show each item PASS individually, not aggregated.
- **Required icons, loading screens, store assets, and platform-specific UI are present at every required resolution.** A missing icon size or screenshot resolution is a routine cert failure. The log must enumerate the required resolutions per platform and the asset that satisfies each.
- **Platform-specific features the project committed to are wired up and tested.** If concept named achievements, leaderboards, cloud saves, controller-glyph swaps, or platform-specific accessibility features as part of the platform commitment, each is wired up and tested. Silent omission of a committed feature is a finding.
- **Pre-verify was run on cert reference hardware, not developer hardware.** Developer-hardware pre-verify hides platform-specific failures (lower memory ceilings, slower IO, throttled CPU, weaker GPU). The log must cite the reference-hardware identifier per platform.
- **Sustained-play telemetry exists for thermal-sensitive platforms.** Handheld and mobile platforms commonly fail cert on thermal degradation that a short capture doesn't surface. A pre-verify without a sustained capture (typically 30+ minutes at target frame rate on the worst supported device) is incomplete.
- **The cert requirements were walked against the CURRENT platform SDK version, not last cycle's.** Platform requirements drift between SDK versions — items that passed last cycle may fail this cycle. The log must cite the platform-doc version walked.

## Common failure modes to look for

- A checklist where items are marked aggregated ("metadata: PASS") rather than per-item ("age rating: PASS / icons: PASS / privacy policy: PASS / EULA: PASS")
- Pre-verify captures taken on the development team's high-spec hardware rather than reference hardware
- A platform-specific feature concept committed to that has no wiring in the build
- Cert pre-verify run against an older build than the one about to be submitted
- A `GAP` item without a named owner and a resolution path
- Missing localization for a region the project committed to launching in
- Sustained-play thermal capture omitted for handheld or mobile
- Cert requirements walked against last cycle's platform doc version, not the current SDK's version
- A submission-readiness verdict of READY when any hard requirement has an open GAP

When a finding is identified, file feedback against the platform-cert-specialist hat's log if a requirement is missing, mis-walked, or insufficient. When the underlying gap requires polish-stage work (a performance shortfall, a missing accessibility option, a content descriptor that doesn't match the actual content), file feedback against the polish stage so the right scope owns the fix.
