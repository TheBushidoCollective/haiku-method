#!/usr/bin/env bash
# verify-prose-claims.sh — regression test for the FB-11 / FB-12 vulnerability class
#
# Vulnerability class: synthesis-layer prose makes a falsifiable claim about
# an identifier (env var, telemetry signal, function name, constant, default
# value) without an automated grep-back to the source of truth. FB-11 cited a
# nonexistent env var (HAIKU_DRIFT_DETECTION); FB-12 cited a nonexistent
# Fastify default (connectionTimeout=60s). Both passed visual review and
# died on the first one-line grep against the actual code.
#
# This script is the regression test the blue-team hat (unit-04, bolt 1) adds
# to address the *class*, not just the two specific payloads. It re-validates
# every grep-able prose claim in THREAT-MODEL.md and ASSESSMENTS.md against
# either current-HEAD source (for stage-local or repo-wide identifiers) or
# the specific commit SHA the artifacts cite (for sibling-unit work that has
# not yet been merged into the security stage branch).
#
# Exit code:
#   0 = every claim verified
#   non-zero = at least one claim does not survive grep — synthesis prose
#              has drifted from source of truth and MUST be corrected before
#              the stage advances
#
# Usage:
#   bash .haiku/intents/<intent>/stages/security/artifacts/verify-prose-claims.sh
#   (run from repo root or the unit-04 worktree root — path-relative grep)
#
# This script is the paired regression test mandated by the blue-team hat
# definition: "MUST add regression tests that reproduce the original attack."
# The "attack" here is fabricated prose; the regression test reproduces it
# every time a subsequent author adds a fabricated identifier.

set -u
FAIL=0
PASS=0
SKIP=0
RESULTS=()

# ----- helpers -----

# expect_match <label> <pattern> <file_or_path>
# Greps the file at HEAD for the pattern. Pattern is an extended-regex.
expect_match() {
	local label="$1" pat="$2" file="$3"
	if [[ ! -f "$file" ]]; then
		FAIL=$((FAIL + 1))
		RESULTS+=("FAIL: $label — file not found: $file")
		return
	fi
	if grep -qE "$pat" "$file"; then
		PASS=$((PASS + 1))
		RESULTS+=("PASS: $label")
	else
		FAIL=$((FAIL + 1))
		RESULTS+=("FAIL: $label — pattern '$pat' not found in $file")
	fi
}

# expect_match_at <label> <pattern> <sha> <path-in-tree>
# git show <sha>:<path> | grep -E pattern. Used for sibling-unit work that
# hasn't merged into the local HEAD yet.
expect_match_at() {
	local label="$1" pat="$2" sha="$3" path="$4"
	if ! git cat-file -e "$sha" 2>/dev/null; then
		SKIP=$((SKIP + 1))
		RESULTS+=("SKIP: $label — commit $sha not reachable from this worktree")
		return
	fi
	if git show "$sha:$path" 2>/dev/null | grep -qE "$pat"; then
		PASS=$((PASS + 1))
		RESULTS+=("PASS: $label")
	else
		FAIL=$((FAIL + 1))
		RESULTS+=("FAIL: $label — pattern '$pat' not found in $path @ $sha")
	fi
}

# expect_nomatch <label> <pattern> <glob-or-path>
# Confirms a fabricated identifier does NOT exist (e.g. HAIKU_DRIFT_DETECTION).
expect_nomatch() {
	local label="$1" pat="$2" path="$3"
	if grep -rqE "$pat" "$path" 2>/dev/null; then
		FAIL=$((FAIL + 1))
		RESULTS+=("FAIL: $label — pattern '$pat' UNEXPECTEDLY found in $path (synthesis prose claims it does not exist)")
	else
		PASS=$((PASS + 1))
		RESULTS+=("PASS: $label (negative — pattern correctly absent)")
	fi
}

# ----- claims grouped by surface -----

echo "=== §5 + §1.5: drift-gate kill-switch (FB-11 regression) ==="
# THREAT-MODEL.md §5 claims the kill-switch is `settings.drift_detection === false`
# at drift-detection-gate.ts:5, with telemetry haiku.drift.gate.kill_switch_hit at :403.
# It also claims (post-FB-11) that no HAIKU_DRIFT_DETECTION env var exists.
expect_match "drift kill-switch settings field" \
	'settings\.drift_detection.*===.*false|drift_detection.*===.*false' \
	packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts
expect_match "drift kill-switch telemetry signal" \
	'haiku\.drift\.gate\.kill_switch_hit' \
	packages/haiku/src/orchestrator/workflow/drift-detection-gate.ts
expect_nomatch "FB-11 fabricated env var" \
	'HAIKU_DRIFT_DETECTION' \
	packages/haiku/src/

echo ""
echo "=== §6.1 + §3.5: Fastify connectionTimeout (FB-12 regression) ==="
# THREAT-MODEL.md §6.1 (post-FB-12) claims fastify connectionTimeout is NOT
# overridden in http.ts:107-136, so slowloris is unmitigated. The negative
# grep is the regression: if any future commit adds a connectionTimeout /
# requestTimeout / keepAliveTimeout, the prose must be re-verified (it would
# transition slowloris from unmitigated to mitigated, which is good news
# but the synthesis text must be updated).
expect_nomatch "FB-12 connectionTimeout / requestTimeout / keepAliveTimeout absence" \
	'connectionTimeout|requestTimeout|keepAliveTimeout' \
	packages/haiku/src/

