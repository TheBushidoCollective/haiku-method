// commit-message-fb-safety.test.mjs
//
// Locks a delivery footgun: GitHub and GitLab parse a VCS issue-closing
// keyword (Closes/Fixes/Resolves/Implements, any tense) followed by an
// `ABC-123`-shaped token as an external-issue closing reference. H·AI·K·U
// feedback IDs (`FB-07`) match that shape, so a prescribed fix-loop commit
// message like `haiku: fix FB-07 ...` made GitLab render a phantom
// "Closes issues FB-07" ticket link — and queue a non-existent issue for
// closure on merge (reported 2026-05-21 on a real delivery MR).
//
// The fix: prompt templates that prescribe a commit message referencing a
// feedback id MUST use a neutral verb (`address`), never a closing verb.
// Note `intent-fix FB-07` ALSO triggers — `\bfix` matches inside the
// hyphenated word. This test scans every engine prompt template for the
// dangerous pairing so it can't regress.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { glob } from "node:fs/promises"

const REPO_ROOT = new URL("../../../", import.meta.url).pathname
const PROMPTS_DIR = join(REPO_ROOT, "plugin", "prompts")

// A closing keyword (with a word boundary, so it also catches the `fix`
// inside `intent-fix`) immediately before a feedback-id token — either the
// `<%= fbId %>` template variable or a literal `FB-<n>`.
const DANGEROUS =
	/\b(?:close[sd]?|closing|fix(?:e[sd]?|ing)?|resolve[sd]?|resolving|implement(?:s|ed|ing)?)\s+(?:issues?\s+)?(?:<%=\s*fbId|FB-\d)/i

test("no engine prompt template pairs a VCS closing keyword with a feedback id", async () => {
	const offenders = []
	for await (const entry of glob("**/*.eta.md", { cwd: PROMPTS_DIR })) {
		const abs = join(PROMPTS_DIR, entry)
		const text = readFileSync(abs, "utf8")
		for (const line of text.split("\n")) {
			if (DANGEROUS.test(line)) {
				offenders.push(`${entry}: ${line.trim()}`)
			}
		}
	}
	assert.deepEqual(
		offenders,
		[],
		`Prompt templates must not prescribe a closing keyword before a feedback id ` +
			`(GitHub/GitLab read it as an external-issue closing ref). Use a neutral ` +
			`verb like "address". Offenders:\n${offenders.join("\n")}`,
	)
})
