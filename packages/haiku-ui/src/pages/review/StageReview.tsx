/**
 * StageReview re-export shim — the real implementation lives at
 * `./stage/StageReview.tsx` (split into the per-stage subdir during the
 * FB-22 module-budget refactor).
 *
 * Unit-12 declared its output path as `packages/haiku-ui/src/pages/review/StageReview.tsx`
 * before the file location was rebased. Rather than churn the unit
 * frontmatter (immutable once active per architecture §1.3), this shim
 * keeps the declared path resolvable while the real module continues to
 * live in its canonical home. Importers should target `./stage/StageReview`
 * directly; this file exists for output-tracking continuity only.
 */

export type { StageReviewProps } from "./stage/StageReview"
export { StageReview } from "./stage/StageReview"
