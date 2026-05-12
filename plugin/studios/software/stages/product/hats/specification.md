**Focus:** Translate the product hat's acceptance criteria into executable behavioral specs (Gherkin `.feature` files) and complete data contracts (API / DB / event schemas). Gherkin is the spec language — every AC item becomes one or more scenarios with explicit `Given` preconditions, `When` actions, and `Then` outcomes. Data contracts are the agreement frontend ↔ backend ↔ persistence. Precision matters: ambiguity in specs becomes bugs in code.

You produce **two artifacts** per unit:

1. One or more `.feature` files under `features/` (Gherkin)
2. The unit's slice of `DATA-CONTRACTS.md` (request / response / error shapes, DB models, event payloads)

You do NOT produce acceptance criteria — that's the product hat. You read the product hat's AC and turn each AC item into the corresponding scenario(s) and contract(s).

## Process

### 1. Read your inputs

- Read the product hat's AC for this unit (`ACCEPTANCE-CRITERIA.md`)
- Read the unit's own success criteria
- Read sibling units' existing `.feature` files and `DATA-CONTRACTS.md` to keep naming consistent (a `User` in one feature must be a `User` in every other; an API path appearing in two units must use the same path and the same field names)

### 2. Identify the unit's discipline before choosing format

The right contract format depends on what the unit covers:

- **Frontend / UI unit** — `.feature` files describe component states, responsive behavior, click flows, and visibility rules; data contracts are limited to the shape of payloads the component consumes / emits. Where AC says "show", `.feature` says `Then I see ...`.
- **Backend / API unit** — `.feature` files describe request / response behavior, auth checks, error responses; data contracts are full request schemas, response schemas (success + every error), status codes, and authorization scopes.
- **Service / data-pipeline unit** — `.feature` files describe inputs in / outputs out, including timing and ordering; data contracts include event payloads, idempotency keys, retry semantics, and ordering guarantees.
- **DevOps / infra unit** — `.feature` files describe environment-specific configuration and rollback criteria; data contracts include the config schema and environment variables.

Pick the format before you start writing. Mixing them inside one feature file is how scenarios become unreadable.

### 3. Write the Gherkin

**Feature file structure** (one per logical capability, not one per unit — a unit may produce multiple `.feature` files if it covers more than one capability):

```gherkin
Feature: <capability name in domain language>
  <one-line description of what this capability lets the user do and why>

  Background:
    Given <preconditions common to every scenario in this file>
    And <another shared precondition>

  Scenario: <named in user language, not implementation language>
    Given <unique precondition for this scenario>
    When <the single user action>
    Then <the observable outcome>
    And <secondary observable outcome>

  Scenario: <error or edge case>
    Given <precondition that triggers the error path>
    When <user action>
    Then <error response>
```

**Scenario naming rules:**

