/** GE-AIOS-2F — Canonical memory source bindings (client-safe). References existing Growth stores. */

import type { AiMemoryRegistryType } from "@/lib/growth/aios/ai-memory-registry-types"
import type { AiWorkOrderAgent } from "@/lib/growth/aios/ai-work-order-types"

export type AiMemorySourceBinding = {
  memoryType: AiMemoryRegistryType
  ownerAgent: AiWorkOrderAgent
  sourceSystem: string
  sourceTable: string
  description: string
}

/** Primary owner + canonical source table per memory type — metadata registry only. */
export const AI_MEMORY_SOURCE_BINDINGS: readonly AiMemorySourceBinding[] = [
  {
    memoryType: "organization",
    ownerAgent: "executive_reporting",
    sourceSystem: "organization_growth_objectives",
    sourceTable: "growth.organization_growth_objectives",
    description: "Organization-level mission and objective context",
  },
  {
    memoryType: "mission",
    ownerAgent: "executive_brain",
    sourceSystem: "organization_growth_objectives",
    sourceTable: "growth.organization_growth_objectives",
    description: "Mission strategy and runtime objective state",
  },
  {
    memoryType: "company",
    ownerAgent: "research",
    sourceSystem: "company_intelligence",
    sourceTable: "growth.company_intelligence_snapshots",
    description: "Company intelligence snapshots and evidence",
  },
  {
    memoryType: "lead",
    ownerAgent: "conversation",
    sourceSystem: "lead_memory",
    sourceTable: "growth.lead_memory_profiles",
    description: "Lead relationship memory profiles",
  },
  {
    memoryType: "relationship",
    ownerAgent: "conversation",
    sourceSystem: "relationship_context",
    sourceTable: "growth.relationship_context",
    description: "Account relationship context and progression",
  },
  {
    memoryType: "conversation",
    ownerAgent: "conversation",
    sourceSystem: "inbox",
    sourceTable: "growth.inbox_threads",
    description: "Conversation thread history",
  },
  {
    memoryType: "research",
    ownerAgent: "research",
    sourceSystem: "lead_research",
    sourceTable: "growth.lead_research_runs",
    description: "Prospect research runs and notes",
  },
  {
    memoryType: "decision",
    ownerAgent: "research",
    sourceSystem: "ai_decision_records",
    sourceTable: "growth.ai_decision_records",
    description: "Constitutional Decision Records (GE-AIOS-2D)",
  },
  {
    memoryType: "provider",
    ownerAgent: "provider",
    sourceSystem: "provider_query_cache",
    sourceTable: "growth.provider_query_cache",
    description: "Provider query cache metadata",
  },
  {
    memoryType: "playbook",
    ownerAgent: "personalization",
    sourceSystem: "knowledge_center",
    sourceTable: "growth.signal_events",
    description: "Knowledge Center playbook documents",
  },
  {
    memoryType: "strategy",
    ownerAgent: "strategy",
    sourceSystem: "organization_growth_objectives",
    sourceTable: "growth.organization_growth_objectives",
    description: "Mission strategy and channel decisions",
  },
] as const

const BINDING_BY_TYPE = new Map(AI_MEMORY_SOURCE_BINDINGS.map((entry) => [entry.memoryType, entry]))

export function lookupAiMemorySourceBinding(memoryType: AiMemoryRegistryType): AiMemorySourceBinding | null {
  return BINDING_BY_TYPE.get(memoryType) ?? null
}

export function defaultOwnerAgentForMemoryType(memoryType: AiMemoryRegistryType): AiWorkOrderAgent {
  return lookupAiMemorySourceBinding(memoryType)?.ownerAgent ?? "research"
}

export function aiMemorySourceBindingCatalog() {
  return {
    entries: [...AI_MEMORY_SOURCE_BINDINGS],
    count: AI_MEMORY_SOURCE_BINDINGS.length,
  }
}
