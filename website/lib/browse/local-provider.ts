import {
	deriveActiveStageFromStageTree,
	deriveStageStateFromUnits,
	deriveV4ActiveStage,
	parseElaborationVerified,
	parseFeedback,
	parseIntentApprovals,
	parseIntentFromRaw,
	parseStageStateJson,
} from "./intent-parsing"
import { parseSettingsYaml } from "./resolve-links"
import type {
	BrowseProvider,
	HaikuArtifact,
	HaikuFeedback,
	HaikuIntent,
	HaikuIntentDetail,
	HaikuKnowledgeFile,
	HaikuStageState,
	HaikuUnit,
} from "./types"
import { normalizeIntentStatus, parseFrontmatter, parseUnit } from "./types"

// File System Access API types (not in all TS DOM libs)
interface FSDirectoryHandle {
	getDirectoryHandle(name: string): Promise<FSDirectoryHandle>
	getFileHandle(name: string): Promise<{ getFile(): Promise<File> }>
	entries(): AsyncIterable<[string, { kind: "file" | "directory" }]>
}

export class LocalProvider implements BrowseProvider {
	readonly name = "Local Directory"
	private root: FSDirectoryHandle

	constructor(root: FileSystemDirectoryHandle) {
		this.root = root as unknown as FSDirectoryHandle
	}

	async init(): Promise<boolean> {
		try {
			await this.root.getDirectoryHandle(".haiku")
			return true
		} catch {
			return false
		}
	}

	/**
	 * Return a browser-scoped object URL for an artifact file. Used by
	 * the specialized viewers (KiCad, Gerber, glTF, model-viewer, PDF)
	 * which need a URL they can hand to a `<script type="module">`
	 * viewer rather than raw text. The URL is only valid while the
	 * page is open; reload re-creates it. We don't bother revoking —
	 * the page is small and short-lived.
	 */
	async getObjectUrl(path: string): Promise<string | null> {
		try {
			const parts = path.split("/").filter(Boolean)
			let dir: FSDirectoryHandle = this.root
			for (const part of parts.slice(0, -1)) {
				dir = await dir.getDirectoryHandle(part)
			}
			const fileHandle = await dir.getFileHandle(parts[parts.length - 1])
			const file = await fileHandle.getFile()
			return URL.createObjectURL(file)
		} catch (err) {
			const name = (err as Error).name ?? "Error"
			if (name !== "NotFoundError") {
				console.warn(`[browse] getObjectUrl("${path}") failed:`, err)
			}
			return null
		}
	}

	async readFile(path: string): Promise<string | null> {
		try {
			const parts = path.split("/").filter(Boolean)
			let dir: FSDirectoryHandle = this.root
			for (const part of parts.slice(0, -1)) {
				dir = await dir.getDirectoryHandle(part)
			}
			const fileHandle = await dir.getFileHandle(parts[parts.length - 1])
			const file = await fileHandle.getFile()
			return await file.text()
		} catch (err) {
			const name = (err as Error).name ?? "Error"
			// NotFoundError is expected for opportunistic reads (e.g., a
			// stage that has no state.json in v4). Surface anything else.
			if (name !== "NotFoundError") {
				console.warn(
					`[browse] readFile("${path}") failed: ${name}: ${(err as Error).message ?? err}`,
				)
			}
			return null
		}
	}

	async listFiles(dir: string): Promise<string[]> {
		try {
			const parts = dir.split("/").filter(Boolean)
			let handle: FSDirectoryHandle = this.root
			for (const part of parts) {
				handle = await handle.getDirectoryHandle(part)
			}
			const files: string[] = []
			for await (const [name, entry] of handle.entries()) {
				if (entry.kind === "file") files.push(name)
			}
			return files.sort()
		} catch (err) {
			// Most common: directory doesn't exist (NotFoundError) which is
			// fine to swallow. Log everything else so the caller can debug
			// why a directory that should be there came back empty.
			const name = (err as Error).name ?? "Error"
			if (name !== "NotFoundError") {
				console.warn(`[browse] listFiles("${dir}") failed:`, err)
			}
			return []
		}
	}

