/** GE-AIOS-2B — Canonical AI OS event type registry (client-safe). Constitutional §11.5. */

import type { AiEventCategory } from "@/lib/growth/aios/ai-event-types"

export type AiEventRegistryEntry = {
  eventType: string
  category: AiEventCategory
  eventVersion: number
  schemaVersion: string
  description: string
}

/** Initial constitutional catalog — extensible via amendment/migration. */
export const AI_EVENT_REGISTRY: readonly AiEventRegistryEntry[] = [
  { eventType: "mission.created", category: "mission", eventVersion: 1, schemaVersion: "1.0", description: "Mission created" },
  { eventType: "mission.adapted", category: "mission", eventVersion: 1, schemaVersion: "1.0", description: "Mission adapted" },
  { eventType: "mission.completed", category: "mission", eventVersion: 1, schemaVersion: "1.0", description: "Mission completed" },
  { eventType: "work_order.created", category: "work_order", eventVersion: 1, schemaVersion: "1.0", description: "Work order issued" },
  { eventType: "work_order.status_changed", category: "work_order", eventVersion: 1, schemaVersion: "1.0", description: "Work order lifecycle transition" },
  { eventType: "work_order.retrying", category: "work_order", eventVersion: 1, schemaVersion: "1.0", description: "Work order retry" },
  { eventType: "work_order.archived", category: "work_order", eventVersion: 1, schemaVersion: "1.0", description: "Work order archived" },
  { eventType: "decision.requested", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "Decision requested" },
  { eventType: "decision.evaluated", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "Decision Engine rule evaluation completed" },
  { eventType: "decision.engine_degraded", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "Decision Engine entered degraded mode" },
  { eventType: "decision.engine_invoked", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "Decision Engine invoked by execution bridge" },
  { eventType: "decision.engine_skipped_existing_record", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "Execution bridge skipped engine — valid Decision Record exists" },
  { eventType: "decision.engine_blocked_execution", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "Execution bridge blocked Work Order execution" },
  { eventType: "decision.execution_bridge_completed", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "Decision Engine execution bridge completed — gate passed" },
  { eventType: "decision.ai_context_requested", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "Decision Intelligence Bridge requested context assembly" },
  { eventType: "decision.ai_evidence_added", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "AI provider output added as Decision Record evidence" },
  { eventType: "decision.ai_evidence_failed", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "AI evidence enrichment failed — rule-only fallback" },
  { eventType: "decision.recorded", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "Decision Record created" },
  { eventType: "decision.superseded", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "Decision Record superseded" },
  { eventType: "decision.linked", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "Decision Record linked to Work Order" },
  { eventType: "decision.gate_passed", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "Decision Gate passed — execution allowed" },
  { eventType: "decision.gate_blocked", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "Decision Gate blocked — execution denied" },
  { eventType: "memory.registered", category: "memory", eventVersion: 1, schemaVersion: "1.0", description: "Memory Registry entry registered" },
  { eventType: "memory.referenced", category: "memory", eventVersion: 1, schemaVersion: "1.0", description: "Memory Registry entry referenced" },
  { eventType: "memory.linked", category: "memory", eventVersion: 1, schemaVersion: "1.0", description: "Memory Registry entry linked to Work Order or Decision Record" },
  { eventType: "memory.archived", category: "memory", eventVersion: 1, schemaVersion: "1.0", description: "Memory Registry entry archived" },
  { eventType: "memory.updated", category: "memory", eventVersion: 1, schemaVersion: "1.0", description: "Memory Registry metadata updated" },
  { eventType: "context.assembled", category: "memory", eventVersion: 1, schemaVersion: "1.0", description: "Context Package assembled for Work Order" },
  { eventType: "context.validation_failed", category: "memory", eventVersion: 1, schemaVersion: "1.0", description: "Context Assembly validation failed" },
  { eventType: "context.reused", category: "memory", eventVersion: 1, schemaVersion: "1.0", description: "Existing Context Package reused by checksum" },
  { eventType: "decision.approval_required", category: "approval", eventVersion: 1, schemaVersion: "1.0", description: "Human approval required" },
  { eventType: "decision.approval_expired", category: "approval", eventVersion: 1, schemaVersion: "1.0", description: "Approval timed out" },
  { eventType: "memory.updated", category: "memory", eventVersion: 1, schemaVersion: "1.0", description: "Memory write" },
  { eventType: "learning.cycle_completed", category: "learning", eventVersion: 1, schemaVersion: "1.0", description: "Learning batch completed" },
  { eventType: "agent.registered", category: "agent", eventVersion: 1, schemaVersion: "1.0", description: "Agent runtime registered" },
  { eventType: "agent.heartbeat", category: "agent", eventVersion: 1, schemaVersion: "1.0", description: "Agent heartbeat" },
  { eventType: "agent.lease_claimed", category: "agent", eventVersion: 1, schemaVersion: "1.0", description: "Work order lease claimed" },
  { eventType: "agent.lease_released", category: "agent", eventVersion: 1, schemaVersion: "1.0", description: "Work order lease released" },
  { eventType: "agent.lease_expired", category: "agent", eventVersion: 1, schemaVersion: "1.0", description: "Work order lease expired" },
  { eventType: "agent.failed", category: "agent", eventVersion: 1, schemaVersion: "1.0", description: "Agent lease failed" },
  { eventType: "agent.escalated", category: "agent", eventVersion: 1, schemaVersion: "1.0", description: "Agent lease escalated" },
  { eventType: "agent.unhealthy", category: "health", eventVersion: 1, schemaVersion: "1.0", description: "Agent heartbeat stale" },
  { eventType: "agent.wake", category: "agent", eventVersion: 1, schemaVersion: "1.0", description: "Agent awakened" },
  { eventType: "agent.retry_hook", category: "agent", eventVersion: 1, schemaVersion: "1.0", description: "Agent retry hook invoked" },
  { eventType: "executive.tick", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Executive Brain planning tick" },
  { eventType: "executive.started", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Executive Brain runtime started" },
  { eventType: "executive.delegated", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Work Order delegated to agent" },
  { eventType: "executive.monitored", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Mission lifecycle monitored" },
  { eventType: "executive.escalated", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Delegation escalated" },
  { eventType: "executive.completed", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Mission cycle completed" },
  { eventType: "executive.decision_preparation_started", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Executive Brain started Decision Record preparation" },
  { eventType: "executive.decision_prepared", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Executive Brain prepared Decision Record for delegated Work Order" },
  { eventType: "executive.decision_preparation_failed", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Executive Brain Decision Record preparation failed" },
  { eventType: "executive.planning_tick_started", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Executive Brain mission planning tick started" },
  { eventType: "executive.work_order_proposed", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Executive Brain proposed Work Order for mission" },
  { eventType: "executive.planning_tick_completed", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Executive Brain mission planning tick completed" },
  { eventType: "executive.planning_tick_failed", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Executive Brain mission planning tick failed" },
  { eventType: "executive.planning_review_created", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Operator opened mission planning review dry-run preview" },
  { eventType: "executive.planning_review_approved", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Operator approved mission planning review — Work Order creation authorized" },
  { eventType: "pilot.lead_research_started", category: "system", eventVersion: 1, schemaVersion: "1.0", description: "Lead Research Pilot started for prospect" },
  { eventType: "pilot.lead_research_step_completed", category: "system", eventVersion: 1, schemaVersion: "1.0", description: "Lead Research Pilot step completed" },
  { eventType: "pilot.lead_research_step_failed", category: "system", eventVersion: 1, schemaVersion: "1.0", description: "Lead Research Pilot step failed" },
  { eventType: "pilot.lead_research_completed", category: "system", eventVersion: 1, schemaVersion: "1.0", description: "Lead Research Pilot completed successfully" },
  { eventType: "growth.workflow.status_changed", category: "system", eventVersion: 1, schemaVersion: "1.0", description: "Growth workflow status transition (e.g. growth_lead_research)" },
  { eventType: "growth.prospect_created", category: "mission", eventVersion: 1, schemaVersion: "1.0", description: "Growth prospect (lead) created — bridged to AI OS" },
  { eventType: "briefing.generated", category: "executive", eventVersion: 1, schemaVersion: "1.0", description: "Operator briefing generated" },
  { eventType: "provider.selected", category: "provider", eventVersion: 1, schemaVersion: "1.0", description: "Provider selected" },
  { eventType: "ai.requested", category: "provider", eventVersion: 1, schemaVersion: "1.0", description: "AI OS provider request initiated" },
  { eventType: "ai.completed", category: "provider", eventVersion: 1, schemaVersion: "1.0", description: "AI OS provider request completed" },
  { eventType: "ai.failed", category: "provider", eventVersion: 1, schemaVersion: "1.0", description: "AI OS provider request failed" },
  { eventType: "ai.provider_degraded", category: "provider", eventVersion: 1, schemaVersion: "1.0", description: "AI OS provider degraded during failover" },
  { eventType: "ai.provider_switched", category: "provider", eventVersion: 1, schemaVersion: "1.0", description: "AI OS provider switched during failover" },
  { eventType: "health.degraded", category: "health", eventVersion: 1, schemaVersion: "1.0", description: "Subsystem health degraded" },
  { eventType: "budget.threshold_reached", category: "budget", eventVersion: 1, schemaVersion: "1.0", description: "Budget threshold reached" },
  { eventType: "deliverability.throttled", category: "deliverability", eventVersion: 1, schemaVersion: "1.0", description: "Deliverability throttle applied" },
  { eventType: "conversation.reply_received", category: "conversation", eventVersion: 1, schemaVersion: "1.0", description: "Inbound reply received" },
  { eventType: "opportunity.created", category: "opportunity", eventVersion: 1, schemaVersion: "1.0", description: "Opportunity created" },
  { eventType: "safe_mode.entered", category: "system", eventVersion: 1, schemaVersion: "1.0", description: "Safe mode entered" },
  { eventType: "safe_mode.exited", category: "system", eventVersion: 1, schemaVersion: "1.0", description: "Safe mode exited" },
  { eventType: "meta_recommender.conflict_resolved", category: "decision", eventVersion: 1, schemaVersion: "1.0", description: "Meta-recommender resolved conflict" },
  { eventType: "ai_os.event.correction", category: "system", eventVersion: 1, schemaVersion: "1.0", description: "Corrective event superseding prior emission" },
] as const

const REGISTRY_INDEX = new Map(AI_EVENT_REGISTRY.map((entry) => [entry.eventType, entry]))

export function lookupAiEventRegistryEntry(eventType: string): AiEventRegistryEntry | null {
  return REGISTRY_INDEX.get(eventType) ?? null
}

export function isRegisteredAiEventType(eventType: string): boolean {
  return REGISTRY_INDEX.has(eventType)
}

export function eventTypeMatchesPrefix(eventType: string, prefix: string): boolean {
  if (!prefix) return true
  return eventType === prefix || eventType.startsWith(`${prefix}.`) || eventType.startsWith(prefix)
}

export function subscriptionMatchesEvent(
  subscription: {
    categories: AiEventCategory[]
    eventTypePrefixes: string[]
  },
  event: { category: AiEventCategory; eventType: string },
): boolean {
  const categoryMatch =
    subscription.categories.length === 0 || subscription.categories.includes(event.category)
  if (!categoryMatch) return false

  if (subscription.eventTypePrefixes.length === 0) return true
  return subscription.eventTypePrefixes.some((prefix) => eventTypeMatchesPrefix(event.eventType, prefix))
}

export function aiEventRegistryCatalog() {
  return {
    entries: [...AI_EVENT_REGISTRY],
    count: AI_EVENT_REGISTRY.length,
  }
}
