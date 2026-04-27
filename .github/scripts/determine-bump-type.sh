#!/bin/bash
set -e

# Determines semver bump type (major, minor, patch) for a push to main.
#
# Two-pass strategy:
#   1. Conventional-commit regex over every commit body in BEFORE_SHA..AFTER_SHA.
#      Catches `feat:` / `fix:` / breaking-change markers in any commit in the
#      pushed range — including squash commits and the body of merge commits.
#   2. If the regex pass lands on `patch`, ask Claude haiku to look at the
#      actual diff and the collected commit subjects. If it sees a real
#      feature or breaking change masquerading as a non-conventional title,
#      it can upgrade patch → minor or patch → major.
#
# Pass 2 is skipped if the regex already picked up a feat / breaking change
# (we trust the human-written marker over the model) or if the Claude CLI
# isn't available.
#
# Usage: ./determine-bump-type.sh
# Output: stdout = "major" | "minor" | "patch"
#
# Env (required):
#   BEFORE_SHA — github.event.before
#   AFTER_SHA  — github.event.after
# Env (optional):
#   CLAUDE_CODE_OAUTH_TOKEN — enables Claude pass 2

if [ -z "$BEFORE_SHA" ] || [ -z "$AFTER_SHA" ]; then
	echo "BEFORE_SHA and AFTER_SHA must be set" >&2
	exit 1
fi

# ---- Pass 1: conventional-commit regex over the pushed range ----
if [ "$BEFORE_SHA" = "0000000000000000000000000000000000000000" ]; then
	# Branch creation push (rare on main) — fall back to the head commit.
	COMMITS_FULL=$(git log -1 --format='%B' HEAD)
	COMMITS_SUBJECT=$(git log -1 --format='%s' HEAD)
	GIT_RANGE="HEAD"
else
	GIT_RANGE="${BEFORE_SHA}..${AFTER_SHA}"
	# %B = full body — picks up BREAKING CHANGE: footers as well as
	# subject-line markers like `feat:` and `feat!:`.
	COMMITS_FULL=$(git log --format='%B%n--END--%n' "$GIT_RANGE")
	COMMITS_SUBJECT=$(git log --format='%s' --no-merges "$GIT_RANGE")
fi

BUMP_TYPE="patch"
while IFS= read -r line; do
	if echo "$line" | grep -qE '^[a-z]+(\(.+\))?!:|^BREAKING CHANGE:|^BREAKING-CHANGE:'; then
		BUMP_TYPE="major"
		break
	elif echo "$line" | grep -qE '^feat(\(.+\))?:'; then
		if [ "$BUMP_TYPE" = "patch" ]; then
			BUMP_TYPE="minor"
		fi
	fi
done <<< "$COMMITS_FULL"

# Trust regex when it found a marker.
if [ "$BUMP_TYPE" != "patch" ]; then
	echo "Pass 1 (regex): $BUMP_TYPE" >&2
	echo "$BUMP_TYPE"
	exit 0
fi

# ---- Pass 2: Claude haiku looks at the diff for plain-English titles ----
if ! command -v claude >/dev/null 2>&1 || [ -z "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
	echo "Pass 1 (regex): patch — Claude unavailable, no pass 2" >&2
	echo "patch"
	exit 0
fi

# Cap diff stat at ~80 lines so giant PRs don't blow the prompt budget.
DIFF_STAT=$(git diff --stat "$GIT_RANGE" 2>/dev/null | head -80 || true)

PROMPT="Classify the semver bump type for a release of the AI-DLC Claude Code plugin (a structured-development plugin with MCP tools, skills, studios, stages, and hats).

The conventional-commit regex pass already ran and returned 'patch'. Your job is to look at the actual diff and decide whether that's correct, or whether this is really a minor or major release whose commits just didn't use conventional-commit prefixes.

Output EXACTLY one word — major, minor, or patch — and nothing else. No punctuation, no explanation.

Rules:
- major: removed or renamed public surface (MCP tool, skill, studio, stage, hat, config field, CLI flag); behavior change users must adapt to; on-disk schema break
- minor: new feature, new MCP tool/skill/studio/stage/hat/review-agent/operation, new capability, new config option — anything additive that users can opt into
- patch: bug fix, internal refactor with no user-visible change, docs, chore, dependency bump, test-only, CI tweak, prompt wording polish

When in doubt between minor and patch, look at whether a user could newly DO something. If yes, minor.
When in doubt between major and minor, look at whether existing users would have to change their setup. If yes, major.

Commit subjects in this push:
$COMMITS_SUBJECT

Diff stat:
$DIFF_STAT"

CLAUDE_OUTPUT=$(echo "$PROMPT" | claude --print --model haiku 2>/dev/null \
	| tr -d '[:space:][:punct:]' \
	| tr '[:upper:]' '[:lower:]' \
	| head -c 16 \
	|| true)

case "$CLAUDE_OUTPUT" in
	major|minor|patch)
		echo "Pass 2 (Claude): $CLAUDE_OUTPUT (regex said: patch)" >&2
		echo "$CLAUDE_OUTPUT"
		exit 0
		;;
	*)
		echo "Pass 2 (Claude) returned unexpected output ('$CLAUDE_OUTPUT') — sticking with regex result: patch" >&2
		echo "patch"
		exit 0
		;;
esac
