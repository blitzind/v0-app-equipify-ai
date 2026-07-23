/** GE-AIOS-2F — Memory Registry source bindings. Delegates to @fuzor/memory. */

export {
  PLATFORM_MEMORY_SOURCE_BINDINGS as AI_MEMORY_SOURCE_BINDINGS,
  defaultPlatformMemoryOwnerAgentForType as defaultOwnerAgentForMemoryType,
  lookupPlatformMemorySourceBinding as lookupAiMemorySourceBinding,
  platformMemorySourceBindingCatalog as aiMemorySourceBindingCatalog,
} from "@fuzor/memory"

export type { PlatformMemorySourceBinding as AiMemorySourceBinding } from "@fuzor/memory"
