/** GE-AIOS-12A / GE-AIOS-17C — Ava Organizational Memory types. Delegates to @fuzor/memory. */

import type { AvaNarrativeMetricsSnapshot } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { AvaOperatingRhythmMemory } from "@/lib/growth/operating-rhythm/types"

export {
  PLATFORM_MEMORY_ENGINE_QA_MARKER as GROWTH_MEMORY_ENGINE_QA_MARKER,
  PLATFORM_ORGANIZATIONAL_MEMORY_STORAGE_KEY as AVA_ORGANIZATIONAL_MEMORY_STORAGE_KEY,
} from "@fuzor/memory"

export type {
  PlatformMemoryCategory as AvaMemoryCategory,
  PlatformMemoryEntityType as AvaMemoryEntityType,
  PlatformMemoryEvent as AvaMemoryEvent,
  PlatformMemoryEventSource as AvaMemoryEventSource,
  PlatformMemoryPattern as AvaMemoryPattern,
  PlatformMemorySummary as AvaMemorySummary,
  PlatformMemoryTimelinePeriod as AvaMemoryTimelinePeriod,
  PlatformMemoryCorrection as AvaMemoryCorrection,
  PlatformOrganizationalPreference as AvaOrganizationalPreference,
  PlatformOrganizationalMemoryStore as AvaOrganizationalMemoryStore,
} from "@fuzor/memory"

export type MemoryEngineAdapterInput = {
  previousSnapshot?: AvaNarrativeMetricsSnapshot | null
  operatingRhythmMemory?: AvaOperatingRhythmMemory | null
}
