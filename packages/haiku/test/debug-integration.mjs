import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
process.env.CLAUDE_PLUGIN_ROOT = resolve(__dirname, "..", "..", "..", "plugin")

const root = mkdtempSync(join(tmpdir(), "haiku-debug-"))
const haikuRoot = join(root, ".haiku")
const slug = "drift-test"
const iDir = join(haikuRoot, "intents", slug)
const mkstage = (stage) => {
	const sd = join(iDir, "stages", stage)
	mkdirSync(sd, { recursive: true })
	return sd
}

for (const s of ["inception", "product"]) {
	const sd = mkstage(s)
	writeFileSync(
		join(sd, "state.json"),
		JSON.stringify({ phase: "gate", status: "completed" }, null, 2),
	)
}

const designDir = mkstage("design")
mkdirSync(join(designDir, "artifacts"), { recursive: true })
writeFileSync(
	join(designDir, "state.json"),
	JSON.stringify(
		{
			phase: "execute",
			status: "in-progress",
			iteration: 1,
			hat: "builder",
		},
		null,
		2,
	),
)

writeFileSync(
	join(iDir, "intent.md"),
	[
		"---",
		'studio: "software"',
		'active_stage: "design"',
		'status: "in-progress"',
		"---",
		"",
		"# Test intent",
	].join("\n"),
)

const sha256 = (c) =>
	createHash("sha256")
		.update(typeof c === "string" ? Buffer.from(c) : c)
		.digest("hex")
const originalContent = "<html>original agent output</html>"
const humanContent = "<html>human replacement</html>"
writeFileSync(join(designDir, "artifacts", "output.html"), originalContent)

const { writeBaseline } = await import(
	"../src/orchestrator/workflow/drift-baseline.ts"
)
const relPath = "stages/design/artifacts/output.html"
await writeBaseline(iDir, "design", {
	entries: new Map([
		[
			relPath,
			{
				path: relPath,
				sha256: sha256(originalContent),
				bytes: Buffer.byteLength(originalContent),
				mtime_ns: Date.now() * 1_000_000,
				is_binary: false,
				author_class: "agent",
				acknowledged_at: new Date().toISOString(),
				acknowledged_via: "agent-write",
				stage: "design",
				tracking_class: "stage-output",
			},
		],
	]),
})

writeFileSync(join(designDir, "artifacts", "output.html"), humanContent)

const { runWorkflowTick } = await import(
	"../src/orchestrator/workflow/run-tick.ts"
)
const result = runWorkflowTick(slug, haikuRoot)
console.log("result.state:", result?.state)
console.log("result.action.action:", result?.action?.action)
if (result?.action?.findings) {
	console.log("findings count:", result.action.findings.length)
	console.log("finding path:", result.action.findings[0]?.path)
}

rmSync(root, { recursive: true, force: true })