	private async listDirs(dir: string): Promise<string[]> {
		try {
			const parts = dir.split("/").filter(Boolean)
			let handle: FSDirectoryHandle = this.root
			for (const part of parts) {
				handle = await handle.getDirectoryHandle(part)
			}
			const dirs: string[] = []
			for await (const [name, entry] of handle.entries()) {
				if (entry.kind === "directory") dirs.push(name)
			}
			return dirs.sort()
		} catch (err) {
			// Most common: directory doesn't exist (NotFoundError) which is
			// fine to swallow. Log everything else so the caller can debug
			// why a directory that should be there came back empty.
			const name = (err as Error).name ?? "Error"
			if (name !== "NotFoundError") {
				console.warn(`[browse] listDirs("${dir}") failed:`, err)
			}
			return []
		}
	}

	async getSettings(): Promise<Record<string, unknown> | null> {
		const raw = await this.readFile(".haiku/settings.yml")
		if (!raw) return null
		return parseSettingsYaml(raw)
	}

	async listIntents(
		onProgress?: (intent: HaikuIntent) => void,
	): Promise<HaikuIntent[]> {
		const intentDirs = await this.listDirs(".haiku/intents")
		const intents: HaikuIntent[] = []

		for (const slug of intentDirs) {
			const raw = await this.readFile(`.haiku/intents/${slug}/intent.md`)
			if (!raw) {
				continue
			}
			// Route through the shared parser so v3↔v4 dual-pathing
			// (sealed_at-derived status, plugin_version detection,
			// activeStage default) lands consistently across providers.
			const intent = parseIntentFromRaw("local", slug, raw)
			// v4+ active-stage refinement — list-view-cheap, mirrors the
			// VCS providers' probeStagesWithUnits behavior. Applies to
			// every schema from v4 onward (v4 dropped `active_stage` from
			// intent.md; later versions kept that contract).
			const pv = intent.raw.plugin_version
			const major =
				typeof pv === "string" ? Number.parseInt(pv.split(".")[0], 10) : 0
			const isV4Plus = Number.isFinite(major) && major >= 4
			if (isV4Plus && intent.studioStages.length > 0) {
				const stageDirs = await this.listDirs(`.haiku/intents/${slug}/stages`)
				const stagesWithUnits = new Set<string>()
				for (const stage of intent.studioStages) {
					if (!stageDirs.includes(stage)) continue
					const unitFiles = await this.listFiles(
						`.haiku/intents/${slug}/stages/${stage}/units`,
					)
					if (unitFiles.some((f) => f.endsWith(".md"))) {
						stagesWithUnits.add(stage)
					}
				}
				intent.activeStage = deriveActiveStageFromStageTree(
					intent.studioStages,
					stagesWithUnits,
				)
			}
			intents.push(intent)
			// Streaming callback contract — PortfolioView relies on this
			// to incrementally append intents to component state as each
			// one finishes parsing. Without it, the array returned at the
			// end is discarded by the caller and the page renders empty.
			if (onProgress) onProgress(intent)
		}

		return intents
	}

