/** Client-safe Growth Engine AI copilot playbook types. */

import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"

export const GROWTH_AI_COPILOT_PLAYBOOK_SOURCE_KINDS = [
  "youtube_link",
  "transcript_text",
  "pasted_notes",
  "uploaded_document",
  "website_url",
] as const
export type GrowthAiCopilotPlaybookSourceKind = (typeof GROWTH_AI_COPILOT_PLAYBOOK_SOURCE_KINDS)[number]

export const GROWTH_AI_COPILOT_PLAYBOOK_SOURCE_STATUSES = [
  "pending",
  "ready",
  "extracting",
  "extracted",
  "failed",
  "archived",
  "unsupported",
] as const
export type GrowthAiCopilotPlaybookSourceStatus =
  (typeof GROWTH_AI_COPILOT_PLAYBOOK_SOURCE_STATUSES)[number]

export const GROWTH_AI_COPILOT_PLAYBOOK_RULE_CATEGORIES = [
  "email_style",
  "call_script",
  "objection_handling",
  "tone",
  "cta",
  "words_to_avoid",
  "industry_instruction",
  "follow_up_strategy",
  "value_proposition_framing",
] as const
export type GrowthAiCopilotPlaybookRuleCategory =
  (typeof GROWTH_AI_COPILOT_PLAYBOOK_RULE_CATEGORIES)[number]

export const GROWTH_AI_COPILOT_PLAYBOOK_DRAFT_STATUSES = ["draft", "approved", "rejected"] as const
export type GrowthAiCopilotPlaybookDraftStatus =
  (typeof GROWTH_AI_COPILOT_PLAYBOOK_DRAFT_STATUSES)[number]

export const GROWTH_AI_COPILOT_PLAYBOOK_APPROVED_STATUSES = ["active", "superseded", "disabled"] as const
export type GrowthAiCopilotPlaybookApprovedStatus =
  (typeof GROWTH_AI_COPILOT_PLAYBOOK_APPROVED_STATUSES)[number]

export const GROWTH_AI_COPILOT_PLAYBOOK_EFFECTIVENESS_OUTCOMES = [
  "extracted",
  "approved",
  "rejected",
  "applied",
  "generation_approved",
  "generation_discarded",
  "conflict_detected",
] as const
export type GrowthAiCopilotPlaybookEffectivenessOutcome =
  (typeof GROWTH_AI_COPILOT_PLAYBOOK_EFFECTIVENESS_OUTCOMES)[number]

export type GrowthAiCopilotPlaybookIndustryScope = {
  appliesGlobally?: boolean
  industries?: string[]
  tags?: string[]
}

export type GrowthAiCopilotPlaybookTrainerProfile = {
  name?: string
  role?: string
  organization?: string
  styleNotes?: string
}

export type GrowthAiCopilotPlaybookConflict = {
  key: string
  ruleKeyA: string
  ruleKeyB: string
  category: string
  reason: string
  severity: "warning" | "critical"
}

export type GrowthAiCopilotPlaybookAttribution = {
  ruleIds: string[]
  sourceIds: string[]
  categories: string[]
  ruleTitles: string[]
  sourceTitles: string[]
  trainerProfiles: GrowthAiCopilotPlaybookTrainerProfile[]
  conflicts: GrowthAiCopilotPlaybookConflict[]
}

export type GrowthAiCopilotPlaybookSource = {
  id: string
  title: string
  sourceKind: GrowthAiCopilotPlaybookSourceKind
  sourceUrl: string | null
  rawContent: string | null
  contentHash: string | null
  metadata: Record<string, unknown>
  trainerProfile: GrowthAiCopilotPlaybookTrainerProfile
  industryScope: GrowthAiCopilotPlaybookIndustryScope
  storagePolicy: "principles_only" | "retain_source"
  status: GrowthAiCopilotPlaybookSourceStatus
  retainUntil: string | null
  parentSourceId: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthAiCopilotPlaybookExtraction = {
  id: string
  sourceId: string
  extractionVersion: string
  promptVariant: string
  inputSnapshot: Record<string, unknown>
  status: "running" | "succeeded" | "failed"
  draftRuleCount: number
  conflictCount: number
  conflicts: GrowthAiCopilotPlaybookConflict[]
  modelProvider: string | null
  modelName: string | null
  errorMessage: string | null
  createdBy: string | null
  createdAt: string
}

export type GrowthAiCopilotPlaybookDraftRule = {
  id: string
  extractionId: string
  sourceId: string
  category: GrowthAiCopilotPlaybookRuleCategory
  title: string
  principle: string
  appliesTo: GrowthAiCopilotGenerationType[]
  priority: number
  industryScope: GrowthAiCopilotPlaybookIndustryScope
  trainerProfile: GrowthAiCopilotPlaybookTrainerProfile
  metadata: Record<string, unknown>
  status: GrowthAiCopilotPlaybookDraftStatus
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
}

export type GrowthAiCopilotPlaybookApprovedRule = {
  id: string
  ruleKey: string
  category: GrowthAiCopilotPlaybookRuleCategory
  title: string
  principle: string
  appliesTo: GrowthAiCopilotGenerationType[]
  priority: number
  version: number
  industryScope: GrowthAiCopilotPlaybookIndustryScope
  trainerProfile: GrowthAiCopilotPlaybookTrainerProfile
  status: GrowthAiCopilotPlaybookApprovedStatus
  sourceId: string | null
  approvedBy: string | null
  approvedAt: string | null
  supersededAt: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthAiCopilotPlaybookResolvedRule = GrowthAiCopilotPlaybookApprovedRule & {
  sourceTitle?: string | null
}

export type GrowthAiCopilotPlaybookResolvedRule = GrowthAiCopilotPlaybookApprovedRule & {
  sourceTitle?: string | null
}

export const GROWTH_AI_COPILOT_PLAYBOOK_EXTRACTION_VERSION = "6.1A-v1" as const

export function slugifyPlaybookRuleKey(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64)
}
