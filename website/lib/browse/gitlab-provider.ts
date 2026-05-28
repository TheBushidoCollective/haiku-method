import { fetchQuery } from "relay-runtime"
import { createRelayEnvironment } from "./graphql/environment"
import type { operationsBatchBlobsQuery$data } from "./graphql/gitlab/__generated__/operationsBatchBlobsQuery.graphql"
import BatchBlobsQuery from "./graphql/gitlab/__generated__/operationsBatchBlobsQuery.graphql"
import type { operationsIntentTreeQuery$data } from "./graphql/gitlab/__generated__/operationsIntentTreeQuery.graphql"
import type { operationsListBranchNamesQuery$data } from "./graphql/gitlab/__generated__/operationsListBranchNamesQuery.graphql"
import ListBranchNamesQuery from "./graphql/gitlab/__generated__/operationsListBranchNamesQuery.graphql"
import ListFilesQueryArtifact from "./graphql/gitlab/__generated__/operationsListFilesQuery.graphql"
// Relay-compiled query artifacts (schema-validated, fully typed)
import type { operationsListIntentsTreeQuery$data } from "./graphql/gitlab/__generated__/operationsListIntentsTreeQuery.graphql"
import ListIntentsTreeQuery from "./graphql/gitlab/__generated__/operationsListIntentsTreeQuery.graphql"
import ReadFileQuery from "./graphql/gitlab/__generated__/operationsReadFileQuery.graphql"
import { blobToDataUrl, mimeFromPath } from "./html-render"
import {
	classifyArtifact,
	deriveActiveStageFromStageTree,
	deriveStageStateFromUnits,
	deriveV4ActiveStage,
	isCollectibleStageFile,
	isV4Intent,
	mergeKnowledge as mergeKnowledgeShared,
	normalizeStageProgression,
	parseElaborationVerified,
	parseFeedback,
	parseIntentApprovals,
	parseIntentFromRaw as parseIntentFromRawShared,
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

const glCache = new Map<string, { data: unknown; ts: number }>()
const GL_CACHE_TTL = 5 * 60 * 1000
const CHUNK_SIZE = 10

/** Resolved intent tree data from a single ref — used for three-level merge. */
interface GitLabIntentRefData {
	blobByPath: Map<string, string>
	allBlobs: Array<{ name: string; path: string }>
	allTrees: Array<{ name: string; path: string }>
	assets: Array<{ path: string; name: string; rawUrl: string }>
}

export class GitLabProvider implements BrowseProvider {
	readonly name = "GitLab"
	private host: string
	private projectPath: string
	private branch: string
	private token: string | null
	private env: ReturnType<typeof createRelayEnvironment>
	/** Maps slug → branch for intents discovered via branch scanning */
	private intentBranchMap = new Map<string, string>()
	private intentMetaMap = new Map<
		string,
		{
			branch?: string
			prUrl?: string | null
			prStatus?: string | null
			prNumber?: number | null
		}
	>()
	/** Maps "slug/stageName" → branch/MR metadata for stage-level branches */
	private stageBranchMap = new Map<
		string,
		{
			branch: string
			prUrl?: string | null
			prStatus?: string | null
			prNumber?: number | null
		}
	>()
	/** ETag from the last branch-change poll */
	private lastBranchesEtag: string | null = null

	constructor(
		host: string,
		projectPath: string,
		branch = "",
		token: string | null = null,
	) {
		this.host = host
		this.projectPath = projectPath
		this.branch = branch
		this.token = token
		this.env = createRelayEnvironment({
			url: `https://${this.host}/api/graphql`,
			headers: () => this.graphqlHeaders(),
		})
	}

	private graphqlHeaders(): HeadersInit {
		const h: HeadersInit = {}
		if (this.token) h.Authorization = `Bearer ${this.token}`
		return h
	}

	private get encodedProject(): string {
		return encodeURIComponent(this.projectPath)
	}

	private restHeaders(): HeadersInit {
		const h: HeadersInit = {}
		if (this.token) h.Authorization = `Bearer ${this.token}`
		return h
	}

	private async restApi(path: string, init?: RequestInit): Promise<Response> {
		const url = `https://${this.host}/api/v4/projects/${this.encodedProject}${path}`
		return fetch(url, {
			...init,
			headers: { ...this.restHeaders(), ...init?.headers },
		})
	}

	/** Raw GraphQL POST. Relay queries are STATIC (compiled at build time), so
	 *  they can't fan out across a variable number of branch refs in one
	 *  request. The lean list loader needs exactly that — one request that
	 *  reads `intent.md` + the `stages/` tree for N `haiku/<slug>/main` branches
	 *  via per-branch aliases — so it builds the query string dynamically + posts
	 *  it here. Returns `data` (or undefined on a network/transport error;
	 *  per-alias field errors surface as null nodes the caller tolerates). */
	private async rawGraphql<T>(
		query: string,
		variables?: Record<string, unknown>,
	): Promise<T | undefined> {
		try {
			const res = await fetch(`https://${this.host}/api/graphql`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...this.graphqlHeaders(),
				},
				body: JSON.stringify({ query, variables: variables ?? {} }),
			})
			if (!res.ok) {
				console.warn(
					`[haiku-browse] raw GraphQL HTTP ${res.status} ${res.statusText}`,
				)
				return undefined
			}
			const json = (await res.json()) as {
				data?: T
				errors?: Array<{ message: string }>
			}
			// GraphQL errors come back 200 with `errors[]` + (often) null data.
			// Surface them — a silently-dropped intent in the list view is
			// otherwise indistinguishable from "no such intent".
			if (json.errors?.length) {
				console.warn(
					"[haiku-browse] raw GraphQL errors:",
					json.errors.map((e) => e.message).join("; "),
				)
			}
			return json.data
		} catch (err) {
			console.warn("[haiku-browse] raw GraphQL fetch failed:", err)
			return undefined
		}
	}

	/** LEAN per-main-branch batch for the LIST view. For each `haiku/<slug>/main`
	 *  branch, reads ONLY (a) its `intent.md` and (b) the immediate subdir names
	 *  under `.haiku/intents/<slug>/stages/` (the stage-dir count) — both as
	 *  per-branch ALIASES in a single raw GraphQL request (chunked). Replaces
	 *  the old O(3N) fan-out (per-branch readFile + MR fetch + per-stage probe);
	 *  MR/PR status now loads lazily in the detail view. */
	private async batchMainBranchData(
		mains: Array<{ slug: string; branch: string }>,
	): Promise<Map<string, { rawText: string | null; stageDirs: string[] }>> {
		const out = new Map<
			string,
			{ rawText: string | null; stageDirs: string[] }
		>()
		type RepoFields = Record<
			string,
			{
				nodes?: Array<{ rawTextBlob?: string | null }>
				trees?: { nodes?: Array<{ name?: string | null }> }
			} | null
		>
		for (let i = 0; i < mains.length; i += CHUNK_SIZE) {
			const chunk = mains.slice(i, i + CHUNK_SIZE)
			const fields = chunk
				.map((m, j) => {
					const ref = JSON.stringify(m.branch)
					const md = JSON.stringify(`.haiku/intents/${m.slug}/intent.md`)
					const st = JSON.stringify(`.haiku/intents/${m.slug}/stages`)
					return (
						`a${j}_md: blobs(ref: ${ref}, paths: [${md}], first: 1) { nodes { rawTextBlob } }\n` +
						`a${j}_st: tree(ref: ${ref}, path: ${st}, recursive: false) { trees(first: 50) { nodes { name } } }`
					)
				})
				.join("\n")
			const query = `query GLBatchMains($fp: ID!) { project(fullPath: $fp) { repository { ${fields} } } }`
			const data = await this.rawGraphql<{
				project?: { repository?: RepoFields }
			}>(query, { fp: this.projectPath })
			const repo = data?.project?.repository
			// Per-branch fallback: if the aliased batch yielded no intent.md for
			// a branch (transport error, a per-alias field error, or an empty
			// node), fall back to the proven single-ref reads so the intent
			// still surfaces. Correctness first; the batch is the fast path.
			await Promise.all(
				chunk.map(async (m, j) => {
					let rawText = repo?.[`a${j}_md`]?.nodes?.[0]?.rawTextBlob ?? null
					let stageDirs = (repo?.[`a${j}_st`]?.trees?.nodes ?? [])
						.map((n) => n?.name)
						.filter((n): n is string => typeof n === "string" && n.length > 0)
					if (!rawText) {
						rawText = await this.readFileFromRef(
							m.branch,
							`.haiku/intents/${m.slug}/intent.md`,
						)
						const treeData =
							await this.cachedQuery<operationsListIntentsTreeQuery$data>(
								ListIntentsTreeQuery,
								{
									fullPath: this.projectPath,
									path: `.haiku/intents/${m.slug}/stages`,
									ref: m.branch,
								},
								`gl:${this.host}:${this.projectPath}:stagesDirs:${m.slug}:${m.branch}`,
							)
						stageDirs = (
							treeData?.project?.repository?.tree?.trees?.nodes ?? []
						)
							.map((n) => n?.name)
							.filter((n): n is string => typeof n === "string" && n.length > 0)
					}
					out.set(m.slug, { rawText, stageDirs })
				}),
			)
		}
		return out
	}

	/** Ref parameter for GraphQL queries. null means HEAD (server default). */
	private get ref(): string | null {
		return this.branch || null
	}

	/** Resolve a repo-root-relative path to a `data:` URL by fetching the raw
	 *  file (authed) and inlining the bytes — so an HTML output's relative
	 *  CSS/images load inside the sandboxed (opaque-origin) iframe, which
	 *  can't reach parent-origin blob URLs or attach an auth header. Mirrors
	 *  the artifact rawUrl scheme used at session build (files/:path/raw). */
	async resolveAssetUrl(path: string, ref?: string): Promise<string | null> {
		try {
			const encodedPath = encodeURIComponent(path)
			const refName = ref || this.branch || "HEAD"
			const url = `https://${this.host}/api/v4/projects/${this.encodedProject}/repository/files/${encodedPath}/raw?ref=${encodeURIComponent(refName)}`
			const res = await fetch(url, { headers: this.restHeaders() })
			if (!res.ok) return null
			return blobToDataUrl(await res.blob(), mimeFromPath(path))
		} catch {
			return null
		}
	}

	/**
	 * Execute a Relay query with caching.
	 */
	private async cachedQuery<T>(
		query: Parameters<typeof fetchQuery>[1],
		variables: Record<string, unknown>,
		cacheKey: string,
	): Promise<T | undefined> {
		const cached = glCache.get(cacheKey)
		if (cached && Date.now() - cached.ts < GL_CACHE_TTL) return cached.data as T

		const result = await fetchQuery(this.env, query, variables).toPromise()
		if (result) {
			glCache.set(cacheKey, { data: result, ts: Date.now() })
		}
		return result as T | undefined
	}

	async readFile(path: string, ref?: string): Promise<string | null> {
		const refName = ref ?? this.ref
		const cacheKey = `gl:${this.host}:${this.projectPath}:readFile:${refName ?? "HEAD"}:${path}`
		type ReadData = {
			project: {
				repository: {
					blobs: {
						nodes: Array<{
							path: string
							rawTextBlob: string | null
						} | null> | null
					} | null
				} | null
			} | null
		}
		const data = await this.cachedQuery<ReadData>(
			ReadFileQuery,
			{ fullPath: this.projectPath, paths: [path], ref: refName },
			cacheKey,
		)
		const nodes = data?.project?.repository?.blobs?.nodes
		if (!nodes || nodes.length === 0) return null
		return nodes[0]?.rawTextBlob ?? null
	}

	async listFiles(dir: string): Promise<string[]> {
		const cacheKey = `gl:${this.host}:${this.projectPath}:listFiles:${dir}`
		type ListData = {
			project: {
				repository: {
					tree: {
						blobs: {
							nodes: Array<{ name: string; path: string } | null> | null
						} | null
						trees: {
							nodes: Array<{ name: string; path: string } | null> | null
						} | null
					} | null
				} | null
			} | null
		}
		const data = await this.cachedQuery<ListData>(
			ListFilesQueryArtifact,
			{ fullPath: this.projectPath, path: dir, ref: this.ref },
			cacheKey,
		)
		const blobs = data?.project?.repository?.tree?.blobs?.nodes
		if (!blobs) return []
		return blobs
			.filter((n): n is { name: string; path: string } => n != null)
			.map((n) => n.name)
			.sort()
	}

	/** Read a file from a specific ref (bypasses this.ref). */
	private async readFileFromRef(
		ref: string,
		path: string,
	): Promise<string | null> {
		const cacheKey = `gl:${this.host}:${this.projectPath}:readFile:${ref}:${path}`
		type ReadData = {
			project: {
				repository: {
					blobs: {
						nodes: Array<{
							path: string
							rawTextBlob: string | null
						} | null> | null
					} | null
				} | null
			} | null
		}
		const data = await this.cachedQuery<ReadData>(
			ReadFileQuery,
			{ fullPath: this.projectPath, paths: [path], ref },
			cacheKey,
		)
		const nodes = data?.project?.repository?.blobs?.nodes
		if (!nodes || nodes.length === 0) return null
		return nodes[0]?.rawTextBlob ?? null
	}

	/** Fetch the most recent MR for a given source branch. Returns nulls on failure. */
	private async fetchMrForBranch(branchName: string): Promise<{
		prUrl: string | null
		prStatus: string | null
		prNumber: number | null
	}> {
		try {
			const mrRes = await this.restApi(
				`/merge_requests?source_branch=${encodeURIComponent(branchName)}&state=all&order_by=updated_at&sort=desc&per_page=1`,
			)
			if (mrRes.ok) {
				const mrs = await mrRes.json()
				if (Array.isArray(mrs) && mrs.length > 0) {
					return {
						prUrl: mrs[0].web_url,
						prStatus: mrs[0].state,
						prNumber: mrs[0].iid,
					}
				}
			}
		} catch {
			// Non-critical
		}
		return { prUrl: null, prStatus: null, prNumber: null }
	}

	/** Parse raw intent.md text into a HaikuIntent — delegates to the
	 *  shared cross-provider helper so this surface can't drift from
	 *  github-provider.ts. */
	private parseIntentFromRaw(
		slug: string,
		rawText: string,
		meta?: {
			branch?: string
			prUrl?: string | null
			prStatus?: string | null
			prNumber?: number | null
		},
	): HaikuIntent {
		return parseIntentFromRawShared("gitlab", slug, rawText, meta)
	}

	/**
	 * List all intents by scanning haiku branches and the default branch.
	 *
	 * When no branch is specified (default), scans all haiku/{slug}/main branches
	 * for active intents and merges with completed intents from the default branch.
	 * Branch version wins on slug collision.
	 *
	 * When a branch is explicitly specified, falls back to single-branch mode.
	 */
	async listIntents(
		onProgress?: (intent: HaikuIntent) => void,
	): Promise<HaikuIntent[]> {
		// Single-branch mode: explicit branch specified
		if (this.branch) {
			return this.listIntentsSingleBranch(onProgress)
		}

		// Scan mode: discover intents across all haiku/* branches + default branch
		const intentsBySlug = new Map<string, HaikuIntent>()

		// Step 1: List the intent branches via GraphQL — PAGINATED. `branchNames`
		// caps at `limit` per call (100), and a busy monorepo has far more than
		// 100 `haiku/*` branches (every unit branch counts), so a single page
		// silently dropped intents whose `*/main` branch sorted past the cutoff
		// (worker-new-badge, 2026-05-28). The lean list only needs the `*/main`
		// branches, so narrow the glob to `haiku/*/main` (far fewer results) AND
		// page through until a short page signals the end.
		const PAGE = 100
		const mainBranches: string[] = []
		for (let offset = 0; ; offset += PAGE) {
			const page = await this.cachedQuery<operationsListBranchNamesQuery$data>(
				ListBranchNamesQuery,
				{
					fullPath: this.projectPath,
					searchPattern: "haiku/*/main",
					offset,
					limit: PAGE,
				},
				`gl:${this.host}:${this.projectPath}:listMainBranches:${offset}`,
			)
			const names = page?.project?.repository?.branchNames ?? []
			for (const name of names) {
				const parts = name.split("/")
				if (parts.length >= 2 && parts[parts.length - 1] === "main") {
					mainBranches.push(name)
				}
			}
			if (names.length < PAGE) break
		}

		// LEAN list-view load: NO per-stage-branch MR fan-out and NO per-stage
		// unit probes — those were the O(N) slowness. MR/PR status + per-stage
		// detail load lazily in the detail view. The list needs only:
		// title/studio/mode/status + branch + stage-dir-count over total stages.

		// Step 2: Load ALL intents from default branch — the canonical catalog
		const defaultIntents = await this.listIntentsFromRef(null)
		for (const intent of defaultIntents) {
			intentsBySlug.set(intent.slug, intent)
		}

		// Step 3: ONE raw aliased request reads intent.md + the stages-dir set
		// for EVERY main branch at once (chunked) — replacing the old O(3N)
		// per-branch readFile + MR fetch + per-stage unit probe. The active
		// stage + progress are derived from the stage-dir set (the lean
		// equivalent of the per-stage probe). Branch version overrides the
		// default-branch baseline (it's more current for active work).
		const mainSlugs = mainBranches
			.map((branchName) => {
				const parts = branchName.split("/")
				const slug = parts.slice(1, -1).join("/")
				return slug ? { slug, branch: branchName } : null
			})
			.filter((m): m is { slug: string; branch: string } => m !== null)

		const batch = await this.batchMainBranchData(mainSlugs)
		for (const { slug, branch } of mainSlugs) {
			const data = batch.get(slug)
			if (!data?.rawText) continue
			const intent = this.parseIntentFromRaw(slug, data.rawText, { branch })
			if (isV4Intent(intent.raw) && intent.studioStages.length > 0) {
				intent.activeStage = deriveActiveStageFromStageTree(
					intent.studioStages,
					new Set(data.stageDirs),
				)
				if (intent.status !== "completed") {
					const idx = intent.studioStages.indexOf(intent.activeStage)
					if (idx >= 0) intent.stagesComplete = idx
				}
			}
			intentsBySlug.set(slug, intent)
			this.intentBranchMap.set(slug, branch)
			this.intentMetaMap.set(slug, { branch })
		}

		const allIntents = Array.from(intentsBySlug.values())
		for (const intent of allIntents) onProgress?.(intent)
		return allIntents
	}

	/** Single-branch mode: read .haiku/intents/ from one specific branch. */
	private async listIntentsSingleBranch(
		onProgress?: (intent: HaikuIntent) => void,
	): Promise<HaikuIntent[]> {
		const intents = await this.listIntentsFromRef(this.ref)
		for (const intent of intents) {
			intent.branch = this.branch
			onProgress?.(intent)
		}
		return intents
	}

	/** Read intents from a specific ref (or default branch if null). */
	private async listIntentsFromRef(ref: string | null): Promise<HaikuIntent[]> {
		const treeCacheKey = `gl:${this.host}:${this.projectPath}:listIntentsTree:${ref || "HEAD"}`
		const treeData =
			await this.cachedQuery<operationsListIntentsTreeQuery$data>(
				ListIntentsTreeQuery,
				{ fullPath: this.projectPath, path: ".haiku/intents", ref },
				treeCacheKey,
			)

		const intentDirs = treeData?.project?.repository?.tree?.trees?.nodes
		if (!intentDirs || intentDirs.length === 0) return []

		const allPaths = intentDirs
			.filter((n): n is { name: string; path: string } => n != null)
			.map((n) => `${n.path}/intent.md`)

		const blobByPath = new Map<string, string>()

		for (let i = 0; i < allPaths.length; i += CHUNK_SIZE) {
			const chunk = allPaths.slice(i, i + CHUNK_SIZE)
			const blobsCacheKey = `gl:${this.host}:${this.projectPath}:listIntentsBlobs:${ref || "HEAD"}:${i}`
			try {
				const blobsData =
					await this.cachedQuery<operationsBatchBlobsQuery$data>(
						BatchBlobsQuery,
						{ fullPath: this.projectPath, paths: chunk, ref },
						blobsCacheKey,
					)
				const blobs = blobsData?.project?.repository?.blobs?.nodes ?? []
				for (const blob of blobs) {
					if (blob?.rawTextBlob && blob.path) {
						blobByPath.set(blob.path, blob.rawTextBlob)
					}
				}
			} catch {
				for (const path of chunk) {
					const raw = ref
						? await this.readFileFromRef(ref, path)
						: await this.readFile(path)
					if (raw) blobByPath.set(path, raw)
				}
			}
		}

		const intents: HaikuIntent[] = []

		for (const dir of intentDirs) {
			if (!dir) continue
			const slug = dir.name
			const rawText = blobByPath.get(`${dir.path}/intent.md`)
			if (!rawText) continue

			const intent = this.parseIntentFromRaw(slug, rawText)
			intents.push(intent)
		}

		return intents
	}

	// ── Three-level merge helpers ────────────────────────────────────────

	/** Data returned by fetchIntentTreeFromRef — all blobs, trees, and resolved assets for one ref. */
	private static readonly EMPTY_REF_DATA: GitLabIntentRefData = {
		blobByPath: new Map(),
		allBlobs: [],
		allTrees: [],
		assets: [],
	}

	/** Fetch the full intent tree + blob contents from a specific ref. Pass null for default branch. */
	private async fetchIntentTreeFromRef(
		slug: string,
		ref: string | null,
	): Promise<GitLabIntentRefData | null> {
		const basePath = `.haiku/intents/${slug}`
		const refLabel = ref || "HEAD"

		// Step 1: Recursive tree listing. Raw GraphQL (not the Relay artifact) on
		// purpose: GitLab's TreeEntry `id` is content-addressed (the blob SHA), so
		// two identical files at different paths (e.g. a DESIGN-BRIEF.md copied into
		// both `knowledge/` and `stages/design/`) return the SAME id with different
		// `path`. The Relay artifact auto-injects `id` for the Node-typed entries,
		// and the normalizer then warns "conflicting field ... same id" and lets one
		// path clobber the other. We only read `name`/`path` into plain objects (no
		// Relay store use), so request exactly those — no id, no normalization.
		const treeData = await this.rawGraphql<operationsIntentTreeQuery$data>(
			`query($fullPath: ID!, $path: String!, $ref: String) {
				project(fullPath: $fullPath) {
					repository {
						tree(path: $path, ref: $ref, recursive: true) {
							blobs(first: 500) { nodes { name path } }
							trees(first: 100) { nodes { name path } }
						}
					}
				}
			}`,
			{ fullPath: this.projectPath, path: basePath, ref },
		)

		const allBlobs = (
			treeData?.project?.repository?.tree?.blobs?.nodes ?? []
		).filter((b): b is { name: string; path: string } => b?.path != null)
		const allTrees = (
			treeData?.project?.repository?.tree?.trees?.nodes ?? []
		).filter((t): t is { name: string; path: string } => t?.path != null)

		if (allBlobs.length === 0 && allTrees.length === 0) return null

		// Step 2: Batch-fetch blob contents
		const filePaths = allBlobs.map((b) => b.path)
		const blobByPath = new Map<string, string>()
		const assets: Array<{ path: string; name: string; rawUrl: string }> = []

		for (let i = 0; i < filePaths.length; i += CHUNK_SIZE) {
			const chunk = filePaths.slice(i, i + CHUNK_SIZE)
			const blobsCacheKey = `gl:${this.host}:${this.projectPath}:intentBlobs:${slug}:${refLabel}:${i}`
			try {
				const blobsData =
					await this.cachedQuery<operationsBatchBlobsQuery$data>(
						BatchBlobsQuery,
						{ fullPath: this.projectPath, paths: chunk, ref },
						blobsCacheKey,
					)
				for (const blob of blobsData?.project?.repository?.blobs?.nodes ?? []) {
					if (!blob?.path) continue
					if (blob.rawTextBlob != null) {
						blobByPath.set(blob.path, blob.rawTextBlob)
					} else {
						// Binary file — REST API for CORS-compatible authenticated download
						const encodedFilePath = encodeURIComponent(blob.path)
						const rawUrl = `https://${this.host}/api/v4/projects/${this.encodedProject}/repository/files/${encodedFilePath}/raw?ref=${encodeURIComponent(ref || "HEAD")}`
						assets.push({
							path: blob.path,
							name: blob.name || blob.path.split("/").pop() || "",
							rawUrl,
						})
					}
				}
			} catch {
				for (const path of chunk) {
					const raw = ref
						? await this.readFileFromRef(ref, path)
						: await this.readFile(path)
					if (raw) blobByPath.set(path, raw)
				}
			}
		}

		return { blobByPath, allBlobs, allTrees, assets }
	}

	/** Parse a single stage from fetched blob data. Returns null if the stage has no content.
	 *
	 *  `intentMode` is the value from intent.md (`continuous` /
	 *  `discrete` / `discrete-hybrid` / `autopilot`). Threaded through
	 *  to the derivation so autopilot intents skip the elaborate-verifier
	 *  signals — same shape the cursor uses. */
	private parseStageFromBlobs(
		slug: string,
		stageName: string,
		data: GitLabIntentRefData,
		activeStage: string,
		stageNames: string[],
		ref: string,
		intentMode: string,
		schemaIsV4: boolean,
	): HaikuStageState | null {
		const basePath = `.haiku/intents/${slug}`
		const stagePath = `${basePath}/stages/${stageName}`

		// Check if this stage has any blobs at all
		const hasStageContent = data.allBlobs.some((b) =>
			b.path.startsWith(`${stagePath}/`),
		)
		if (!hasStageContent) return null

		// Parse units
		const units: HaikuUnit[] = []
		const unitPrefix = `${stagePath}/units/`
		for (const blob of data.allBlobs) {
			if (!blob.path.startsWith(unitPrefix)) continue
			const fileName = blob.path.slice(unitPrefix.length)
			if (fileName.includes("/") || !fileName.endsWith(".md")) continue
			const unitRaw = data.blobByPath.get(blob.path)
			if (!unitRaw) continue
			units.push(
				parseUnit(fileName, stageName, unitRaw, {
					provider: "gitlab",
					path: blob.path,
					slug,
					branch: ref,
				}),
			)
		}

		// Parse artifacts: surface every file under the stage dir that isn't a
		// structured entry (units/feedback/state.json/brief/observations) or
		// engine bookkeeping — `artifacts/**`, `proof/**` (runtime-verifier
		// screenshots), and strays. The artifact `name` is the stage-relative
		// path so provenance (`proof/`, `artifacts/`) stays visible. Binary
		// blobs aren't in `blobByPath` (text only) → build a raw download URL.
		const artifacts: HaikuArtifact[] = []
		const stagePrefix = `${stagePath}/`
		for (const blob of data.allBlobs) {
			if (!blob.path.startsWith(stagePrefix)) continue
			const rel = blob.path.slice(stagePrefix.length)
			if (!isCollectibleStageFile(rel)) continue
			const artType = classifyArtifact(rel)
			const textContent = data.blobByPath.get(blob.path)
			if (textContent != null) {
				artifacts.push({ name: rel, content: textContent, type: artType })
			} else {
				const encodedFilePath = encodeURIComponent(blob.path)
				const rawUrl = `https://${this.host}/api/v4/projects/${this.encodedProject}/repository/files/${encodedFilePath}/raw?ref=${encodeURIComponent(ref)}`
				artifacts.push({ name: rel, rawUrl, type: artType })
			}
		}

		// Feedback files (stages/<stage>/feedback/*.md).
		const feedback: HaikuFeedback[] = []
		const feedbackPrefix = `${stagePath}/feedback/`
		for (const blob of data.allBlobs) {
			if (!blob.path.startsWith(feedbackPrefix)) continue
			const fileName = blob.path.slice(feedbackPrefix.length)
			if (fileName.includes("/") || !fileName.endsWith(".md")) continue
			const raw = data.blobByPath.get(blob.path)
			if (!raw) continue
			feedback.push(
				parseFeedback("gitlab", slug, stageName, fileName, raw, blob.path),
			)
		}

		// state.json — shared parsing keeps gitlab + github in sync.
		// v4 intents have no state.json (deleted by the migrator); the
		// dual-path falls through to per-unit derivation.
		const stateBlob = data.blobByPath.get(`${stagePath}/state.json`)
		const {
			phase: v3Phase,
			startedAt,
			completedAt,
			gateOutcome,
			stateStatus,
		} = parseStageStateJson(stateBlob)

		// elaboration.md verification — load the file's frontmatter so the
		// derivation can tell whether the elaborate gate has cleared. v4
		// stamps `verified_at` on the file when the verify-conversation
		// hat signs off; without that the cursor reports phase
		// `elaborate`. Pass `null` (grandfather) when the file is absent.
		const elaborationBlob = data.blobByPath.get(`${stagePath}/elaboration.md`)
		const elaborationVerified = parseElaborationVerified(elaborationBlob)

		// Status + phase resolution priority:
		//   1. v3 state.json.status (authoritative when present)
		//   2. v4 derived from per-unit iterations[] + approvals + mode +
		//      elaboration verification, via the shared pure helper.
		//   3. v3 active_stage / stage-order fallback
		let status: "pending" | "active" | "complete" = "pending"
		let phase: HaikuStageState["phase"] = v3Phase
		let milestones: HaikuStageState["milestones"]
		if (stateStatus === "active") status = "active"
		else if (stateStatus === "completed") status = "complete"
		else if (units.length > 0 || stateBlob == null) {
			const derived = deriveStageStateFromUnits(units, {
				stage: stageName,
				intentMode,
				elaborationVerified,
				schemaIsV4,
			})
			status = derived.status
			phase = derived.phase
			milestones = derived.milestones
		} else if (stageName === activeStage) status = "active"
		else if (stageNames.indexOf(stageName) < stageNames.indexOf(activeStage))
			status = "complete"

		// Per-stage user-facing BRIEF + agent OBSERVATIONS.
		const briefText = data.blobByPath.get(`${stagePath}/BRIEF.md`)
		const observationsText = data.blobByPath.get(`${stagePath}/observations.md`)

		return {
			name: stageName,
			status,
			phase,
			milestones,
			startedAt,
			completedAt,
			gateOutcome,
			units,
			artifacts: artifacts.length > 0 ? artifacts : undefined,
			feedback: feedback.length > 0 ? feedback : undefined,
			brief: briefText?.trim() || null,
			observations: observationsText?.trim() || null,
		}
	}

	/** Extract intent-scope feedback files (`.haiku/intents/<slug>/feedback/`). */
	private parseIntentFeedbackFromBlobs(
		slug: string,
		data: GitLabIntentRefData,
	): HaikuFeedback[] {
		const prefix = `.haiku/intents/${slug}/feedback/`
		const out: HaikuFeedback[] = []
		for (const blob of data.allBlobs) {
			if (!blob.path.startsWith(prefix)) continue
			const fileName = blob.path.slice(prefix.length)
			if (fileName.includes("/") || !fileName.endsWith(".md")) continue
			const raw = data.blobByPath.get(blob.path)
			if (!raw) continue
			out.push(parseFeedback("gitlab", slug, null, fileName, raw, blob.path))
		}
		return out
	}

	/** Extract knowledge files from fetched blob data. */
	private parseKnowledgeFromBlobs(
		slug: string,
		data: GitLabIntentRefData,
	): HaikuKnowledgeFile[] {
		const knowledgePrefix = `.haiku/intents/${slug}/knowledge/`
		return data.allBlobs
			.filter(
				(b) =>
					b.path.startsWith(knowledgePrefix) &&
					!b.path.slice(knowledgePrefix.length).includes("/") &&
					b.name.endsWith(".md"),
			)
			.map((b) => ({
				name: b.name,
				content: data.blobByPath.get(b.path) || "",
			}))
	}

	/** Extract operations files from fetched blob data. */
	private parseOperationsFromBlobs(
		slug: string,
		data: GitLabIntentRefData,
	): HaikuKnowledgeFile[] {
		const operationsPrefix = `.haiku/intents/${slug}/operations/`
		return data.allBlobs
			.filter(
				(b) =>
					b.path.startsWith(operationsPrefix) &&
					!b.path.slice(operationsPrefix.length).includes("/") &&
					b.name.endsWith(".md"),
			)
			.map((b) => ({
				name: b.name,
				content: data.blobByPath.get(b.path) || "",
			}))
	}

	/** Merge knowledge files — overlay wins on filename collision.
	 *  Thin shim over the shared cross-provider helper. */
	private mergeKnowledge(
		base: HaikuKnowledgeFile[],
		overlay: HaikuKnowledgeFile[],
	): HaikuKnowledgeFile[] {
		return mergeKnowledgeShared(base, overlay)
	}

	/** Derive ordered stage dir names from tree listing. */
	private deriveStageDirNames(
		slug: string,
		data: GitLabIntentRefData,
	): string[] {
		const stagesPrefix = `.haiku/intents/${slug}/stages/`
		return data.allTrees
			.filter(
				(t) =>
					t.path.startsWith(stagesPrefix) &&
					!t.path.slice(stagesPrefix.length).includes("/"),
			)
			.map((t) => t.name)
			.sort()
	}

	/** Deep-link probe: discover intent branch + stage branches when maps aren't populated. */
	private async probeIntentBranch(slug: string): Promise<string | undefined> {
		const branchName = `haiku/${slug}/main`
		const testRead = await this.readFileFromRef(
			branchName,
			`.haiku/intents/${slug}/intent.md`,
		)
		if (!testRead) return undefined

		this.intentBranchMap.set(slug, branchName)

		// Discover stage branches and MR metadata
		try {
			const branchesCacheKey = `gl:${this.host}:${this.projectPath}:listHaikuBranches:${slug}`
			const branchesData =
				await this.cachedQuery<operationsListBranchNamesQuery$data>(
					ListBranchNamesQuery,
					{
						fullPath: this.projectPath,
						searchPattern: `haiku/${slug}/*`,
						offset: 0,
						limit: 100,
					},
					branchesCacheKey,
				)

			const branchNames = branchesData?.project?.repository?.branchNames ?? []

			// Fetch MR data for intent branch
			const intentMr = await this.fetchMrForBranch(branchName)
			this.intentMetaMap.set(slug, { branch: branchName, ...intentMr })

			// Discover stage branches (non-main) — fetch MR data in parallel
			const stageBranchEntries = branchNames
				.map((name: string) => {
					const parts = name.split("/")
					if (
						parts.length < 3 ||
						parts[0] !== "haiku" ||
						parts[parts.length - 1] === "main"
					)
						return null
					const stageSlug = parts.slice(1, -1).join("/")
					if (stageSlug !== slug) return null
					return { name, stageName: parts[parts.length - 1] }
				})
				.filter(Boolean) as Array<{ name: string; stageName: string }>

			await Promise.all(
				stageBranchEntries.map(async ({ name, stageName }) => {
					const stageMr = await this.fetchMrForBranch(name)
					this.stageBranchMap.set(`${slug}/${stageName}`, {
						branch: name,
						...stageMr,
					})
				}),
			)
		} catch {
			this.intentMetaMap.set(slug, {
				branch: branchName,
				prUrl: null,
				prStatus: null,
				prNumber: null,
			})
		}

		return branchName
	}

	// ── getIntent: three-level trust merge ───────────────────────────────

	/**
	 * Get full intent detail by merging data from three trust levels:
	 *
	 * 1. Default branch (baseline — all intents including completed/archived)
	 * 2. Intent branch `haiku/{slug}/main` (overrides for active intent)
	 * 3. Stage branches `haiku/{slug}/{stage}` (highest trust, scoped to own stage + knowledge)
	 *
	 * In single-branch mode (explicit `this.branch`), skips the merge and reads from that branch only.
	 */
	async getIntent(slug: string): Promise<HaikuIntentDetail | null> {
		// Single-branch mode: explicit branch — no merge needed
		if (this.branch) {
			return this.getIntentSingleRef(slug)
		}

		let intentBranch = this.intentBranchMap.get(slug)

		// Deep-link resolution: probe for branch + MR data if maps aren't populated yet
		if (!intentBranch) {
			intentBranch = await this.probeIntentBranch(slug)
		}

		// Collect stage branches for this slug
		const stageBranches = new Map<
			string,
			{
				branch: string
				prUrl?: string | null
				prStatus?: string | null
				prNumber?: number | null
			}
		>()
		for (const [key, meta] of this.stageBranchMap) {
			if (key.startsWith(`${slug}/`)) {
				stageBranches.set(key.slice(slug.length + 1), meta)
			}
		}

		// Fetch all trust levels in parallel
		const stageBranchPromises = new Map<
			string,
			Promise<GitLabIntentRefData | null>
		>()
		for (const [stageName, meta] of stageBranches) {
			stageBranchPromises.set(
				stageName,
				this.fetchIntentTreeFromRef(slug, meta.branch),
			)
		}

		const [defaultData, intentData] = await Promise.all([
			this.fetchIntentTreeFromRef(slug, null),
			intentBranch ? this.fetchIntentTreeFromRef(slug, intentBranch) : null,
		])

		// Resolve stage branch fetches (they ran in parallel with the above)
		const stageBranchData = new Map<string, GitLabIntentRefData | null>()
		for (const [stageName, promise] of stageBranchPromises) {
			stageBranchData.set(stageName, await promise)
		}

		// intent.md: intent branch wins, fallback to default
		const basePath = `.haiku/intents/${slug}`
		const intentRaw =
			intentData?.blobByPath.get(`${basePath}/intent.md`) ??
			defaultData?.blobByPath.get(`${basePath}/intent.md`)
		if (!intentRaw) return null

		const { data: frontmatter, content } = parseFrontmatter(intentRaw, {
			provider: "gitlab",
			path: `${basePath}/intent.md`,
			slug,
			branch: intentBranch ?? undefined,
		})
		const studio = (frontmatter.studio as string) || "ideation"
		const stageNames = (frontmatter.stages as string[]) || []
		const activeStage = (frontmatter.active_stage as string) || ""
		const intentMode = (frontmatter.mode as string) || "continuous"
		const schemaIsV4 = isV4Intent(frontmatter)

		// Determine ordered stage list from frontmatter or directory listing
		const fallbackDirNames = this.deriveStageDirNames(
			slug,
			intentData ?? defaultData ?? GitLabProvider.EMPTY_REF_DATA,
		)
		const orderedStages = stageNames.length > 0 ? stageNames : fallbackDirNames

		// Build stages with three-level merge:
		// default ← intent branch ← stage branch (scoped to own stage only)
		const stages: HaikuStageState[] = []
		for (const stageName of orderedStages) {
			const stageBranchRef = stageBranches.get(stageName)
			const stageBranchResult = stageBranchData.get(stageName)

			// Try each trust level, highest first
			let parsed: HaikuStageState | null = null

			// Level 3: Stage branch (highest trust for its own stage).
			// stageBranchResult is only populated from stageBranchPromises, which is
			// derived from the same stageBranches map — so if stageBranchResult is
			// non-null, stageBranchRef is too. Guard explicitly instead of asserting
			// so the invariant stays visible if either map source ever widens.
			if (stageBranchResult && stageBranchRef) {
				parsed = this.parseStageFromBlobs(
					slug,
					stageName,
					stageBranchResult,
					activeStage,
					stageNames,
					stageBranchRef.branch,
					intentMode,
					schemaIsV4,
				)
			}

			// Level 2: Intent branch. intentBranch is non-null here because
			// intentData being non-null implies we successfully fetched from it.
			if (!parsed && intentData && intentBranch) {
				parsed = this.parseStageFromBlobs(
					slug,
					stageName,
					intentData,
					activeStage,
					stageNames,
					intentBranch,
					intentMode,
					schemaIsV4,
				)
			}

			// Level 1: Default branch (baseline)
			if (!parsed && defaultData) {
				parsed = this.parseStageFromBlobs(
					slug,
					stageName,
					defaultData,
					activeStage,
					stageNames,
					"HEAD",
					intentMode,
					schemaIsV4,
				)
			}

			if (!parsed) {
				// Stage declared in frontmatter but not found on any branch
				parsed = {
					name: stageName,
					status: "pending",
					phase: "",
					startedAt: null,
					completedAt: null,
					gateOutcome: null,
					units: [],
				}
			}

			// Attach stage branch/MR metadata
			const meta = stageBranches.get(stageName)
			stages.push({
				...parsed,
				branch: meta?.branch,
				prUrl: meta?.prUrl ?? null,
				prStatus: meta?.prStatus ?? null,
				prNumber: meta?.prNumber ?? null,
			})
		}

		// Refine the active stage from the cursor's "first non-completed
		// stage" rule, mirroring the engine's getCurrentState walk. v4
		// dropped intent.md.active_stage, so trusting the frontmatter
		// here would always read empty — we'd fall back to the wrong
		// stage in the UI. The per-stage status above is already derived
		// from the stage-branch trust source.
		const stageStatusByName: Record<string, "pending" | "active" | "complete"> =
			{}
		for (const s of stages) stageStatusByName[s.name] = s.status
		// Monotonic pipeline invariant: a later complete stage back-fills
		// earlier ones, so the dots can't show an earlier stage active while a
		// later is complete (see normalizeStageProgression).
		const normalizedStatus = normalizeStageProgression(
			orderedStages,
			stageStatusByName,
		)
		for (const s of stages) s.status = normalizedStatus[s.name] ?? s.status
		const refinedActiveStage =
			deriveV4ActiveStage(orderedStages, normalizedStatus) || activeStage

		// Re-parse intent.md off the current stage's branch when one is
		// present. Engine invariant: every commit during a stage's work
		// lands on that stage's branch first, including any intent.md
		// edits (intent-completion approvals, sealed_at, etc.). Reading
		// the most volatile fields off the active stage's branch keeps
		// the UI in sync with what the cursor sees on its next tick.
		const currentStageIntentRaw = stageBranchData
			.get(refinedActiveStage)
			?.blobByPath.get(`${basePath}/intent.md`)
		const currentStageFrontmatter = currentStageIntentRaw
			? parseFrontmatter(currentStageIntentRaw, {
					provider: "gitlab",
					path: `${basePath}/intent.md`,
					slug,
					branch: stageBranches.get(refinedActiveStage)?.branch,
				}).data
			: frontmatter

		// Knowledge: merge from all levels (each can contribute)
		let knowledge = defaultData
			? this.parseKnowledgeFromBlobs(slug, defaultData)
			: []
		if (intentData) {
			knowledge = this.mergeKnowledge(
				knowledge,
				this.parseKnowledgeFromBlobs(slug, intentData),
			)
		}
		for (const [, data] of stageBranchData) {
			if (data)
				knowledge = this.mergeKnowledge(
					knowledge,
					this.parseKnowledgeFromBlobs(slug, data),
				)
		}

		// Operations: intent branch wins, fallback to default (stage branches cannot touch)
		const opsSource = intentData ?? defaultData
		const operations = opsSource
			? this.parseOperationsFromBlobs(slug, opsSource)
			: []

		// Reflection: intent branch wins (stage branches cannot touch)
		const reflection =
			intentData?.blobByPath.get(`${basePath}/reflection.md`) ??
			defaultData?.blobByPath.get(`${basePath}/reflection.md`) ??
			null

		// Assets: merge from all levels, de-duplicating by path (higher trust wins)
		const assetsByPath = new Map<
			string,
			{ path: string; name: string; rawUrl: string }
		>()
		for (const a of defaultData?.assets ?? []) assetsByPath.set(a.path, a)
		for (const a of intentData?.assets ?? []) assetsByPath.set(a.path, a)
		for (const d of stageBranchData.values()) {
			for (const a of d?.assets ?? []) assetsByPath.set(a.path, a)
		}
		const assets = Array.from(assetsByPath.values())

		// Intent-scope feedback — prefer intent branch overlay over default.
		const intentFeedback = intentData
			? this.parseIntentFeedbackFromBlobs(slug, intentData)
			: this.parseIntentFeedbackFromBlobs(
					slug,
					defaultData ?? GitLabProvider.EMPTY_REF_DATA,
				)

		// Volatile fields read off the current stage's branch (cursor's
		// trust source); structural fields (studio, stages list, mode,
		// created_at) come from the intent-branch parse since they're
		// stable post-setup.
		return {
			slug,
			title:
				(currentStageFrontmatter.title as string) ||
				(frontmatter.title as string) ||
				slug,
			studio,
			activeStage: refinedActiveStage,
			mode: (frontmatter.mode as string) || "continuous",
			createdAt:
				(frontmatter.created_at as string) ||
				(frontmatter.created as string) ||
				null,
			startedAt: (frontmatter.started_at as string) || null,
			completedAt:
				(currentStageFrontmatter.completed_at as string) ||
				(frontmatter.completed_at as string) ||
				null,
			studioStages: (frontmatter.stages as string[]) || [],
			composite:
				(frontmatter.composite as Array<{
					studio: string
					stages: string[]
				}>) || null,
			...normalizeIntentStatus(
				(currentStageFrontmatter.status as string) ||
					(frontmatter.status as string) ||
					"active",
				(currentStageFrontmatter.completed_at as string) ||
					(frontmatter.completed_at as string) ||
					null,
				stageNames.indexOf(refinedActiveStage),
				stageNames.length,
			),
			stagesTotal: stageNames.length,
			archived: frontmatter.archived === true,
			follows: (frontmatter.follows as string) || null,
			// Stable structural fields (plugin_version, granularity,
			// composite, etc.) live on the intent-branch parse and may
			// pre-date the stage branch; volatile fields (approvals,
			// sealed_at, completed_at, title) ride the stage branch.
			// Merge with intent-branch as the base so a stage-branched
			// intent.md that's missing a never-edited structural field
			// doesn't drop it. Per claude-bot review on PR #363.
			raw: { ...frontmatter, ...currentStageFrontmatter },
			stages,
			knowledge,
			operations,
			reflection,
			content,
			assets,
			intentFeedback,
			intentApprovals: parseIntentApprovals(currentStageFrontmatter),
			...(this.intentMetaMap.get(slug) || {}),
		}
	}

	/** Single-ref fallback for explicit branch mode (no three-level merge). */
	private async getIntentSingleRef(
		slug: string,
	): Promise<HaikuIntentDetail | null> {
		const data = await this.fetchIntentTreeFromRef(slug, this.ref)
		if (!data) return null

		const basePath = `.haiku/intents/${slug}`
		const rawText = data.blobByPath.get(`${basePath}/intent.md`)
		if (!rawText) return null

		const { data: frontmatter, content } = parseFrontmatter(rawText, {
			provider: "gitlab",
			path: `${basePath}/intent.md`,
			slug,
			branch: this.ref ?? undefined,
		})
		const studio = (frontmatter.studio as string) || "ideation"
		const stageNames = (frontmatter.stages as string[]) || []
		const activeStage = (frontmatter.active_stage as string) || ""
		const intentMode = (frontmatter.mode as string) || "continuous"
		const schemaIsV4 = isV4Intent(frontmatter)
		const ref = this.branch || "HEAD"

		const fallbackDirNames = this.deriveStageDirNames(slug, data)

		const orderedStages = stageNames.length > 0 ? stageNames : fallbackDirNames
		const stages: HaikuStageState[] = []
		for (const stageName of orderedStages) {
			const parsed = this.parseStageFromBlobs(
				slug,
				stageName,
				data,
				activeStage,
				stageNames,
				ref,
				intentMode,
				schemaIsV4,
			)
			if (parsed) stages.push(parsed)
		}

		// Cursor walk: pick the active stage from the per-stage status
		// we just derived, mirroring engine getCurrentState.
		const stageStatusByName: Record<string, "pending" | "active" | "complete"> =
			{}
		for (const s of stages) stageStatusByName[s.name] = s.status
		// Monotonic pipeline invariant: a later complete stage back-fills
		// earlier ones, so the dots can't show an earlier stage active while a
		// later is complete (see normalizeStageProgression).
		const normalizedStatus = normalizeStageProgression(
			orderedStages,
			stageStatusByName,
		)
		for (const s of stages) s.status = normalizedStatus[s.name] ?? s.status
		const refinedActiveStage =
			deriveV4ActiveStage(orderedStages, normalizedStatus) || activeStage

		const knowledge = this.parseKnowledgeFromBlobs(slug, data)
		const operations = this.parseOperationsFromBlobs(slug, data)
		const reflection = data.blobByPath.get(`${basePath}/reflection.md`) ?? null
		const intentFeedback = this.parseIntentFeedbackFromBlobs(slug, data)

		return {
			slug,
			title: (frontmatter.title as string) || slug,
			studio,
			activeStage: refinedActiveStage,
			mode: (frontmatter.mode as string) || "continuous",
			createdAt:
				(frontmatter.created_at as string) ||
				(frontmatter.created as string) ||
				null,
			startedAt: (frontmatter.started_at as string) || null,
			completedAt: (frontmatter.completed_at as string) || null,
			studioStages: (frontmatter.stages as string[]) || [],
			composite:
				(frontmatter.composite as Array<{
					studio: string
					stages: string[]
				}>) || null,
			...normalizeIntentStatus(
				(frontmatter.status as string) || "active",
				(frontmatter.completed_at as string) || null,
				stageNames.indexOf(refinedActiveStage),
				stageNames.length,
			),
			stagesTotal: stageNames.length,
			archived: frontmatter.archived === true,
			follows: (frontmatter.follows as string) || null,
			raw: frontmatter,
			stages,
			knowledge,
			operations,
			reflection,
			content,
			assets: data.assets,
			intentFeedback,
			intentApprovals: parseIntentApprovals(frontmatter),
			branch: this.branch,
		}
	}

	async getSettings(): Promise<Record<string, unknown> | null> {
		const raw = await this.readFile(".haiku/settings.yml")
		if (!raw) return null
		return parseSettingsYaml(raw)
	}

	/** Write a file via REST API (mutations stay REST -- they're rare). */
	async writeFile(
		path: string,
		content: string,
		message: string,
	): Promise<boolean> {
		const encodedPath = encodeURIComponent(path)
		const branch = this.branch || "main"

		// Base64 encode content (handle Unicode correctly)
		const encoded = btoa(
			Array.from(new TextEncoder().encode(content))
				.map((b) => String.fromCharCode(b))
				.join(""),
		)

		// Try update first (PUT), fall back to create (POST) if file doesn't exist
		const res = await this.restApi(`/repository/files/${encodedPath}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				branch,
				commit_message: message,
				encoding: "base64",
				content: encoded,
			}),
		})

		if (res.ok) return true

		// If file doesn't exist yet, create it
		if (res.status === 400 || res.status === 404) {
			const createRes = await this.restApi(`/repository/files/${encodedPath}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					branch,
					commit_message: message,
					encoding: "base64",
					content: encoded,
				}),
			})
			return createRes.ok
		}

		return false
	}

	/** Check if haiku branches have changed since last poll using ETags. Returns true if changed. */
	async checkForBranchChanges(): Promise<boolean> {
		// Only useful in scan mode (no explicit branch)
		if (this.branch) return false

		const headers = new Headers(this.restHeaders())
		if (this.lastBranchesEtag) {
			headers.set("If-None-Match", this.lastBranchesEtag)
		}

		const res = await fetch(
			`https://${this.host}/api/v4/projects/${this.encodedProject}/repository/branches?search=haiku/`,
			{ headers },
		)

		if (res.status === 304) return false // Not modified

		const etag = res.headers.get("etag")
		if (etag) this.lastBranchesEtag = etag

		return res.ok // true = changed, re-fetch needed
	}

	/** Clear cached branch and intent data so the next fetch gets fresh results. */
	clearBranchCache(): void {
		for (const key of glCache.keys()) {
			if (
				key.includes("listHaikuBranches") ||
				key.includes("listIntents") ||
				key.includes("getIntent") ||
				key.includes("intentTree") ||
				key.includes("intentBlobs")
			) {
				glCache.delete(key)
			}
		}
		this.intentBranchMap.clear()
		this.stageBranchMap.clear()
		this.intentMetaMap.clear()
	}

	async isAccessible(): Promise<boolean> {
		const res = await this.restApi("")
		return res.ok
	}

	static getOAuthUrl(
		host: string,
		clientId: string,
		redirectUri: string,
	): string {
		// Scope: `api` — full access to the GitLab API.
		// Required because the browse UI:
		//   - Reads `.haiku/intents/` contents
		//   - Reads branches and merge requests (including closed/merged)
		return `https://${host}/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=api`
	}
}