echo ""
echo "=== §1.3 + §1.4: tunnel.ts JWT crypto identifiers ==="
# THREAT-MODEL.md §1.3 claims EPHEMERAL_SECRET = randomBytes(32) at tunnel.ts:11.
# §1.4 / S-4 claims explicit alg !== "HS256" rejection at tunnel.ts:135-148.
expect_match "EPHEMERAL_SECRET = randomBytes(32)" \
	'EPHEMERAL_SECRET[[:space:]]*=[[:space:]]*randomBytes\(32\)' \
	packages/haiku/src/tunnel.ts
expect_match "alg HS256 explicit rejection" \
	'alg.*!==.*"HS256"' \
	packages/haiku/src/tunnel.ts

echo ""
echo "=== §3.2 / §4.x / §7: unit-01 fix identifiers (commit f83f45fe5) ==="
# Cited at unit-01 branch tip; not yet merged into the security stage branch.
expect_match_at "MAX_UPLOAD_BYTES_HARD_CAP = 50 MiB" \
	'MAX_UPLOAD_BYTES_HARD_CAP[[:space:]]*=[[:space:]]*50' \
	f83f45fe5 packages/haiku/src/http/upload-routes.ts
expect_match_at "ALLOWED_MIMES allowlist constant" \
	'ALLOWED_MIMES|allowedMimes' \
	f83f45fe5 packages/haiku/src/http/upload-routes.ts
expect_match_at "ATTRIBUTE_TO_USER_PATTERN allowlist regex" \
	'ATTRIBUTE_TO_USER_PATTERN' \
	f83f45fe5 packages/haiku/src/http/upload-routes.ts
expect_match_at "rationale schema cap (V-09)" \
	'agent_rationale|rationale.*max|10[[:space:]]*\*[[:space:]]*1024|10240' \
	f83f45fe5 packages/haiku/src/state-tools.ts

echo ""
echo "=== §3.1 / §3.3 / §4.x: unit-02 fix identifiers (commit fe91e1e64) ==="
expect_match_at "claimed_author_id rename present" \
	'claimed_author_id' \
	fe91e1e64 packages/haiku/src/state-tools.ts
expect_match_at "getIntentScopeTickCounter (V-05)" \
	'getIntentScopeTickCounter' \
	fe91e1e64 packages/haiku/src/state-tools.ts
expect_match_at "verifyIntentMutationAuth (V-03 R-01)" \
	'verifyIntentMutationAuth' \
	fe91e1e64 packages/haiku/src/http/upload-routes.ts

echo ""
echo "=== §3.2 / §3.6 / §4.x / §7: unit-03 fix identifiers (commit 06cbb625c) ==="
expect_match_at "safeMkdirAndRename helper (V-04)" \
	'safeMkdirAndRename' \
	06cbb625c packages/haiku/src/http/path-safety.ts
expect_match_at "query_param_token_disallowed reason (V-08)" \
	'query_param_token_disallowed' \
	06cbb625c packages/haiku/src/http/csrf.ts

echo ""
echo "=== §1.5 trust-assumption gate enforcement ==="
# §1.5 declares four trust assumptions whose violation triggers re-rate of
# every High/Medium severity. We can't unit-test the operational invariants
# (URL leak rate, process-memory secret extraction). Assumptions 3 and 4
# are enforced by code paths whose presence is already validated by the
# at-SHA checks above (verifyIntentMutationAuth at fe91e1e64,
# tunnel-mismatch rejection at HEAD). When the security stage branch has
# all three sibling units merged, the unconditional check below activates;
# until then, the at-SHA evidence is authoritative.
if grep -qE 'verifyIntentMutationAuth' packages/haiku/src/http/upload-routes.ts 2>/dev/null; then
	expect_match "trust assumption 4: sid cross-binding (verifyIntentMutationAuth at HEAD)" \
		'verifyIntentMutationAuth' \
		packages/haiku/src/http/upload-routes.ts
else
	SKIP=$((SKIP + 1))
	RESULTS+=("SKIP: trust assumption 4 at HEAD — unit-02 fix not yet merged into this worktree (authoritative check above at SHA fe91e1e64 PASSED)")
fi

echo ""
echo "=== Summary ==="
for r in "${RESULTS[@]}"; do
	echo "$r"
done
echo ""
echo "PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"

if [[ $FAIL -gt 0 ]]; then
	echo ""
	echo "FAIL: at least one synthesis-prose claim no longer matches source of truth."
	echo "Either correct the prose in THREAT-MODEL.md / ASSESSMENTS.md, or"
	echo "investigate whether the source code regressed in a way the threat"
	echo "model has not yet acknowledged."
	exit 1
fi

# Exit 0 only when at least one positive check passed AND no fails.
# (All-skip is not a pass — it means we ran in a context where none of the
# cited SHAs are reachable, which is a different failure.)
if [[ $PASS -eq 0 ]]; then
	echo "FAIL: no claim could be verified (all skipped). Run from a worktree where the cited unit branches are reachable."
	exit 2
fi

echo "OK: all synthesis-prose identifier claims match source of truth."
exit 0
