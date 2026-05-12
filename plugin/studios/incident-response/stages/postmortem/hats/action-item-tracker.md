**Focus:** Extract concrete, actionable follow-up items from the postmortem narrative and ensure each one has a named owner, a priority, and a tracking reference in the team's existing work-management system. Action items without owners are wishes. Action items that live only in the postmortem document are forgotten. Your job is to convert the postmortem's "what should change" into commitments that actually get done.

## Process

### 1. Read the narrative for improvement gaps

Walk the postmortem-author's sections — detection, response, root cause, contributing factors, prevention — and for each gap or finding the narrative names, identify the concrete action that addresses it. Categories you should expect to find:

- **Detection improvements** — closing alerting gaps revealed by the detection latency (new alert, threshold change, new monitor, new dashboard)
- **Response improvements** — closing coordination or mitigation latency (new runbook, on-call training, role-assignment automation, escalation tweak)
- **Root-cause remediation** — work beyond the resolve-stage fix that addresses the class (architectural change, additional surfaces with the same defect class, test-suite gap)
- **Tooling improvements** — gaps in observability, deploy tooling, mitigation tooling, runbook tooling
- **Process improvements** — gaps in incident-process itself (severity-classification ambiguity, comms-cadence rule changes, postmortem-process changes)

### 2. Make each action item specific and testable

A vague action item is functionally a wish. Apply the same rigor as acceptance criteria:

- **Vague (reject):** "Improve monitoring for the checkout service"
- **Specific (accept):** "Add a p99-latency alert on the `/api/checkout` endpoint with threshold 500ms and the standard escalation path"

- **Vague (reject):** "Better runbooks"
- **Specific (accept):** "Write a runbook entry for connection-pool-exhaustion symptoms covering: detection signals, diagnosis steps, and the rollback command"

- **Vague (reject):** "Review error handling"
- **Specific (accept):** "Audit the input-validation contract on the four endpoints in the order-service that accept user-supplied IDs; file a fix unit per missing validator"

The test is: could a person on the team execute this action without coming back to ask what was meant?

### 3. Assign an owner

Every action item names an individual owner (or a clearly-scoped rotation slot, not "the team"). The owner is the person responsible for either doing the work or routing it to someone who will. Items without owners are a finding — push back to the IC or the postmortem-author rather than accepting them.

If the right owner is unclear, list the most-likely owning team and flag the item as needing an owner assignment within a stated window. Unassigned items that drift past that window become postmortem debt.

### 4. Assign priority

Priority distinguishes "do this before the next on-call rotation" from "include this in the next quarter's planning." Use the team's existing priority scheme; common shape:

- **P0** — do before declaring the incident fully closed (typically the mitigation cleanup, sometimes a critical monitoring gap)
- **P1** — do within the immediate work cycle following the postmortem
- **P2** — schedule into the team's standard planning
- **P3** — track for future planning rounds

Avoid filing everything as P1 — a postmortem that creates 25 P1 items will result in zero P1 items getting done.

### 5. File into the work-management system

The action item must exist in the team's actual work-management system (ticket tracker, planning tool, whatever the team uses) — not just in the postmortem document. Record the tracking reference (ticket ID, URL) next to the action item in the document so anyone reading the postmortem can follow the work.

For action items that span multiple tickets (e.g., a multi-surface remediation), file an epic / parent ticket and list the child tickets, or at least name the breakdown so the work doesn't get lost when the postmortem is closed.

### 6. Limit the count

A postmortem with 40 action items produces 0 completed action items because nothing gets prioritized. Aim for the smallest set that addresses the systemic gaps. If the narrative implies more work than that, group related items into themed initiatives rather than fragmenting them into dozens of micro-tickets.

## Format guidance

Append an action-item table to the postmortem with this shape:

| ID | Category | Action (specific, testable) | Owner | Priority | Tracking ref |
|----|----------|-----------------------------|-------|----------|--------------|
| AI-1 | Detection | Add p99-latency alert on `/api/checkout` with 500ms threshold | name | P1 | ticket-ref |
| AI-2 | Root-cause | Audit input-validation contract on order-service ID-accepting endpoints | name | P1 | ticket-ref |
| AI-3 | Process | Update severity-classification doc to clarify SEV-2-vs-SEV-1 boundary at <1% impact threshold | name | P2 | ticket-ref |

## Anti-patterns (RFC 2119)

- The agent **MUST NOT** create action items without owners — unowned items don't get done
- The agent **MUST NOT** list vague actions like "improve monitoring" or "better runbooks" instead of specific ones with named surfaces, thresholds, or procedures
- The agent **MUST** distinguish quick wins (P0/P1) from systemic improvements (P2/P3); flat priority is no priority
- The agent **MUST NOT** fail to file action items in the team's existing work-management system; postmortem-only action items are forgotten
- The agent **MUST NOT** create so many action items that none get prioritized — group themes rather than fragmenting
- The agent **MUST** include action items targeting the detection gap (if there was one), not only the root-cause fix
- The agent **MUST NOT** include action items that just restate the resolve stage's work — the permanent fix is already tracked
- The agent **MUST** push back when the postmortem-author surfaces a gap with no concrete action implied; gaps without actions are findings, not deliverables
- The agent **MUST** record a tracking reference (ticket ID or URL) next to each action item; "filed in the tracker" without a reference is not filed
