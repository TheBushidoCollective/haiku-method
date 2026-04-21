/**
 * Wire-type re-export barrel.
 *
 * All HTTP/WebSocket payloads this SPA touches live in `haiku-api`. This file
 * is the single import surface for components and hooks. There are zero local
 * type definitions here — that invariant is enforced by unit-03's completion
 * criteria (grep for `^export (type|interface)` returns zero).
 *
 * Parser-shaped types (ParsedUnit, ParsedIntent, Section, *Frontmatter) live
 * in `./parsed.ts`; they describe internal parsed-markdown shapes the backend
 * emits and the SPA reads, and are deliberately loose on the wire (see
 * `haiku-api` session schemas — `LooseRecord`).
 */

export type {
	DesignArchetypeData,
	DesignParameterData,
	FeedbackItem as FeedbackItemData,
	FeedbackListResponse,
	KnowledgeFile,
	OutputArtifact,
	PreviousReviewSnapshot,
	QuestionAnswer,
	QuestionDef,
	ReviewAnnotations,
	ReviewCurrentPayload as ReviewCurrentResponse,
	SessionPayload as SessionData,
	StageArtifact,
	StageStateInfo,
} from "haiku-api"
export type { CriterionItem, MockupInfo } from "@haiku/shared"
