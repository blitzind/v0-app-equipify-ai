/** GS-AI-PLAYBOOK-1D — Personalization generation UX helpers (client-safe). */

export const GROWTH_PERSONALIZATION_WORKSPACE_PATH = "/growth/personalization" as const

export const GROWTH_PERSONALIZATION_LEGACY_ADMIN_PATH =
  "/admin/growth/copilot/personalization" as const

export const GROWTH_PERSONALIZATION_WORKSPACE_QA_MARKER =
  "growth-personalization-workspace-gs-ai-playbook-4d2-v1" as const

export const GROWTH_PERSONALIZATION_DIAGNOSTICS_PREFERENCES_STORAGE_KEY =
  "growth-personalization-diagnostics-prefs-v1" as const

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
    ? `${GROWTH_PERSONALIZATION_WORKSPACE_PATH}?${query}`
    : GROWTH_PERSONALIZATION_WORKSPACE_PATH
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

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+(?=[A-Z0-9"(\[])/

function normalizeDraftBody(body: string): string {
  return body.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}

function splitSentences(text: string): string[] {
  const normalized = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim()
  if (!normalized) return []
  const parts = normalized.split(SENTENCE_SPLIT_RE).map((entry) => entry.trim()).filter(Boolean)
  return parts.length > 0 ? parts : [normalized]
}

function groupSentences(sentences: string[], maxSentencesPerParagraph: number): string[] {
  if (sentences.length <= maxSentencesPerParagraph) return [sentences.join(" ")]
  const paragraphs: string[] = []
  for (let index = 0; index < sentences.length; index += maxSentencesPerParagraph) {
    paragraphs.push(sentences.slice(index, index + maxSentencesPerParagraph).join(" "))
  }
  return paragraphs
}

export function formatPersonalizationDraftBodyForDisplay(body: string): string {
  const normalized = normalizeDraftBody(body)
  if (!normalized) return ""

  if (normalized.includes("\n\n")) {
    return normalized
      .split(/\n\n+/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n\n")
  }

  const sentences = splitSentences(normalized)
  const maxPerParagraph = sentences.length <= 4 ? 2 : 3
  return groupSentences(sentences, maxPerParagraph).join("\n\n")
}

export function formatPersonalizationDraftTimestamp(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export type GrowthPersonalizationDiagnosticsSectionKey =
  | "intelligence"
  | "quality"
  | "reasoning"
  | "sequence"

export type GrowthPersonalizationDiagnosticsPreferences = Record<
  GrowthPersonalizationDiagnosticsSectionKey,
  boolean
>

export const GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS: GrowthPersonalizationDiagnosticsPreferences =
  {
    intelligence: true,
    quality: true,
    reasoning: false,
    sequence: false,
  }

export function readPersonalizationDiagnosticsPreferences(): GrowthPersonalizationDiagnosticsPreferences {
  if (typeof window === "undefined") return { ...GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS }
  try {
    const raw = window.localStorage.getItem(GROWTH_PERSONALIZATION_DIAGNOSTICS_PREFERENCES_STORAGE_KEY)
    if (!raw) return { ...GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<GrowthPersonalizationDiagnosticsPreferences>
    return {
      intelligence: parsed.intelligence ?? GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS.intelligence,
      quality: parsed.quality ?? GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS.quality,
      reasoning: parsed.reasoning ?? GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS.reasoning,
      sequence: parsed.sequence ?? GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS.sequence,
    }
  } catch {
    return { ...GROWTH_PERSONALIZATION_DIAGNOSTICS_DEFAULTS }
  }
}

export function persistPersonalizationDiagnosticsPreferences(
  preferences: GrowthPersonalizationDiagnosticsPreferences,
): GrowthPersonalizationDiagnosticsPreferences {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      GROWTH_PERSONALIZATION_DIAGNOSTICS_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    )
  }
  return preferences
}

export function togglePersonalizationDiagnosticsSection(
  section: GrowthPersonalizationDiagnosticsSectionKey,
): GrowthPersonalizationDiagnosticsPreferences {
  const current = readPersonalizationDiagnosticsPreferences()
  const next = { ...current, [section]: !current[section] }
  return persistPersonalizationDiagnosticsPreferences(next)
}
