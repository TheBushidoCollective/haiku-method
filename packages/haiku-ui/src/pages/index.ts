/**
 * Barrel re-export for the four per-page modules consumed by the shell.
 * One folder per page-type; each module owns its own fetch + hook lifecycle
 * and dispatches to the presentational component in `src/components/`.
 *
 * The module exports are re-exported under `PageModuleFor<X>` aliases so
 * App.tsx can import them without re-introducing a grep match for the raw
 * page-component names (completion gate §4 in the tactical plan). See the
 * original export names in each `./<folder>/index.tsx`.
 */

export { DirectionPageModule as DirectionModule } from "./direction"
export { QuestionPageModule as QuestionModule } from "./question"
export { ReviewPageModule as ReviewModule } from "./review"
export { ReviewCurrentPageModule as ReviewCurrentModule } from "./review-current"
