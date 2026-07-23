/** GE-AIOS-2J — Context Assembly source registry. Delegates to @fuzor/context. */

import type { AiMemoryRegistryType } from "@/lib/growth/aios/ai-memory-registry-types"
import type { AiMemorySourceBinding } from "@/lib/growth/aios/ai-memory-source-registry"

export {
  PLATFORM_CONTEXT_ASSEMBLY_SOURCES as AI_CONTEXT_ASSEMBLY_SOURCES,
  PLATFORM_CONTEXT_ENTITY_INTELLIGENCE_BINDINGS as AI_CONTEXT_ENTITY_INTELLIGENCE_BINDINGS,
  lookupPlatformContextAssemblySource as lookupAiContextAssemblySource,
  lookupPlatformContextEntityIntelligenceBinding as lookupAiContextEntityIntelligenceBinding,
  memoryBindingForContextType,
  platformContextAssemblySourceCatalog as aiContextAssemblySourceCatalog,
} from "@fuzor/context"

export type {
  PlatformContextAssemblySourceEntry as AiContextAssemblySourceEntry,
  PlatformContextAssemblySourceKey as AiContextAssemblySourceKey,
  PlatformContextEntityIntelligenceBinding as AiContextEntityIntelligenceBinding,
} from "@fuzor/context"

export type { AiMemoryRegistryType, AiMemorySourceBinding }