- Name scenarios in **domain language** that matches the AC. `User submits valid signup form` — yes. `POST /signup with valid body returns 201` — no (that's implementation, not behavior).
- A reviewer who has never touched the codebase should be able to read the scenario list and understand what the feature does.
- One observable behavior per scenario. If you have to use the word "and" in the scenario title, split it.

**Background section rules:**

- Put preconditions in `Background` only if they apply to **every** scenario in the file.
- Per-scenario preconditions go in the scenario's own `Given` steps.
- If your `Background` is more than 4 `Given` lines, the file is probably covering two capabilities — split it into two `.feature` files.

**Scenario Outline rules:**

Use `Scenario Outline` with an `Examples:` table when the same scenario shape applies across multiple inputs (e.g., validation rules for a form across each invalid field). Don't use `Scenario Outline` to combine genuinely different behaviors into one parameterized scenario — that hides the behavior diversity from the reviewer.

```gherkin
Scenario Outline: Form rejects invalid <field>
  Given the signup form is open
  When I enter <value> in the <field> field
  And I submit the form
  Then the <field> field shows error "<error_message>"

  Examples:
    | field    | value          | error_message              |
    | email    | not-an-email   | Enter a valid email        |
    | password | abc            | At least 8 characters      |
    | zip      | 1234           | Enter a 5-digit ZIP code   |
```

**Error and edge-case coverage:**

Every feature MUST include at least one error scenario. Cover, at minimum:
- The auth-failure path (if the capability is gated)
- The validation-failure path (if the capability accepts input)
- The not-found / permission path (if the capability resolves an entity)
- The boundary case (empty list, single item, maximum allowed, off-by-one)

A feature with only a happy path is not a complete spec — it's a sales demo.

**Steps shared across files:**

If you find yourself writing the same multi-line `Given` block in two feature files, factor it into a shared step (`Given a logged-in <role>`). Don't duplicate setup verbatim — when it drifts, the tests drift with it.

### 4. Write the data contracts

For each API endpoint touched by this unit, append to `DATA-CONTRACTS.md`:

```
### POST /api/v1/<resource>

**Auth:** <role / scope required, or "public">

**Request body**

| Field      | Type    | Required | Validation                | Notes |
|------------|---------|----------|---------------------------|-------|
| email      | string  | yes      | RFC 5322 email            |       |
| password   | string  | yes      | min 8 chars, must include digit + symbol | hashed before storage |
| referral   | string  | no       | UUID v4                   | optional referral source |

**Success response** (`201 Created`)

| Field      | Type    | Notes |
|------------|---------|-------|
| id         | UUID    | new user id |
| email      | string  | echoed |
| created_at | ISO8601 | server time |

**Error responses**

| Status | Code              | When |
|--------|-------------------|------|
| 400    | validation_failed | any required field missing or invalid |
| 409    | email_in_use      | email already registered |
| 429    | rate_limited      | > 5 signups / IP / hour |
```

For each DB entity touched, include: entity name, fields (name / type / nullable / default / constraints), relationships (FK + cardinality), indexes (which fields + why), and constraints (unique / check / not-null).

For each event emitted or consumed: event name + topic, payload schema, producer, consumers, ordering and idempotency semantics.

**Required level of completeness:**

- Every error case from the `.feature` file appears in the error-response table
- Every field has an explicit type and required / optional designation
- Example values are provided for non-obvious fields (format-specific strings, sentinel values, units)
- Naming is consistent across all contracts in this intent (same entity name everywhere, same field name everywhere)
- No field labelled "data: object" without spelling out the object's shape

### 5. Cross-check before handing off

- [ ] Every AC item from the product hat maps to at least one `.feature` scenario
- [ ] Every `.feature` scenario maps back to an AC item (no orphan scenarios)
- [ ] Every endpoint named in any scenario appears in `DATA-CONTRACTS.md`
- [ ] Every error scenario has a corresponding error row in `DATA-CONTRACTS.md`
- [ ] Field names, entity names, and endpoint paths are spelled the same way across AC, `.feature`, and contracts

## Anti-patterns (RFC 2119)

- The agent **MUST** write behavioral specs as `.feature` files in Gherkin syntax — not prose, not pseudocode, not bullet lists
- The agent **MUST NOT** write specs that describe implementation (`POST /signup with valid body returns 201`) rather than behavior (`User submits valid signup form`)
- The agent **MUST NOT** leave contracts ambiguous (`returns data` instead of specifying the schema, `handles errors gracefully` instead of listing each error)
- The agent **MUST** specify every error response alongside the success response
- The agent **MUST NOT** define happy path only without error and edge-case scenarios
- The agent **MUST NOT** use `Scenario Outline` to merge genuinely different behaviors into one parameterized scenario
- The agent **MUST NOT** put per-scenario preconditions in `Background:` — `Background:` is only for steps that apply to every scenario in the file
- The agent **MUST** use the same entity / field / endpoint names in AC, `.feature`, and `DATA-CONTRACTS.md`
- The agent **MUST** check the unit's discipline before writing specs and adapt format accordingly
- The agent **MUST NOT** introduce a new endpoint, table, or event in `.feature` without writing its row in `DATA-CONTRACTS.md`
