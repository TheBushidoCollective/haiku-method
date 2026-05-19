---
interpretation: lens
---
**Mandate:** The agent **MUST** be the user's eyes and hands for this stage — drive the developed app through the browser the way a real user would, see what the user would see, and assert the user-facing flows from the product stage's behavioral spec pass against a live instance. Static-analysis quality gates (typecheck, unit tests, lint) only prove the code compiles and tests its own assertions — they cannot catch broken integrations, missing render paths, dead routes, or components that compile but never mount. The product stage's intent-level `.feature` files (`stages/product/artifacts/*.feature`, or wherever the studio's product-stage configured them) are the executable test contract — consume the scenarios this stage's units own, drive them through `playwright`, screenshot the result, file feedback when the live app diverges from what the `.feature` promised.

## Check

The agent **MUST** verify each of the following:

- **The app boots.** Open a view session via `haiku_view({ stage: "development" })` — the tool auto-detects the project's `dev` / `start` script and spawns it on an ephemeral port, returning a `http://127.0.0.1:<port>/` URL pointing at the live app. (Pass `mode: "boot"` to force boot mode and hard-fail with a clear error when no script is detected, vs the default `auto` which falls back to viewer mode.) Use the bundled `playwright` MCP to `browser_navigate` to the returned URL. If the dev server fails to bind, the page fails to load, or the response is 4xx/5xx, open feedback with the failing URL and the captured screenshot.
- **Primary user flows pass — at both the product-spec level AND the per-unit level.** Verify TWO scopes:
  1. **Product-spec scope.** For each `Scenario:` (and each `Scenario Outline:` example row) in the product stage's intent-level `.feature` files that this development unit owns: drive the Gherkin steps via `playwright` exactly as a user would — `Given` sets the precondition, `When` performs the action via `browser_click` / `browser_type` / `browser_select_option`, `Then` asserts the visible state via `browser_snapshot` or `browser_evaluate`.
  2. **Per-unit scope.** Read THIS unit's body (`stages/development/units/<unit>.md`). Every acceptance-criterion line, every "behavior" / "completion criteria" assertion, every named selector or asserted-state the unit declares is part of the contract. Drive the live app to exercise each one and assert it holds. The product spec is the user-facing contract; the unit body is the build-time contract — both have to hold, and runtime-verifier is the only lens that catches divergence between "the unit ticked all its boxes in tests" and "the unit's claims are true in the live app."

  Call `browser_take_screenshot` at every meaningful step (page-loaded, post-action, final-assertion). **Save each screenshot** to disk under `.haiku/intents/<intent>/stages/development/proof/<scenario-or-unit-slug>-<step>.png` using the `Write` tool (PNG is the format `playwright` produces; keep it). Attach the same screenshots to any feedback you file — the screenshots ARE the proof of what the user would have seen, AND they live on disk so a human verifier can audit the chain after the fact. A scenario or unit-claim that the spec says should succeed but errors, redirects unexpectedly, or shows wrong content is the headline finding.
- **No console errors during the happy path.** After each scenario, check `browser_console_messages` for `error`-level entries. A passing scenario that logs a runtime error to the console (uncaught exception, React render warning, network failure) is a finding — the user-facing outcome may look right but the integration is broken underneath.
- **Declared selectors resolve.** Any selectors the unit body called out by name (test IDs, accessibility roles, ARIA labels) MUST be present in the rendered DOM. A unit that claims `data-testid="submit-button"` exists where the spec says one should is a finding when `playwright` cannot find it.
- **Close the session.** After all checks complete, call `haiku_view_close({ session_id })` so the tunnel slot releases promptly instead of waiting for the standard TTL eviction.

## Common failure modes to look for

- A component that compiles, has tests, but never gets rendered by any route — the dev server returns 200 but the URL shows an empty layout because no parent component mounts the new piece
- A form that the unit tests assert correctness on, but in the live app the submit button is wired to the wrong handler — submission succeeds in tests, silently no-ops in the browser
- A new API route that returns the right shape in unit tests but isn't registered with the framework — the live request 404s
- Routing changes that the unit tests stub but the live app's actual router doesn't know about — the link is dead even though the destination component is implemented
- A state-management change that compiles but causes an uncaught `undefined.foo` in the live render — tests pass because they constructed valid state directly, but the real load path doesn't
- A condition the spec said should show an error toast — implementation calls a logger but never renders the toast element in the live app
- Network calls in the live app hitting CORS errors, auth errors, or wrong origins that no unit test catches because they mock the fetch
