## Loop Halted (`loop: <%= loop %>`)

The H·AI·K·U engine detected an inter-tick loop on intent `<%= intent %>` and refused to return the same action again.

<%~ message %>

### Critical: do NOT auto-recover

This is an **architectural halt**, not a transient error. The engine has decided that re-running `haiku_run_next` immediately would burn another tick without progress. The wedge is downstream of the cursor — a fix-hat that doesn't change disk, a verifier that won't sign, a witness that won't refresh.

You **MUST**:

1. **Stop re-ticking.** Calling `haiku_run_next` again right now will surface the same halt. The loop counter only resets when a different action becomes possible — that requires the underlying state to change.
2. **Surface this halt to the user.** Show them this message verbatim. Do not paraphrase or hide it.
3. **Help them diagnose.** Read the action signature in the message above. It names the action kind and the target (stage / unit / feedback / role). Whatever the engine was trying to do for that target, that's what's wedged.
4. **Help them choose a recovery path:**
   - If a missing artifact is the cause: commit it. The next tick will see new state and the halt will lift.
   - If a verifier or fix-hat won't sign: re-dispatch it manually, or skip via `/haiku:repair`.
   - If the cursor itself is wrong: file a feedback explaining what should have happened, and let the engine route through the fix loop.
5. **Only after the user has acted** should you call `haiku_run_next` again. The signature must be different for the halt to lift; if it isn't, the halt fires again immediately.
