# unit-30 design review — pending

Design-reviewer hat will populate this file. Placeholder created by designer hat
to satisfy the unit's declared `outputs:` contract.

## Designer handoff notes (unit-30)

**Scope landed:**

- `feedback-inline-mobile.html` now carries the canonical `@media (prefers-reduced-motion: reduce)` guard at line 100, inside the existing `<head>` `<style>` block. Global 0.01ms override keeps essential state-conveying transitions (sheet-enter final position, aria-expanded flip, aria-checked flip) visible; per-component `animation: none` on `.feedback-fab-pulse`, `.animate-pulse`, and `[class*="feedback-pulse"]` stops the decorative FAB pulse entirely. Amber badge count remains the "unread > 0" signal.

- Stage-wide motion-audit surfaced **five additional artifacts** that had lost (or never landed) unit-25's guard and were silently regressing FB-86:
  - `agent-feedback-toggle-spec.html`
  - `assessor-summary-card.html`
  - `comments-list-with-agent-toggle.html` (pre-existing malformed `<style>` with no closing tag — guard insertion also added the missing `</style>`)
  - `review-package-structure.html`
  - `rollback-reason-banner.html`

  Each received the canonical stage-wide guard block per `motion-and-reduced-motion-spec.md §Cross-file policy`.

- `motion-and-reduced-motion-spec.md §Verification` now documents:
  - Per-file live-grep for FB-143 closure (`feedback-inline-mobile.html` specifically).
  - Stage-wide audit script as the canonical gate (empty output = pass).
  - Legacy keyframes-only variant kept for historical context.
  - Audit table rows for `feedback-inline-mobile.html` updated with correct line numbers (sheet-up 58-65, feedback-pulse 67-74, guard at line 100).

**Verification (run in intent dir):**

```sh
# FB-143 closure — per-file live grep must be ≥ 1
grep -c prefers-reduced-motion stages/design/artifacts/feedback-inline-mobile.html

# Stage-wide motion-audit — empty output = pass
for f in stages/design/artifacts/*.html; do
  anim=$(grep -cE '@keyframes|animation:|animate-pulse|animate-spin|transition-' "$f")
  guard=$(grep -cE 'prefers-reduced-motion' "$f")
  if [ "$anim" -gt 0 ] && [ "$guard" -eq 0 ]; then
    echo "MISSING: $f"
  fi
done
```

Both pass as of commit `2265c3be`.

**Not landed (out of intent scope):**

- `plugin/studios/software/stages/design/hats/design-reviewer.md` gate list augmentation — touching files under `plugin/` would trigger a `unit_scope_violation` from the orchestrator because the stage scope is `stages/design/artifacts/`. The motion-audit script is instead documented as the canonical gate inside the in-scope `motion-and-reduced-motion-spec.md §Verification`, which the design-reviewer hat reads by contract. If the plugin hat definition also needs the gate inline, that should be a separate unit under a meta/plugin-touching stage.

## Pending design-reviewer verification

- [ ] Live grep on `feedback-inline-mobile.html` → `grep -c prefers-reduced-motion ...` returns ≥ 1
- [ ] Stage-wide audit returns empty output
- [ ] Walk `feedback-inline-mobile.html` with reduced-motion simulated in devtools: FAB pulse stops, sheet still opens to final position, no essential state transition eliminated
- [ ] Confirm FB-143 ready to close on live-grep verification
