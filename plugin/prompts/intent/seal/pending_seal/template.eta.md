# Intent `<%= slug %>` — pending seal

Every stage on **<%= slug %>** is built, every required approval is signed, and the reflection is recorded. The work is delivered to the change request on `<%= intentMain %>`.

It is **not sealed yet.** An intent only seals once its work has landed on `<%= defaultBranch %>`. Right now `<%= intentMain %>` is still ahead of `<%= defaultBranch %>` — the change request hasn't merged.

## What to do

Tell the user the intent is ready to merge<% if (prUrl) { %> — the delivery change request is <%= prUrl %><% } %>. The engine will **not** merge it for you; merging into `<%= defaultBranch %>` is the user's call (or the host's branch-protection automation).

Nothing further is required from you on this tick. The intent seals automatically the next time the engine runs after `<%= intentMain %>` lands on `<%= defaultBranch %>` — a local merge or a merged change request both count.

The engine already merged the latest `<%= defaultBranch %>` into `<%= intentMain %>` before this tick (it keeps the branch current with its target every tick), so the change request stays mergeable. If that merge surfaced a genuine conflict, you'll have gotten a `pre_cursor_sync_conflict` instead of this message — resolve it and re-tick, then you'll land back here.

When the user comes back later with `/haiku:haiku-pickup`, the engine re-syncs the branch and re-audits the open change request: any open feedback is addressed, and new review comments on the change request become fresh feedback items to resolve before it seals.
