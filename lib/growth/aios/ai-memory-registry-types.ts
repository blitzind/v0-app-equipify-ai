/** GE-AIOS-2F — Memory Registry types. Delegates to @fuzor/memory. */

export {
  PLATFORM_AIOS_2F_PHASE as GROWTH_AIOS_2F_PHASE,
  PLATFORM_MEMORY_PRIVACY_SCOPES as AI_MEMORY_PRIVACY_SCOPES,
  PLATFORM_MEMORY_REGISTRY_LIFECYCLE_EVENTS as AI_MEMORY_REGISTRY_LIFECYCLE_EVENTS,
  PLATFORM_MEMORY_REGISTRY_LIFECYCLE_STATUSES as AI_MEMORY_REGISTRY_LIFECYCLE_STATUSES,
  PLATFORM_MEMORY_REGISTRY_QA_MARKER as GROWTH_AI_MEMORY_REGISTRY_QA_MARKER,
  PLATFORM_MEMORY_REGISTRY_SCHEMA_MIGRATION as GROWTH_AI_MEMORY_REGISTRY_SCHEMA_MIGRATION,
  PLATFORM_MEMORY_REGISTRY_SCHEMA_VERSION as AI_MEMORY_REGISTRY_SCHEMA_VERSION,
  PLATFORM_MEMORY_REGISTRY_TYPES as AI_MEMORY_REGISTRY_TYPES,
  PLATFORM_MEMORY_REGISTRY_RUNTIME_RULE as AI_MEMORY_REGISTRY_RUNTIME_RULE,
  PLATFORM_MEMORY_RETENTION_POLICIES as AI_MEMORY_RETENTION_POLICIES,
  isPlatformMemoryOwnerAgent as isAiMemoryOwnerAgent,
  isPlatformMemoryRegistryType as isAiMemoryRegistryType,
  normalizePlatformMemorySourceRef as normalizeMemorySourceRef,
} from "@fuzor/memory"

export type {
  PlatformMemoryPrivacyScope as AiMemoryPrivacyScope,
  PlatformMemoryRegistryArchiveInput as AiMemoryRegistryArchiveInput,
  PlatformMemoryRegistryAuditEvent as AiMemoryRegistryAuditEvent,
  PlatformMemoryRegistryEntry as AiMemoryRegistryEntry,
  PlatformMemoryRegistryLifecycleEvent as AiMemoryRegistryLifecycleEvent,
  PlatformMemoryRegistryLifecycleStatus as AiMemoryRegistryLifecycleStatus,
  PlatformMemoryRegistryLinkDecisionRecordInput as AiMemoryRegistryLinkDecisionRecordInput,
  PlatformMemoryRegistryLinkWorkOrderInput as AiMemoryRegistryLinkWorkOrderInput,
  PlatformMemoryRegistryListFilter as AiMemoryRegistryListFilter,
  PlatformMemoryRegistryReferenceInput as AiMemoryRegistryReferenceInput,
  PlatformMemoryRegistryRegisterInput as AiMemoryRegistryRegisterInput,
  PlatformMemoryRegistryType as AiMemoryRegistryType,
  PlatformMemoryRetentionPolicy as AiMemoryRetentionPolicy,
  PlatformMemorySourceRef as AiMemorySourceRef,
} from "@fuzor/memory"

export { AI_WORK_ORDER_AGENTS, type AiWorkOrderAgent } from "@/lib/growth/aios/ai-work-order-types"
