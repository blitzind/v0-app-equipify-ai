/** GE-AIOS-17C — Organizational Knowledge types (client-safe). */

export const GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER =
  "ge-aios-17c-organizational-knowledge-v1" as const

export const GROWTH_ORGANIZATION_KNOWLEDGE_TABLE = "organization_knowledge" as const

/** Bounded read window for Home hydration. */
export const GROWTH_ORGANIZATION_KNOWLEDGE_MAX_ITEMS = 100 as const

export const ORGANIZATIONAL_KNOWLEDGE_CATEGORIES = [
  "industry",
  "company_size",
  "persona",
  "messaging",
  "objection",
  "timing",
  "pain_point",
  "market",
  "sales_process",
] as const

export type OrganizationalKnowledgeCategory = (typeof ORGANIZATIONAL_KNOWLEDGE_CATEGORIES)[number]

export const ORGANIZATIONAL_KNOWLEDGE_SOURCES = [
  "business_intelligence",
  "bi_review",
  "memory_events",
] as const

export type OrganizationalKnowledgeSource = (typeof ORGANIZATIONAL_KNOWLEDGE_SOURCES)[number]

/** Validated learning — conclusions, not single events. */
export type OrganizationalKnowledgeItem = {
  knowledge_id: string
  organization_id: string
  source: OrganizationalKnowledgeSource
  specialist: string | null
  category: OrganizationalKnowledgeCategory
  finding: string
  confidence: number
  supporting_event_count: number
  first_observed_at: string
  last_confirmed_at: string
  superseded_by: string | null
  active: boolean
  metadata: Record<string, string | number | boolean | null>
}

export type OrganizationalKnowledgeStore = {
  organizationId: string
  capturedAt: string
  items: OrganizationalKnowledgeItem[]
}

export type GrowthHomeOrganizationalKnowledgePayload = {
  qaMarker: typeof GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER
  store: OrganizationalKnowledgeStore
  source: "server" | "empty"
  degraded: boolean
  warning: string | null
}

export type OrganizationKnowledgePersistResult = {
  upserted: number
  skipped: number
  persistedKnowledgeIds: string[]
}

export function emptyOrganizationalKnowledgeStore(input: {
  organizationId: string
  generatedAt: string
}): OrganizationalKnowledgeStore {
  return {
    organizationId: input.organizationId,
    capturedAt: input.generatedAt,
    items: [],
  }
}
