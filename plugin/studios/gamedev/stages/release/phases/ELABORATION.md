# Release Stage — Elaboration

Release is an **operational** stage. Its units are operational steps in the storefront-submission and certification pipeline — discrete actions with preconditions, an action procedure, and post-condition checks.

## What a unit IS in this stage

One operational step. Examples:

- "Steam build upload — depots, branches, partner site config"
- "Sony / Nintendo / Microsoft cert submission package — TRC checklist, build artifact, metadata"
- "App Store / Play Store submission — privacy nutrition label, screenshots, release notes"
- "Day-1 patch pipeline — branch protection, build automation, hotfix promotion path"
- "Storefront launch-day metadata go-live — pricing, tags, release-date flip"
- "Post-launch monitoring — crash report ingestion, review-feed alerts"

What a unit is **NOT** in this stage:

- ❌ A gameplay polish task (those belong in `polish`)
- ❌ A feature or content addition (those belong in `production`)
- ❌ A market positioning decision (that belongs in `concept` / inception-class research)

## What "completion criteria" means here

Operational-step criteria specify **preconditions, action, post-condition check, and rollback** — not vague "we did the thing" claims. Pass/fail must be decidable from a recorded artifact.

### Good criteria — concrete and verifiable

- "Steam upload preconditions: build is signed, depots A/B/C exist, branch `default` is locked. Action: `steamcmd +run_app_build_http <vdf>`. Post-condition: SteamDB shows new build_id within 10 minutes of upload"
- "Cert submission post-condition: portal returns submission ID and confirmation email is filed in `release/cert-submissions/`"
- "Patch pipeline post-condition: a synthetic hotfix PR can merge, build, and produce a `.patch` artifact in <30 minutes — recorded as a dry-run on a release branch"

### Bad criteria — vague or wrong-stage

- ❌ "Released to Steam" (no check, no evidence)
- ❌ "Cert passed" (which cert? which build? recorded where?)
- ❌ "Game is fun" — wrong stage; that's `concept`/`prototype`/`polish`

## How verification happens

Release artifacts are validated by the verifier hat (`hats/verifier.md`). The verifier checks **preconditions stated, action unambiguous, post-condition mechanically decidable, rollback declared where applicable** — body-content checks only, no frontmatter interpretation.

## Anti-patterns

- **Skipping rollback for non-idempotent actions.** A storefront submission you can't unsubmit needs an explicit "no rollback — forward-fix only via patch" statement, not silence.
- **Vague post-conditions.** "Verify build is live" is not a check; "SteamDB shows build_id matching local build manifest within 10 minutes" is.
- **Treating cert as binary.** Cert can fail for non-game reasons (TRC interpretation, account access, build-pipeline issues); each cert step should have a unit, not be lumped under "submit and wait".
