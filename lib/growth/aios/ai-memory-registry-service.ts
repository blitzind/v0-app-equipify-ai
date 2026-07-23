import "server-only"

/** GE-AIOS-2F — Memory Registry service. Delegates to @fuzor/memory. */

export {
  archivePlatformMemoryRegistryEntry as archiveAiMemoryRegistryEntry,
  getPlatformMemoryRegistryAuditTrail as getAiMemoryRegistryAuditTrail,
  getPlatformMemoryRegistryEntry as getAiMemoryRegistryEntry,
  linkPlatformMemoryRegistryToDecisionRecord as linkAiMemoryRegistryToDecisionRecord,
  linkPlatformMemoryRegistryToWorkOrder as linkAiMemoryRegistryToWorkOrder,
  queryPlatformMemoryRegistry as queryAiMemoryRegistry,
  referencePlatformMemoryRegistryEntry as referenceAiMemoryRegistryEntry,
  registerPlatformMemoryRegistryEntry as registerAiMemoryRegistryEntry,
} from "@fuzor/memory"
