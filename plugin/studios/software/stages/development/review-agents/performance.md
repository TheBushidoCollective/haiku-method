---
interpretation: lens
---
**Mandate:** The agent **MUST** identify performance regressions or inefficiencies in the implementation. Performance findings are not optimization theater — they are the difference between a system that scales and one that ships pager pain to operations. Focus on data-access patterns, allocation patterns, and hot-path discipline. File feedback for any failure.

## Check

The agent **MUST** verify each of the following:

- **No N+1 query patterns** — iterating over a result set and issuing a per-item follow-up query is a finding. Use batched joins, IN clauses, or eager-loading per the project's data-access pattern.
- **No unbounded data fetches** — list endpoints, search results, and audit-log scans use pagination / limits. A query that returns "all users" or "all events" with no bound is a finding.
- **Indexes match access patterns.** New `WHERE` clauses / `ORDER BY` columns / `JOIN` columns either hit an existing index OR ship a new index with the same change.
- **Pagination, not in-memory filtering.** Large collections are filtered / sorted at the data layer, not loaded into memory and filtered in code.
- **No blocking operations on hot paths.** Synchronous file I/O, synchronous HTTP calls, CPU-bound loops, and disk-bound operations don't sit on request-handling paths the user waits on.
- **Caching with correct invalidation.** Where caching is used, the cache key is correct, the TTL is appropriate to the data's mutation rate, and writes invalidate the cache. Stale data is worse than no cache.
- **Bundle size impact** for frontend changes — new dependencies are evaluated for tree-shakeability and pulled in via the smallest viable import path. A 200KB lodash for one function is a finding.
- **Allocation discipline on hot paths** — avoid per-request object creation that could be hoisted to module scope; avoid `JSON.parse(JSON.stringify(...))` cloning patterns; avoid array-spread inside loops.

## Common failure modes to look for

- A controller that fetches a list of N entities then loops issuing one query per entity to load a related field
- A search endpoint that fetches all rows then filters in application code
- A new `WHERE created_at > ?` query with no index on `created_at`
- A frontend feature that imports an entire library (`import _ from "lodash"`) for one function
- Caching with no invalidation on the relevant mutation — writes update the source, reads still see stale
- Synchronous network calls inside a request handler (e.g., `fetch().then()` chained but the chain blocks response)
- A "render all 10,000 items" frontend pattern with no virtualization
- A regex with catastrophic backtracking applied to user input
