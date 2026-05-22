/** Role-classification constants shared across workflow engine + prompt builders.
 *  Kept as a thin barrel so consumers in `workflow/` can import without
 *  pulling in the full prompt-builder graph. */
export { PR_INTERACTION_ROLES, RUNTIME_OBSERVATION_ROLES } from "./prompts/_shared/index.js"
