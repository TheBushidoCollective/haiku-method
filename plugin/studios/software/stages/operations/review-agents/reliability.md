---
interpretation: lens
---
**Mandate:** The agent **MUST** verify the deployment and operational configuration supports reliable production operation under the load and failure modes the system will actually see. Operations changes that look benign in staging cascade into outages in production when reliability concerns aren't checked up front.

## Check

The agent **MUST** verify each:

- **Health checks reflect actual readiness.** Liveness vs. readiness are distinct. Readiness fails when the dependent datastore, cache, or upstream service is unreachable; liveness only fails on process death. A service marked ready that can't actually serve traffic causes worse outages than one that fails closed.
- **Rollback procedure exists and is tested.** Deployments declare how to roll back (previous version artifact, schema rollback steps, feature flag) and the rollback path has been exercised at least once on this surface — not theoretical.
- **Resource limits set with headroom.** CPU, memory, connection pools, file descriptors, and concurrent goroutines / threads have explicit limits sized from real observed usage with a stated headroom factor. No "unbounded" pools.
- **Graceful shutdown handles in-flight work.** Termination signals trigger draining: load balancer removal, in-flight requests completed (within a bounded timeout), then exit. New requests not accepted during drain.
- **Retry + circuit-breaker on external deps.** External calls have explicit retry policy (max attempts, backoff strategy, jitter) and a circuit breaker that fails fast when the dependency is degraded — they do NOT retry forever, do NOT retry non-idempotent operations, and do NOT amplify a downstream outage into a self-DDoS.
- **Capacity headroom states the load model.** Sizing references the actual peak-traffic shape (not "average load"). Headroom assumptions are explicit (e.g., 2x current peak) and tied to the autoscaling policy if any.
- **Stateful changes are reversible or migration-paired.** Schema migrations, data backfills, and partition changes either ship with an explicit reversal procedure or are paired with a forward-only strategy that the rollback can tolerate (expand-then-contract pattern).

## Common failure modes to look for

- Liveness probe that hits a static endpoint and never fails, while the service is actually deadlocked on a stuck database connection
- A rollback plan that says "redeploy the previous tag" but the previous tag's database migration has already been applied with no down migration
- Memory limit set just above current usage with no headroom — first burst of traffic triggers OOMKill
- A retry policy with no backoff or jitter — the first dependency hiccup turns into a synchronized retry storm
- Graceful shutdown with an unbounded drain timeout, causing rolling deploys to hang
- A circuit breaker that opens but never closes because its health probe is the same call it just stopped issuing
- An autoscaling policy whose scale-up is slower than the traffic ramp it's meant to absorb
