/**
 * Review-role classification sets — the single source shared by the
 * workflow role-list builder (`stageRoleLists` in `workflow/cursor.ts`)
 * and the prompt dispatch builders (`dispatch_approval`, `intent_review`).
 *
 * A review-agent role is classified by WHAT ITS SUBJECT IS, which in turn
 * decides which lifecycle phases it runs in and which scope carve-out its
 * dispatch prompt gets. Kept here (a leaf module with no heavy deps) so the
 * engine core can read the classification without importing the Eta-laden
 * prompt registry, and so the two consumers can never drift apart.
 *
 *  - RUNTIME_OBSERVATION_ROLES drive the live, BUILT work — boot the app,
 *    drive a browser, run the command, hit the socket. There is nothing to
 *    observe before the work exists, so the cursor EXCLUDES them from the
 *    PRE-execute review walk (`reviewRoles`, which audits the spec): they
 *    fire only POST-execute (`approvalRoles`, which audits the built work)
 *    and at intent completion. The dispatch builders additionally inject the
 *    `runtime-verification` doctrine for these roles and let them write
 *    `proof/` evidence captures (but never source).
 *
 *  - PR_INTERACTION_ROLES interact with the change request on the remote via
 *    the VCS CLI (`gh`/`glab`) — read checks, read/post/resolve review
 *    threads, and upload assets to the PR/MR body. They still MUST NOT edit
 *    source/specs/units; code fixes flow through `haiku_feedback` and the
 *    studio fix-hat loop.
 *
 * A role may be in BOTH sets — `runtime-verifier` is. It drives the live work
 * AND captures proof (runtime-observation), and that proof is regenerated
 * binary churn that doesn't belong in git, so it uploads the captures to the
 * relevant PR/MR (PR-interaction). The dispatch builders + subagent templates
 * treat the two scope grants as ADDITIVE — a both-sets role gets the
 * proof-write carve-out AND the PR-interaction carve-out, not one or the
 * other.
 *
 * To make a NEW agent post-execute-only (no pre-execute spec audit), add its
 * role name to `RUNTIME_OBSERVATION_ROLES` — that one edit drops it from the
 * review walk AND grants it the runtime doctrine + proof-write carve-out.
 */
export const RUNTIME_OBSERVATION_ROLES: ReadonlySet<string> = new Set([
	"runtime-verifier",
])

export const PR_INTERACTION_ROLES: ReadonlySet<string> = new Set([
	"delivery-verifier",
	// Uploads its runtime-verification proof (gitignored binary churn) to the
	// stage/intent PR so it's durable + reviewable off-git. Also in
	// RUNTIME_OBSERVATION_ROLES — the scopes are additive (see header).
	"runtime-verifier",
])
