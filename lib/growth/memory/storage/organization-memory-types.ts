/** GE-AIOS-17B — Organization memory payload types. Delegates to @fuzor/memory. */

export {
  PLATFORM_ORGANIZATION_MEMORY_EVENTS_TABLE as GROWTH_ORGANIZATION_MEMORY_EVENTS_TABLE,
  PLATFORM_ORGANIZATION_MEMORY_PREFERENCES_TABLE as GROWTH_ORGANIZATION_MEMORY_PREFERENCES_TABLE,
  PLATFORM_ORGANIZATION_MEMORY_MAX_EVENTS as GROWTH_ORGANIZATION_MEMORY_MAX_EVENTS,
  PLATFORM_ORGANIZATION_MEMORY_MAX_PREFERENCES as GROWTH_ORGANIZATION_MEMORY_MAX_PREFERENCES,
  PLATFORM_SERVER_ORG_MEMORY_QA_MARKER as GROWTH_SERVER_ORG_MEMORY_QA_MARKER,
  emptyPlatformOrganizationMemoryStore as emptyOrganizationMemoryStore,
} from "@fuzor/memory"

export type {
  PlatformOrganizationMemoryPayload as GrowthHomeOrganizationMemoryPayload,
  PlatformOrganizationMemoryPersistResult as OrganizationMemoryPersistResult,
} from "@fuzor/memory"
