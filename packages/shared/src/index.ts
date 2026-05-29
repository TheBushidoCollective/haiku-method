// Types

// Components (re-exported for convenience — also available via @haiku/shared/components)
export {
	CriteriaChecklist,
	FileTree,
	MarkdownViewer,
	ProgressBar,
	StatusBadge,
} from "./components/index"
export type {
	DerivedGateOutcome,
	DerivedStagePhase,
	DerivedStageState,
	DerivedStageStateInputs,
	DerivedStageStatus,
	DerivedUnitView,
} from "./derived-stage-state"
// v4 derived stage state — single-source-of-truth derivation shared
// between the MCP engine and the website browse UI.
export { deriveStageStatePure } from "./derived-stage-state"
// Formatting utilities
export {
	formatDate,
	formatDuration,
	formatDurationMs,
	titleCase,
} from "./format"
// Frontmatter YAML utilities (duplicate-key recovery)
export {
	dedupeFrontmatterKeys,
	dedupeTopLevelYamlKeys,
	isDuplicateKeyError,
} from "./frontmatter"
// Granular per-stage progress milestone track — shared order/labels/
// finalize so the engine status line and the browse UI can't drift.
export type {
	MilestoneRoleFlag,
	ProgressStep,
	StageMilestoneInputs,
	StepStatus,
} from "./progress-milestones"
export {
	approvalMilestoneLabel,
	buildStageMilestones,
	finalizeSteps,
	milestonePipStatus,
	resolveActiveMilestoneIndex,
	reviewMilestoneLabel,
} from "./progress-milestones"
export type {
	CriterionItem,
	HaikuArtifact,
	HaikuAsset,
	HaikuFeedback,
	HaikuIntent,
	HaikuIntentDetail,
	HaikuKnowledgeFile,
	HaikuStageState,
	HaikuUnit,
	MockupInfo,
} from "./types"
