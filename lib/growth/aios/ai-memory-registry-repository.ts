import "server-only"

/** GE-AIOS-2F — Memory Registry persistence. Delegates to @fuzor/memory. */

export {
  fetchPlatformMemoryRegistryById as fetchAiMemoryRegistryById,
  fetchPlatformMemoryRegistryBySource as fetchAiMemoryRegistryBySource,
  insertPlatformMemoryRegistryAuditEvent as insertAiMemoryRegistryAuditEvent,
  insertPlatformMemoryRegistryEntry as insertAiMemoryRegistryEntry,
  listPlatformMemoryRegistryAuditEvents as listAiMemoryRegistryAuditEvents,
  listPlatformMemoryRegistryEntries as listAiMemoryRegistryEntries,
  platformMemoryRegistryTypeCatalog as aiMemoryRegistrySchemaCatalog,
  updatePlatformMemoryRegistryEntry as updateAiMemoryRegistryEntry,
} from "@fuzor/memory"
