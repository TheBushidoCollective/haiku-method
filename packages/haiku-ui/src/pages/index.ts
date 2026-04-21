/**
 * Barrel re-export for the four per-page modules consumed by the shell.
 * One folder per page-type; each module owns its own fetch + hook lifecycle
 * and dispatches to the presentational component in `src/components/`.
 */

export { DirectionPageModule } from "./direction"
export { QuestionPageModule } from "./question"
export { ReviewPageModule } from "./review"
export { ReviewCurrentPageModule } from "./review-current"
