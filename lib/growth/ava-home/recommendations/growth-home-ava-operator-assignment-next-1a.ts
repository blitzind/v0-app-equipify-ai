/** GE-AIOS-NEXT-1A — Legacy assignment wrapper; NEXT-1B delegates to Mission Interpreter. */

import { interpretGrowthHomeAvaMissionIntent } from "@/lib/growth/ava-home/recommendations/growth-home-ava-mission-interpreter-next-1b"
import type { GrowthHomeAvaOperatorAssignmentPreview } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"

export const GROWTH_AIOS_NEXT_1A_OPERATOR_ASSIGNMENT_QA_MARKER =
  "ge-aios-next-1a-ava-operator-assignment-v1" as const

export function resolveGrowthHomeAvaOperatorAssignment(input: {
  instruction: string
  companyCandidates?: Array<{ leadId: string; companyName: string }>
  activeMissionLabel?: string | null
  estimatedMinutes?: number | null
}): GrowthHomeAvaOperatorAssignmentPreview | null {
  const interpreted = interpretGrowthHomeAvaMissionIntent(input)
  if (!interpreted) return null

  return {
    restatement: interpreted.objectiveShiftLabel
      ? `${interpreted.restatement} ${interpreted.objectiveShiftLabel}`
      : interpreted.restatement,
    intentSummary: interpreted.planSummary,
    estimatedEffortLabel: interpreted.estimatedEffortLabel,
    href: interpreted.href,
    conflictNote: interpreted.conflictNote,
  }
}
