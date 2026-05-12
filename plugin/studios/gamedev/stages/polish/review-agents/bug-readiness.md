---
interpretation: lens
---

**Mandate:** The agent **MUST** verify the build is free of bugs that would block platform certification or severely degrade the player experience before release. Polish stage exits into release; bugs that slip past this lens become known issues at launch, refund triggers, or cert rejections that delay the launch window.

## Check

The agent **MUST** verify, file feedback for any violation:

- **No P0 bugs remain open.** P0 = crash, data loss, core-loop block, certification failure. P0s ship the build dead on arrival. The bug tracker must show zero open P0s in the polish-stage unit's scope.
- **P1 bugs are resolved OR explicitly accepted as known issues with justification.** A P1 in the open state without acceptance is a finding. Acceptance requires a recorded rationale ("infrequent edge case, fix scheduled for first patch with named ETA") plus the workaround the player will encounter.
- **Bug fixes were verified on the release build, not the dev branch.** Polish Fix Log entries with `verified` status must cite the release-build identifier they verified against. Dev-branch-only verification is a finding.
- **Regression tests exist for every fix of a shape that could recur.** A bug fix without a regression test is the same bug-in-waiting after the next refactor. Walk the Fix Log entries; missing regression tests are findings.
- **Coverage axes have been swept.** The QA decision must cite coverage of systems, content pieces, platforms, edge cases, save / load paths, and error paths. Coverage gaps named without a sweep happening are findings.
- **No regressions were introduced and silently shipped.** Each tuner change and performance change has its regression sweep noted. Un-swept changes are findings even if no specific regression has been observed yet.

## Common failure modes to look for

- Open P0 bugs that have been re-categorized to P1 to move them out of gate-blocking scope
- P1 bugs marked "fixed" without a Fix Log entry citing the verified release-build identifier
- Bug fixes that landed on the dev branch but the release build was cut before the merge — silent fix loss
- Polish Fix Log entries with no regression tests on bugs whose shape clearly could recur (state-machine edge cases, race conditions, resource-leak patterns)
- "Known issue" acceptance without an ETA, workaround, or recorded rationale
- Coverage sweeps skipped on platforms the polish team doesn't have direct access to — the platform that's hardest to test is usually the one that ships broken
- Bug count claimed in the QA decision that doesn't match the count in the tracker

When a finding is identified, file feedback against the specific polish unit (the gameplay-engineer's Fix Log if a fix is unverified or missing a regression test; the qa hat if a coverage axis is un-swept). When P0s remain open at gate time, the finding routes up to the gate as gate-blocking.
