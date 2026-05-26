## Service dependencies — bring them up, or ask; never fake a pass

Some of this stage's quality gates exercise the running thing — a test suite that hits a database, a migration that needs Postgres, a check that talks to a queue or cache. A gate like that only means something against a **live** dependency. If the dependency isn't up, the gate didn't test anything.

So when a gate can't reach its dependency, there are exactly two honest moves — and "let it slide and advance" is not one of them:

1. **Bring it up (best effort).** If the project declares its services — a `.haiku/boot.md` recipe with `service:` processes, a `docker-compose.yml`, a `make` target — and the tool those services need is live (Docker daemon running, etc.), start them the way the project declares: `docker compose up -d <service>`, the make target, whatever the recipe says. Wait for it to be healthy (the recipe's `ready_url`), then re-run the gate. If it passes for real, you're done — that's a true green.

2. **Ask the user.** If you can't bring it up — the tool isn't installed or its daemon is dead, there's no recipe and you can't infer one, the service won't come healthy — stop and tell the user precisely what's missing and what to do: *"The integration tests need Postgres and Docker isn't running here. Start the database (or Docker), then tell me to retry."* Then wait. Recommend they capture a `.haiku/boot.md` service recipe so the next run doesn't refight it.

**Never advance, defer, or mark the gate passed because the environment was unavailable.** A gate that couldn't run is not a gate that passed — shipping on it is a false green, the exact failure this guards against. The engine will not stamp the approval for an unreachable-dependency failure; your job is to make the dependency reachable or surface it, not to route around the gate.

## Internal infrastructure runs for real; external SaaS may be mocked

There is a hard line on what you are allowed to fake. **Infrastructure the app owns and stands up as part of its own stack — its database, cache, queue, search index, object store (Postgres, MySQL, Redis, Mongo, Elasticsearch / OpenSearch, Kafka, RabbitMQ, NATS, MinIO, and the like) — MUST run for real.** Never mock it, stub it, swap in an in-memory fake, or point the gate at a SQLite stand-in for a Postgres app to make it green. A check that "passes" against a faked database has verified nothing about the migrations, queries, transactions, or persistence the deliverable actually depends on — that is the same false green as skipping the gate. Boot the real thing (a `docker compose` Postgres, a Redis container) and run against it. A managed-cloud version in production (RDS, ElastiCache, managed Mongo) still means "a real database / cache" here — bring up a real local equivalent, never a mock.

**Third-party SaaS the app calls across the network and does NOT run itself — payments (Stripe), SMS/voice (Twilio), email (SendGrid / SES), push, external auth/identity, vendor LLM and other APIs — MAY (and usually SHOULD) be mocked, stubbed, or pointed at the vendor's sandbox.** Driving them live in verification is the wrong move, not the rigorous one: it costs money, needs real credentials, and fires real-world side effects (charging a card, sending an SMS to a real number, mailing a real inbox). Use the vendor's test mode / sandbox keys when one exists, or a local mock otherwise.

The test is **ownership, not familiarity**: *do we run this process ourselves to stand the app up, or is it someone else's API we call out to?* Run-it-ourselves → real, every time. Call-out-to-a-vendor → a mock is fine. When you author `.haiku/boot.md`, declare the real internal services as `service:` processes; never write a recipe that boots a fake in their place, and never declare a third-party SaaS as a `service:` to be run — stub it at the app's edge instead.

The engine tells you which services are declared and which tools are live when a gate comes back environment-blocked — follow that breadcrumb. Don't hand-roll a one-off `docker run` no one can replay; use the project's declared recipe so the boot is reproducible on every harness.
