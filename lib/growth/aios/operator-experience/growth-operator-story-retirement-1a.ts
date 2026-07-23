/**
 * GE-AIOS-OPERATOR-STORY-IMPLEMENTATION-1A — Retired presentation layers (client-safe).
 * Documents presentation-only retirements; underlying engines remain.
 */

export const GROWTH_AIOS_OPERATOR_STORY_RETIREMENT_1A_QA_MARKER =
  "ge-aios-operator-story-retirement-1a-v1" as const

export type GrowthOperatorStoryRetirementEntry = {
  retiredPresentation: string
  canonicalReplacement: string
  migrationCompleted: boolean
}

export const GROWTH_OPERATOR_STORY_RETIREMENT_LIST: GrowthOperatorStoryRetirementEntry[] = [
  {
    retiredPresentation: "Primary assignment = canonicalOperatorFocus company (runtime conflation)",
    canonicalReplacement:
      "resolveRuntimeExecutionPresentation + operatorFocusCompanyName (GE-AIOS-HOME-RUNTIME-AUTHORITY-1B)",
    migrationCompleted: true,
  },
  {
    retiredPresentation: "Home hero lead from DRQ top item (parallel priority)",
    canonicalReplacement: "buildCanonicalOperatorFocus (approval → blocker → decision → queue)",
    migrationCompleted: true,
  },
  {
    retiredPresentation: "Today's Work as separate operator priority",
    canonicalReplacement: "Progress projection (projectCanonicalOperatorProgress)",
    migrationCompleted: true,
  },
  {
    retiredPresentation: "Revenue Queue motion/urgency/owner action copy",
    canonicalReplacement: "Navigation-only account cards (Open account)",
    migrationCompleted: true,
  },
  {
    retiredPresentation: "Duplicate waiting queue inside Progress section",
    canonicalReplacement: "Waiting On You (canonicalOperatorTask only)",
    migrationCompleted: true,
  },
  {
    retiredPresentation: "Mission Center on primary Home path",
    canonicalReplacement: "GrowthHomeCanonicalMissionsSection (advanced path only)",
    migrationCompleted: true,
  },
  {
    retiredPresentation: "Parallel what-happened summaries (conversation/relationship/memory)",
    canonicalReplacement: "buildCanonicalOperatorAccountNarrative.whatHappened",
    migrationCompleted: true,
  },
  {
    retiredPresentation: "Call briefing influence-only memory path",
    canonicalReplacement: "resolveCanonicalHumanMemoryForLead + account narrative",
    migrationCompleted: true,
  },
  {
    retiredPresentation: "Legacy NBA whyNow on call briefing",
    canonicalReplacement: "Canonical account narrative + decision projection",
    migrationCompleted: true,
  },
  {
    retiredPresentation: "Send Plane blocked operator badge",
    canonicalReplacement: "humanizeOperatorBadgeLabel → Waiting for approval",
    migrationCompleted: true,
  },
]
