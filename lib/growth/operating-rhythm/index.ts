/** GE-AIOS-13A — Ava Operating Rhythm (canonical export). */

export {
  GROWTH_OPERATING_RHYTHM_QA_MARKER,
  AVA_OPERATING_PHASE_ORDER,
  AVA_OPERATING_PHASE_LABELS,
  type AvaOperatingPhaseId,
  type AvaOperatingPhaseStatus,
  type AvaOperatingPhaseEntry,
  type AvaOperatingRhythm,
  type AvaOperatingRhythmMemory,
  type OperatingRhythmMetrics,
  type OperatingRhythmPhaseInput,
} from "@/lib/growth/operating-rhythm/types"

export { buildOperatingRhythm, type BuildOperatingRhythmInput } from "@/lib/growth/operating-rhythm/planner/build-operating-rhythm"

export {
  runOperatingRhythm,
  startMorningPlanning,
  continueCurrentPhase,
  pauseCurrentPhase,
  resumeCurrentPhase,
  runEndOfDayReflection,
  type RunOperatingRhythmInput,
} from "@/lib/growth/operating-rhythm/engine/run-operating-rhythm"

export {
  mapWorkItemTypeToOperatingPhase,
  resolveCurrentPhaseFromWorkManager,
  buildTodayPlanFromWorkManager,
  groupWorkItemsByPhase,
} from "@/lib/growth/operating-rhythm/bridges/work-manager-bridge"

export {
  readOperatingRhythmMemory,
  writeOperatingRhythmMemory,
  buildOperatingRhythmMemory,
  AVA_OPERATING_RHYTHM_MEMORY_KEY,
} from "@/lib/growth/operating-rhythm/bridges/memory-bridge"

export {
  buildPhaseAwareNarrativeLine,
  buildOperatingRhythmNarrativeLines,
  buildOperatingRhythmStoryBlocks,
  buildEndOfDaySummary,
} from "@/lib/growth/operating-rhythm/bridges/narrative-bridge"

export const AVA_OPERATING_RHYTHM_TODAY_PROGRESS_TITLE = "Today's Progress" as const
