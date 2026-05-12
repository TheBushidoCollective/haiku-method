# Release Stage — Elaboration

Release is an **operational** stage. Its units are operational steps in the storefront-submission and certification pipeline — discrete actions with preconditions, an action procedure, and post-condition checks.

## What a unit IS in this stage

One operational step. Examples (substitute your project's target platforms and storefronts):

- "PC-storefront build upload — depots / branches / partner-site metadata config"
- "Console first-party cert submission package — platform-specific compliance checklist, build artifact, metadata"
- "Mobile-store submission — privacy disclosures, screenshots, release notes"
- "Day-1 patch pipeline — branch protection, build automation, hotfix promotion path"
- "Storefront launch-day metadata go-live — pricing, tags, release-date flip"
- "Post-launch monitoring — crash report ingestion, review-feed alerts"

What a unit is **NOT** in this stage:

- A gameplay polish task (those belong in `polish`)
- A feature or content addition (those belong in `production`)
- A market positioning decision (that belongs in `concept` / inception-class research)

## What "completion criteria" means here

Operational-step criteria specify **preconditions, action, post-condition check, and rollback** — not vague "we did the thing" claims. Pass/fail must be decidable from a recorded artifact.

### Good criteria — concrete and verifiable

- "Storefront upload preconditions: build is signed, deployment slots configured, default branch is locked. Action: project's storefront upload command. Post-condition: storefront partner site shows new build_id within the platform's published latency"
- "Cert submission post-condition: portal returns submission ID and confirmation email is filed in `release/cert-submissions/`"
- "Patch pipeline post-condition: a synthetic hotfix PR can merge, build, and produce a patch artifact in <30 minutes — recorded as a dry-run on a release branch"

### Bad criteria — vague or wrong-stage

- "Released to <storefront>" (no check, no evidence)
- "Cert passed" (which cert? which build? recorded where?)
- "Game is fun" — wrong stage; that's `concept`/`prototype`/`polish`

## How verification happens

Release artifacts are validated by the verifier hat (`hats/verifier.md`). The verifier checks **preconditions stated, action unambiguous, post-condition mechanically decidable, rollback declared where applicable** — body-content checks only, no frontmatter interpretation.

## Anti-patterns

- **Skipping rollback for non-idempotent actions.** A storefront submission you can't unsubmit needs an explicit "no rollback — forward-fix only via patch" statement, not silence.
- **Vague post-conditions.** "Verify build is live" is not a check; "storefront partner site shows build_id matching local build manifest within published-latency window" is.
- **Treating cert as binary.** Cert can fail for non-game reasons (compliance-rule interpretation, account access, build-pipeline issues); each cert step should have a unit, not be lumped under "submit and wait".

Project overlays at `.haiku/studios/gamedev/stages/release/` may add target-platform names, storefront-specific upload commands, and platform-specific cert checklists without modifying this default.
