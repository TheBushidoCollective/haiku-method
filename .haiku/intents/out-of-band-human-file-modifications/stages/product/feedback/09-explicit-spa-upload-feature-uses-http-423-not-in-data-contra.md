---
title: explicit-spa-upload.feature uses HTTP 423 not in DATA-CONTRACTS.md error table
status: addressed
origin: adversarial-review
author: completeness
author_type: agent
created_at: '2026-04-29T03:43:03Z'
iteration: 1
visit: 1
source_ref: null
closed_by: null
bolt: 1
triaged_at: '2026-04-29T03:43:03Z'
resolution: null
replies: []
hat: product
iterations:
  - bolt: 1
    hat: product
    completed_at: '2026-04-29T03:48:37Z'
    result: advanced
---
## Finding

`explicit-spa-upload.feature` lines 101–104 (locked worktree scenario) specifies:

```
Then the SPA endpoint returns HTTP 423 with error code "intent_locked"
```

HTTP 423 is not defined in the behavioral specification. **DATA-CONTRACTS.md §5.1** (the authoritative HTTP API error table) defines:

```
409 | intent_locked | Intent in a state that disallows uploads.
```

The feature file specifies 423 (Locked), which is a WebDAV-specific status code not present in the product-stage data contracts. This is a completeness failure: the behavioral specification references an error code that has no corresponding entry in the data contracts, and contradicts the specified error code (409) for the same condition.

## Impact

The development stage will implement the HTTP error code from the feature file (423) or the data contracts (409). The two are inconsistent. There is no scenario in the feature files asserting the correct 409 behavior for this case, so the full error path contract is incomplete.

## Required fix

`explicit-spa-upload.feature` must change line 102 from HTTP 423 to HTTP 409, aligning with DATA-CONTRACTS.md §5.1. The error code "intent_locked" can remain unchanged.
