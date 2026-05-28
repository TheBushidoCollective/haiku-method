// orchestrator/workflow/delivery-modes.ts — the single source for which
// intent modes use per-stage delivery PRs. A neutral leaf module (no heavy
// deps) so both the workflow side-effects (which OPEN the stage PR) and the
// prompt dispatch builder (which picks the proof-upload TARGET) read the
// same set and can never drift when a new mode is added.
//
// `discrete` / `discrete-hybrid` open a per-stage draft PR (base = intent
// main) where that stage's work + runtime-verification proof lands.
// `continuous` / `autopilot` / `quick` keep everything on the single
// intent-main draft PR opened at intent_create.
//
// Note: membership here means "this mode CAN open per-stage PRs."
// `discrete-hybrid` further narrows WHICH stages get one to the external-
// review stages (`stageRequiresExternalReview`); `discrete` opens one for
// every stage.
export const PER_STAGE_PR_MODES: ReadonlySet<string> = new Set([
	"discrete",
	"discrete-hybrid",
])
