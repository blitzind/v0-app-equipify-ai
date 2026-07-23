/** GE-AIOS-17C — Organizational Knowledge types. Delegates to @fuzor/memory. */

export {
  PLATFORM_ORGANIZATIONAL_KNOWLEDGE_CATEGORIES as ORGANIZATIONAL_KNOWLEDGE_CATEGORIES,
  PLATFORM_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER as GROWTH_ORGANIZATIONAL_KNOWLEDGE_QA_MARKER,
  PLATFORM_ORGANIZATIONAL_KNOWLEDGE_SOURCES as ORGANIZATIONAL_KNOWLEDGE_SOURCES,
  PLATFORM_ORGANIZATION_KNOWLEDGE_MAX_ITEMS as GROWTH_ORGANIZATION_KNOWLEDGE_MAX_ITEMS,
  PLATFORM_ORGANIZATION_KNOWLEDGE_TABLE as GROWTH_ORGANIZATION_KNOWLEDGE_TABLE,
  emptyPlatformOrganizationalKnowledgeStore as emptyOrganizationalKnowledgeStore,
} from "@fuzor/memory"

export type {
  PlatformOrganizationalKnowledgeCategory as OrganizationalKnowledgeCategory,
  PlatformOrganizationalKnowledgeItem as OrganizationalKnowledgeItem,
  PlatformOrganizationalKnowledgePayload as GrowthHomeOrganizationalKnowledgePayload,
  PlatformOrganizationalKnowledgeSource as OrganizationalKnowledgeSource,
  PlatformOrganizationalKnowledgeStore as OrganizationalKnowledgeStore,
  PlatformOrganizationKnowledgePersistResult as OrganizationKnowledgePersistResult,
} from "@fuzor/memory"