	async getIntent(slug: string): Promise<HaikuIntentDetail | null> {
		const raw = await this.readFile(`.haiku/intents/${slug}/intent.md`)
		if (!raw) return null

		const { data, content } = parseFrontmatter(raw, {
			provider: "local",
			path: `.haiku/intents/${slug}/intent.md`,
			slug,
		})
		const studio = (data.studio as string) || "ideation"
		const stageNames = (data.stages as string[]) || []
		const activeStage = (data.active_stage as string) || ""
		const intentMode = (data.mode as string) || "continuous"

		// Load stages
		const stageDirs = await this.listDirs(`.haiku/intents/${slug}/stages`)
		const stages: HaikuStageState[] = []

		for (const stageName of stageNames.length > 0 ? stageNames : stageDirs) {
			const unitFiles = await this.listFiles(
				`.haiku/intents/${slug}/stages/${stageName}/units`,
			)
			const units: HaikuUnit[] = []

			for (const unitFile of unitFiles) {
				if (!unitFile.endsWith(".md")) continue
				const unitPath = `.haiku/intents/${slug}/stages/${stageName}/units/${unitFile}`
				const unitRaw = await this.readFile(unitPath)
				if (!unitRaw) continue
				units.push(
					parseUnit(unitFile, stageName, unitRaw, {
						provider: "local",
						path: unitPath,
						slug,
					}),
				)
			}

			// Read stage state.json (v3 only — v4 deletes it during
			// migration. Absence is normal for v4 intents.)
			const stateRaw = await this.readFile(
				`.haiku/intents/${slug}/stages/${stageName}/state.json`,
			)
			const {
				phase: v3Phase,
				startedAt: stageStartedAt,
				completedAt: stageCompletedAt,
				gateOutcome,
				stateStatus,
			} = parseStageStateJson(stateRaw)

			// elaboration.md verification — same tri-state the cursor
			// reads to decide whether the elaborate gate has cleared.
			const elaborationRaw = await this.readFile(
				`.haiku/intents/${slug}/stages/${stageName}/elaboration.md`,
			)
			const elaborationVerified = parseElaborationVerified(elaborationRaw)

			// Status + phase resolution priority:
			//   1. v3 state.json.status (when present, authoritative)
			//   2. v4 derived from per-unit iterations[] + approvals + mode
			//      + elaboration verification, via the shared pure helper.
			//   3. v3 active_stage / stage-order fallback (un-migrated
			//      intents where state.json is missing for whatever reason)
			let status: "pending" | "active" | "complete" = "pending"
			let stagePhase: HaikuStageState["phase"] = v3Phase
			if (stateStatus === "active") status = "active"
			else if (stateStatus === "completed") status = "complete"
			else if (units.length > 0 || stateRaw == null) {
				// v4 path: state.json was missing AND we have units to
				// inspect. Fold per-unit FMs into a single derivation.
				const derived = deriveStageStateFromUnits(units, {
					stage: stageName,
					intentMode,
					elaborationVerified,
				})
				status = derived.status
				stagePhase = derived.phase
			} else if (stageName === activeStage) status = "active"
			else if (stageNames.indexOf(stageName) < stageNames.indexOf(activeStage))
				status = "complete"

			// Read stage artifacts
			const artifactFiles = await this.listFiles(
				`.haiku/intents/${slug}/stages/${stageName}/artifacts`,
			)
			const stageArtifacts: HaikuArtifact[] = []
			for (const af of artifactFiles) {
				const lower = af.toLowerCase()
				const artType: HaikuArtifact["type"] = lower.endsWith(".md")
					? "markdown"
					: lower.endsWith(".html") || lower.endsWith(".htm")
						? "html"
						: /\.(png|jpe?g|gif|svg|webp|avif|bmp|ico)$/.test(lower)
							? "image"
							: "other"
				// For images / 3D models / PDFs / engineering binaries, the
				// browse viewers need a URL, not raw text. Resolve those via
				// `URL.createObjectURL` and stash in `rawUrl` so the
				// dispatch in IntentDetailView's StageDetail can hand them
				// to the right specialized viewer.
				const needsObjectUrl =
					artType === "image" ||
					/\.(glb|gltf|pdf|kicad_sch|kicad_pcb|kicad_pro|gbr|drl)$/i.test(af)
				const artifactPath = `.haiku/intents/${slug}/stages/${stageName}/artifacts/${af}`
				if (needsObjectUrl) {
					const url = await this.getObjectUrl(artifactPath)
					stageArtifacts.push({
						name: af,
						type: artType,
						rawUrl: url ?? undefined,
					})
				} else {
					const artContent = await this.readFile(artifactPath)
					if (artContent != null) {
						stageArtifacts.push({
							name: af,
							content: artContent,
							type: artType,
						})
					} else {
						stageArtifacts.push({ name: af, type: artType })
					}
				}
			}

			// Stage feedback files
			const feedbackFiles = await this.listFiles(
				`.haiku/intents/${slug}/stages/${stageName}/feedback`,
			)
			const stageFeedback: HaikuFeedback[] = []
			for (const fb of feedbackFiles) {
				if (!fb.endsWith(".md")) continue
				const fbPath = `.haiku/intents/${slug}/stages/${stageName}/feedback/${fb}`
				const fbRaw = await this.readFile(fbPath)
				if (!fbRaw) continue
				stageFeedback.push(
					parseFeedback("local", slug, stageName, fb, fbRaw, fbPath),
				)
			}

			stages.push({
				name: stageName,
				status,
				phase: stagePhase,
				startedAt: stageStartedAt,
				completedAt: stageCompletedAt,
				gateOutcome,
				units,
				artifacts: stageArtifacts.length > 0 ? stageArtifacts : undefined,
				feedback: stageFeedback.length > 0 ? stageFeedback : undefined,
			})
		}

		// Load knowledge files with content
		const knowledgeFileNames = await this.listFiles(
			`.haiku/intents/${slug}/knowledge`,
		)
		const knowledge: HaikuKnowledgeFile[] = []
		for (const name of knowledgeFileNames) {
			if (!name.endsWith(".md")) continue
			const kContent = await this.readFile(
				`.haiku/intents/${slug}/knowledge/${name}`,
			)
			knowledge.push({ name, content: kContent || "" })
		}

		// Load operations files with content
		const operationsFileNames = await this.listFiles(
			`.haiku/intents/${slug}/operations`,
		)
		const operations: HaikuKnowledgeFile[] = []
		for (const name of operationsFileNames) {
			if (!name.endsWith(".md")) continue
			const oContent = await this.readFile(
				`.haiku/intents/${slug}/operations/${name}`,
			)
			operations.push({ name, content: oContent || "" })
		}

		// v4 active-stage refinement: when intent.md has no
		// active_stage (v4 dropped the field), walk the loaded stages
		// in declaration order and pick the first one that isn't
		// "complete." Keeps v3 behavior intact when active_stage is
		// stamped on intent.md.
		const stageStatusByName: Record<string, "pending" | "active" | "complete"> =
			{}
		for (const s of stages) stageStatusByName[s.name] = s.status
		const refinedActiveStage = activeStage
			? activeStage
			: deriveV4ActiveStage(stageNames, stageStatusByName)

		// Intent-scope feedback
		const intentFeedbackFiles = await this.listFiles(
			`.haiku/intents/${slug}/feedback`,
		)
		const intentFeedback: HaikuFeedback[] = []
		for (const fb of intentFeedbackFiles) {
			if (!fb.endsWith(".md")) continue
			const fbPath = `.haiku/intents/${slug}/feedback/${fb}`
			const fbRaw = await this.readFile(fbPath)
			if (!fbRaw) continue
			intentFeedback.push(parseFeedback("local", slug, null, fb, fbRaw, fbPath))
		}

		return {
			slug,
			title: (data.title as string) || slug,
			studio,
			activeStage: refinedActiveStage,
			mode: (data.mode as string) || "continuous",
			createdAt:
				(data.created_at as string) || (data.created as string) || null,
			startedAt: (data.started_at as string) || null,
			completedAt: (data.completed_at as string) || null,
			studioStages: (data.stages as string[]) || [],
			composite:
				(data.composite as Array<{ studio: string; stages: string[] }>) || null,
			...normalizeIntentStatus(
				(data.status as string) || "active",
				(data.completed_at as string) || null,
				stageNames.indexOf(refinedActiveStage),
				stageNames.length,
			),
			stagesTotal: stageNames.length,
			archived: data.archived === true,
			follows: (data.follows as string) || null,
			raw: data,
			stages,
			knowledge,
			operations,
			reflection: await this.readFile(`.haiku/intents/${slug}/reflection.md`),
			content,
			assets: [],
			intentFeedback,
			intentApprovals: parseIntentApprovals(data),
		}
	}
}
