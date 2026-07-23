import "server-only"

/** GE-AIOS-2F — Memory Registry schema health. Delegates to @fuzor/memory. */

export {
  isPlatformMemoryRegistrySchemaReady as isGrowthAiMemoryRegistrySchemaReady,
  platformMemoryRegistrySchemaCatalog as aiMemoryRegistrySchemaCatalog,
  probePlatformMemoryRegistrySchema,
  resetPlatformMemoryRegistrySchemaProbeCacheForTests,
} from "@fuzor/memory"

export type { PlatformMemoryRegistrySchemaHealthSummary } from "@fuzor/memory"
