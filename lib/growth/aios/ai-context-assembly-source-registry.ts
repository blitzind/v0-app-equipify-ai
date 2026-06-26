/** GE-AIOS-2J — Context source registry (client-safe). Maps assembly sources to existing Growth stores. */

import {
  AI_MEMORY_SOURCE_BINDINGS,
  lookupAiMemorySourceBinding,
  type AiMemorySourceBinding,
} from "@/lib/growth/aios/ai-memory-source-registry"
import type { AiMemoryRegistryType } from "@/lib/growth/aios/ai-memory-registry-types"

export type AiContextAssemblySourceKey =
  | "work_order"
  | "mission"
  | "decision_records"
  | "memory_registry"
  | "related_events"
  | "entity_metadata"

export type AiContextAssemblySourceEntry = {
  sourceKey: AiContextAssemblySourceKey
  description: string
  sourceSystem: string
  sourceTable: string | null
  readOnly: true
}

/** Canonical context sources — references only, no duplicated storage. */
export const AI_CONTEXT_ASSEMBLY_SOURCES: readonly AiContextAssemblySourceEntry[] = [
  {
    sourceKey: "work_order",
    description: "Work Order row and payload from growth.ai_work_orders",
    sourceSystem: "ai_work_orders",
    sourceTable: "growth.ai_work_orders",
    readOnly: true,
  },
  {
    sourceKey: "mission",
    description: "Mission objective from growth.organization_growth_objectives",
    sourceSystem: "organization_growth_objectives",
    sourceTable: "growth.organization_growth_objectives",
    readOnly: true,
  },
  {
    sourceKey: "decision_records",
    description: "Decision history from growth.ai_decision_records",
    sourceSystem: "ai_decision_records",
    sourceTable: "growth.ai_decision_records",
    readOnly: true,
  },
  {
    sourceKey: "memory_registry",
    description: "Memory references from growth.ai_memory_registry",
    sourceSystem: "ai_memory_registry",
    sourceTable: "growth.ai_memory_registry",
    readOnly: true,
  },
  {
    sourceKey: "related_events",
    description: "Correlated AI OS events from growth.ai_os_events",
    sourceSystem: "ai_os_events",
    sourceTable: "growth.ai_os_events",
    readOnly: true,
  },
  {
    sourceKey: "entity_metadata",
    description: "Entity intelligence projections from existing Growth stores",
    sourceSystem: "growth_intelligence",
    sourceTable: null,
    readOnly: true,
  },
] as const

export type AiContextEntityIntelligenceBinding = {
  entityType: string
  sourceSystem: string
  sourceTable: string
  memoryType: AiMemoryRegistryType | null
  description: string
}

/** Entity-type bindings for read-only Growth intelligence reuse. */
export const AI_CONTEXT_ENTITY_INTELLIGENCE_BINDINGS: readonly AiContextEntityIntelligenceBinding[] = [
  {
    entityType: "lead",
    sourceSystem: "lead_memory",
    sourceTable: "growth.lead_memory_profiles",
    memoryType: "lead",
    description: "Lead memory influence projection",
  },
  {
    entityType: "company",
    sourceSystem: "company_intelligence",
    sourceTable: "growth.company_intelligence_snapshots",
    memoryType: "company",
    description: "Company intelligence snapshots",
  },
] as const

const SOURCE_BY_KEY = new Map(AI_CONTEXT_ASSEMBLY_SOURCES.map((entry) => [entry.sourceKey, entry]))
const ENTITY_BINDING_BY_TYPE = new Map(
  AI_CONTEXT_ENTITY_INTELLIGENCE_BINDINGS.map((entry) => [entry.entityType, entry]),
)

export function lookupAiContextAssemblySource(
  sourceKey: AiContextAssemblySourceKey,
): AiContextAssemblySourceEntry | null {
  return SOURCE_BY_KEY.get(sourceKey) ?? null
}

export function lookupAiContextEntityIntelligenceBinding(
  entityType: string,
): AiContextEntityIntelligenceBinding | null {
  return ENTITY_BINDING_BY_TYPE.get(entityType) ?? null
}

export function memoryBindingForContextType(memoryType: AiMemoryRegistryType): AiMemorySourceBinding | null {
  return lookupAiMemorySourceBinding(memoryType)
}

export function aiContextAssemblySourceCatalog() {
  return {
    sources: [...AI_CONTEXT_ASSEMBLY_SOURCES],
    entityBindings: [...AI_CONTEXT_ENTITY_INTELLIGENCE_BINDINGS],
    memoryBindings: [...AI_MEMORY_SOURCE_BINDINGS],
    count: AI_CONTEXT_ASSEMBLY_SOURCES.length,
  }
}
