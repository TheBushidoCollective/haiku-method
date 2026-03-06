# H·AI·K·U: Human AI Knowledge Unification

**A universal framework for structured human-AI collaboration across any domain.**

H·AI·K·U provides a disciplined, phase-driven methodology that governs how humans and AI systems collaborate to move from intent to outcome. Like the poetic form it draws its name from, H·AI·K·U achieves clarity through constraint — structured form that channels creative energy into reliable, repeatable results.

**Domain:** [haikumethod.ai](https://haikumethod.ai)

---

## The 4-Phase Lifecycle

Every initiative in H·AI·K·U follows four phases. Each phase has a distinct purpose and produces artifacts that feed the next.

### 1. Elaboration

**Purpose:** Define what will be done and why.

Elaboration transforms a broad intent into a structured plan. This phase produces the shared understanding that all subsequent work depends on.

- **Define intent** — articulate the goal, scope, and desired outcome
- **Decompose into units** — break the intent into discrete, addressable pieces of work
- **Set success criteria** — establish measurable conditions that define completion
- **Build domain model** — capture the vocabulary, constraints, and relationships of the problem space

Elaboration is complete when every unit has clear success criteria and the decomposition covers the full intent.

### 2. Execution

**Purpose:** Do the work.

Execution operates through hat-based workflows: ordered sequences of behavioral roles (hats) that structure how work progresses. Each unit moves through its workflow in iterative cycles called bolts.

- **Hats** define behavioral roles (e.g., planner, executor, reviewer)
- **Workflows** define the ordered sequence of hats a unit passes through
- **Bolts** are iteration cycles within a unit — each bolt advances the work and produces a reviewable increment
- **Quality gates** provide configurable backpressure, ensuring work meets standards before progressing

Execution is complete when all units satisfy their success criteria and pass their quality gates.

### 3. Operation

**Purpose:** Manage what was built.

Operation governs the ongoing management of delivered outcomes. Not every intent ends at delivery — many require sustained activity.

- **Recurring tasks** — scheduled, repeatable activities with AI assistance
- **Reactive responses** — triggered actions in response to events or conditions
- **Manual activities with AI guidance** — human-led work supported by AI recommendations and context

Operation continues for as long as the delivered outcome requires active management.

### 4. Reflection

**Purpose:** Learn from what happened.

Reflection closes the loop. It analyzes outcomes against original intent, captures learnings, and feeds insights forward into organizational memory and future elaboration cycles.

- **Analyze outcomes** — compare results to success criteria and original intent
- **Capture learnings** — document what worked, what failed, and why
- **Feed forward** — update organizational memory, refine processes, and inform the next iteration

Reflection transforms experience into institutional knowledge.

---

## The Workspace

H·AI·K·U artifacts live in a **workspace** — a standalone knowledge base that is not tied to any single project or repository. The workspace is where intents, memory, and organizational knowledge accumulate over time.

A workspace can be:
- A local directory
- A shared cloud drive folder (Google Drive, Dropbox, OneDrive)
- Backed by a knowledge management system via MCP (Notion, etc.)

### Structure

```
workspace/
  memory/              # Organizational memory (compounds over time)
    learnings.md       # Accumulated learnings from reflection
    patterns.md        # Established patterns and anti-patterns
    domain/            # Domain models and vocabulary
  intents/             # All initiatives
    {intent-slug}/     # A specific initiative
      intent.md        # Intent definition and success criteria
      unit-*.md        # Unit specifications
      state/           # Iteration state
  settings.yml         # Configuration (workflows, gates)
  workflows.yml        # Custom workflow definitions
```

### Hierarchical Knowledge

Workspaces nest hierarchically. A company workspace contains team workspaces, which may contain project-level workspaces:

```
company/
  memory/              # Company-wide learnings
  engineering/
    memory/            # Engineering-specific patterns
    intents/           # Engineering initiatives
  marketing/
    memory/            # Marketing-specific patterns
    intents/           # Marketing initiatives
```

Memory inherits upward — when working within `engineering/`, the system sees engineering-specific memory plus company-wide memory. Siblings are isolated.

### Configuration

Projects point to their workspace through either:
- **Environment variable:** `HAIKU_WORKSPACE=/path/to/workspace`
- **Pointer file:** `.haiku.yml` in the project root with a `workspace:` field

---

## Core Principles

### Disciplined Structure

Like haiku poetry, constrained form produces clarity. H·AI·K·U imposes structure not to limit creativity but to channel it. Every phase, hat, workflow, and quality gate exists to reduce ambiguity and increase the signal-to-noise ratio of collaborative work.

### Iterative Refinement

Work progresses through bolts within units within intents. Each iteration produces a reviewable increment. Small cycles with frequent feedback prevent drift and compound learning.

### Domain-Agnostic Design

H·AI·K·U is not bound to any single industry or discipline. The same lifecycle — elaboration, execution, operation, reflection — applies to software engineering, marketing campaigns, strategic planning, operations management, and scientific research. Domain specifics are handled by profiles (see below).

### Learning Loops

Reflection is not optional. Every completed intent feeds learnings back into organizational memory. Future elaboration draws on past reflection. This creates a compounding advantage: teams that use H·AI·K·U get better at using H·AI·K·U.

### Human-AI Collaboration Modes

H·AI·K·U recognizes three modes of collaboration, configurable per unit or per phase:

| Mode | Description |
|------|-------------|
| **Supervised** | Human directs, AI assists. Human approves every significant action. |
| **Observed** | AI executes, human monitors. Human intervenes when needed. |
| **Autonomous** | AI executes independently within defined boundaries. Human reviews outcomes. |

The appropriate mode depends on risk, complexity, and organizational trust. H·AI·K·U supports fluid movement between modes as context changes.

---

## The Profile Model

H·AI·K·U defines the universal methodology. **Profiles** adapt it to specific domains.

A profile customizes H·AI·K·U for a particular field by defining domain-specific hats, workflows, quality gates, tooling integrations, and artifact types — while preserving the core 4-phase lifecycle and principles.

| Profile | Domain | Key Customizations |
|---------|--------|--------------------|
| **AI-DLC** | Software Development | Git integration, test suites, PR workflows, CI/CD pipelines, deployment gates |
| **SWARM** | Marketing & Sales | Scope, Workstreams, Accountability, Results, Memory — campaign planning, content workflows, performance analysis |
| *Custom* | Any Domain | Organizations define their own profiles for operations, research, strategy, etc. |

**AI-DLC** is the software development profile of H·AI·K·U. It was the first profile developed and serves as the reference implementation.

**SWARM** (Scope, Workstreams, Accountability, Results, Memory) validates H·AI·K·U's universality by demonstrating the framework's applicability beyond software, in the domain of marketing and sales.

Organizations can create custom profiles for any domain while inheriting H·AI·K·U's lifecycle, principles, and collaboration model.

---

## Terminology

| Term | Definition |
|------|------------|
| **Intent** | The thing being accomplished — the top-level goal or initiative |
| **Unit** | A discrete piece of work within an intent |
| **Bolt** | An iteration cycle within a unit — each bolt advances and produces a reviewable increment |
| **Hat** | A behavioral role assumed during execution (e.g., planner, builder, reviewer) |
| **Workflow** | An ordered sequence of hats that defines how a unit progresses |
| **Quality Gate** | A configurable verification checkpoint that provides backpressure |
| **Phase** | A stage in the lifecycle: Elaboration, Execution, Operation, or Reflection |
| **Profile** | A domain-specific implementation of H·AI·K·U (e.g., AI-DLC for software, SWARM for marketing) |
| **Collaboration Mode** | The human-AI interaction pattern: Supervised, Observed, or Autonomous |
| **Workspace** | A standalone knowledge base where H·AI·K·U artifacts live — can be local, cloud-synced, or MCP-backed, and can nest hierarchically |
| **Workspace Memory** | Organizational knowledge stored in a workspace's memory directory — learnings, patterns, and domain models that compound across intents and inherit upward through workspace hierarchy |

---

## Why "H·AI·K·U"

The name carries intention at every level.

**The acronym** — **H**uman **AI** **K**nowledge **U**nification — captures the framework's purpose: unifying human judgment and AI capability into a coherent, structured collaboration. The stylization H·AI·K·U makes the structure visible: the human, the AI, and the knowledge they unify together.

**The poetic form** — haiku is a Japanese poetic tradition defined by rigid structural constraints (5-7-5 syllables) that paradoxically produce profound clarity and beauty. H·AI·K·U the methodology works the same way: disciplined structure that produces clear, effective outcomes.

**The cultural resonance** — rooted in the same tradition as bushido, haiku reflects disciplined mastery and the pursuit of excellence through practice and form. The Bushido Collective builds on this heritage: the unification of human creativity and AI capability through deliberate, principled structure.
