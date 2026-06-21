/** GS-AI-PLAYBOOK-1D — Personalization generation UX helpers (client-safe). */

import type {
  GrowthPersonalizationGeneration,
  GrowthPersonalizationOperatorGenerationMetadata,
  GrowthPersonalizationRegenerationFeedbackCategory,
} from "@/lib/growth/personalization/personalization-types"
import {
  GROWTH_PERSONALIZATION_GENERATION_UX_QA_MARKER,
  GROWTH_PERSONALIZATION_REGENERATION_FEEDBACK_OPTIONS,
} from "@/lib/growth/personalization/personalization-types"

export {
  GROWTH_PERSONALIZATION_GENERATION_UX_QA_MARKER,
  GROWTH_PERSONALIZATION_REGENERATION_FEEDBACK_OPTIONS,
}
export type { GrowthPersonalizationOperatorGenerationMetadata, GrowthPersonalizationRegenerationFeedbackCategory }

export const GROWTH_PERSONALIZATION_RECENT_LEADS_STORAGE_KEY =
  "growth-personalization-recent-leads-v1" as const

export const GROWTH_PERSONALIZATION_LAST_LEAD_STORAGE_KEY =
  "growth-personalization-last-lead-v1" as const

export const GROWTH_PERSONALIZATION_LEAD_SEARCH_DEBOUNCE_MS = 300

export type GrowthPersonalizationRecentLeadSelection = {
  leadId: string
  companyName: string
  contactName?: string | null
  industryLabel?: string | null
  territoryLabel?: string | null
  email?: string | null
  lastSelectedAt: string
}

export type GrowthPersonalizationGenerationVersionEntry = GrowthPersonalizationGeneration & {
  versionNumber: number
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuidLike(value: string): boolean {
  return UUID_RE.test(value.trim())
}

export function buildGrowthPersonalizationWorkspaceHref(input?: {
  leadId?: string | null
  generationId?: string | null
}): string {
  const params = new URLSearchParams()
  if (input?.leadId?.trim()) params.set("leadId", input.leadId.trim())
  if (input?.generationId?.trim()) params.set("generationId", input.generationId.trim())
  const query = params.toString()
  return query
    ? `/admin/growth/copilot/personalization?${query}`
    : "/admin/growth/copilot/personalization"
}

export function regenerationFeedbackLabel(
  category: GrowthPersonalizationRegenerationFeedbackCategory,
): string {
  switch (category) {
    case "too_generic":
      return "Too generic"
    case "wrong_industry_assumptions":
      return "Wrong industry assumptions"
    case "too_salesy":
      return "Too salesy"
    case "not_enough_personalization":
      return "Not enough personalization"
    case "missing_company_context":
      return "Missing company context"
    case "custom":
      return "Custom feedback"
    default:
      return category.replace(/_/g, " ")
  }
}

export function assignGenerationVersionNumbers(
  generations: GrowthPersonalizationGeneration[],
): GrowthPersonalizationGenerationVersionEntry[] {
  const sorted = [...generations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const count = sorted.length
  return sorted.map((generation, index) => ({
    ...generation,
    versionNumber: count - index,
  }))
}

export function readRecentPersonalizationLeads(): GrowthPersonalizationRecentLeadSelection[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(GROWTH_PERSONALIZATION_RECENT_LEADS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GrowthPersonalizationRecentLeadSelection[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry) => typeof entry.leadId === "string" && entry.leadId.length > 0)
  } catch {
    return []
  }
}

export function persistRecentPersonalizationLead(
  selection: Omit<GrowthPersonalizationRecentLeadSelection, "lastSelectedAt">,
): GrowthPersonalizationRecentLeadSelection[] {
  if (typeof window === "undefined") return []
  const entry: GrowthPersonalizationRecentLeadSelection = {
    ...selection,
    lastSelectedAt: new Date().toISOString(),
  }
  const deduped = [
    entry,
    ...readRecentPersonalizationLeads().filter((item) => item.leadId !== entry.leadId),
  ].slice(0, 8)
  window.localStorage.setItem(GROWTH_PERSONALIZATION_RECENT_LEADS_STORAGE_KEY, JSON.stringify(deduped))
  window.localStorage.setItem(GROWTH_PERSONALIZATION_LAST_LEAD_STORAGE_KEY, entry.leadId)
  return deduped
}

export function readLastPersonalizationLeadId(): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(GROWTH_PERSONALIZATION_LAST_LEAD_STORAGE_KEY)
}

export function parsePersonalizationOperatorMetadata(
  metadata: unknown,
): GrowthPersonalizationOperatorGenerationMetadata | null {
  if (!metadata || typeof metadata !== "object") return null
  const raw = metadata as Record<string, unknown>
  const result: GrowthPersonalizationOperatorGenerationMetadata = {}

  if (typeof raw.prior_generation_id === "string") {
    result.prior_generation_id = raw.prior_generation_id
  }

  const regeneration = raw.regeneration_feedback
  if (regeneration && typeof regeneration === "object") {
    const entry = regeneration as Record<string, unknown>
    const category = entry.category
    if (
      typeof category === "string" &&
      (GROWTH_PERSONALIZATION_REGENERATION_FEEDBACK_OPTIONS as readonly string[]).includes(category)
    ) {
      result.regeneration_feedback = {
        category: category as GrowthPersonalizationRegenerationFeedbackCategory,
        customNotes: typeof entry.customNotes === "string" ? entry.customNotes : null,
        recordedAt: typeof entry.recordedAt === "string" ? entry.recordedAt : undefined,
      }
    }
  }

  const rejection = raw.rejection_feedback
  if (rejection && typeof rejection === "object") {
    const entry = rejection as Record<string, unknown>
    const category = entry.category
    result.rejection_feedback = {
      category:
        typeof category === "string" &&
        (GROWTH_PERSONALIZATION_REGENERATION_FEEDBACK_OPTIONS as readonly string[]).includes(category)
          ? (category as GrowthPersonalizationRegenerationFeedbackCategory)
          : null,
      customNotes: typeof entry.customNotes === "string" ? entry.customNotes : null,
      recordedAt: typeof entry.recordedAt === "string" ? entry.recordedAt : undefined,
    }
  }

  return Object.keys(result).length > 0 ? result : null
}
