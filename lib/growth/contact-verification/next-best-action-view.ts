/**
 * GE-IRE-7D — Sanitized Next Best Action view model for UI/API.
 */

import {
  buildNextBestAction,
  type NextBestActionEngineDependencies,
  type NextBestActionEngineInput,
} from "@/lib/growth/contact-verification/next-best-action-engine"
import {
  GROWTH_NEXT_BEST_ACTION_PANEL_QA_MARKER,
  isNextBestActionEnabled,
} from "@/lib/growth/contact-verification/next-best-action-feature"
import type { NextBestAction } from "@/lib/growth/contact-verification/next-best-action-types"
import { mapProspectSearchIntelligenceToSequenceInput } from "@/lib/growth/contact-verification/sequence-recommendation-view"
import type { ProspectQualification } from "@/lib/growth/contact-verification/prospect-qualification-types"
import type { SequenceRecommendation } from "@/lib/growth/contact-verification/sequence-recommendation-types"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

const PLAINTEXT_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const LINKEDIN_URL_PATTERN = /linkedin\.com/i
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/

export type NextBestActionView = {
  qa_marker: typeof GROWTH_NEXT_BEST_ACTION_PANEL_QA_MARKER
  company_id: string
  generated_at: string
  action: string
  priority: string
  confidence: number
  execution_readiness: string
  recommended_sequence?: {
    name: string
  }
  recommended_channel: string
  recommended_delay_label: string
  reasons: string[]
  blockers: string[]
  dependencies: string[]
  warnings: string[]
}

export type NextBestActionApiResponse = {
  ok: boolean
  enabled: boolean
  view?: NextBestActionView
  message?: string
}

export type NextBestActionViewBuildInput = NextBestActionEngineInput

function sanitizeViewString(value: string): string {
  let sanitized = value
  sanitized = sanitized.replace(PLAINTEXT_EMAIL_PATTERN, "[redacted_email]")
  sanitized = sanitized.replace(LINKEDIN_URL_PATTERN, "[redacted_linkedin]")
  sanitized = sanitized.replace(PHONE_PATTERN, "[redacted_phone]")
  return sanitized
}

export function formatNextBestActionDelayLabel(delayHours: number | undefined): string {
  if (delayHours == null) return "Never"
  if (delayHours === 0) return "Immediately"
  if (delayHours === 24) return "24 hours"
  if (delayHours === 72) return "72 hours"
  if (delayHours === 168) return "7 days"
  if (delayHours === 720) return "30 days"
  if (delayHours < 24) return `${delayHours} hours`
  const days = Math.round(delayHours / 24)
  return `${days} days`
}

export function sanitizeNextBestActionView(action: NextBestAction): NextBestActionView {
  return {
    qa_marker: GROWTH_NEXT_BEST_ACTION_PANEL_QA_MARKER,
    company_id: action.companyId,
    generated_at: action.generatedAt,
    action: action.action,
    priority: action.priority,
    confidence: action.confidence,
    execution_readiness: action.executionReadiness,
    recommended_sequence: action.recommendedSequence
      ? { name: sanitizeViewString(action.recommendedSequence.name) }
      : undefined,
    recommended_channel: action.recommendedChannel,
    recommended_delay_label: formatNextBestActionDelayLabel(action.recommendedDelayHours),
    reasons: action.reasons.map(sanitizeViewString),
    blockers: action.blockers.map(sanitizeViewString),
    dependencies: action.dependencies.map(sanitizeViewString),
    warnings: action.warnings.map(sanitizeViewString),
  }
}

export async function buildNextBestActionView(
  input: NextBestActionViewBuildInput,
  dependencies: NextBestActionEngineDependencies = {},
): Promise<NextBestActionView | null> {
  if (!isNextBestActionEnabled()) return null

  const hasQualification = Boolean(input.qualification)
  const hasSequence = Boolean(input.sequenceRecommendation)
  const hasQualificationInput =
    Boolean(input.qualificationInput?.acquisitionCandidate) ||
    Boolean(input.qualificationInput?.acquisitionInput?.contacts.length)

  if (!hasQualification && !hasSequence && !hasQualificationInput) return null

  const result = await buildNextBestAction(input, { skipDns: true, ...dependencies })
  return sanitizeNextBestActionView(result)
}

export function mapProspectSearchIntelligenceToNextBestActionInput(input: {
  companyId: string
  companyName?: string | null
  website?: string | null
  industry?: string | null
  companyMatchConfidence?: number | null
  isSuppressed?: boolean
  suppressionReason?: string | null
  intelligence: GrowthProspectSearchContactIntelligence
  qualification?: ProspectQualification
  sequenceRecommendation?: SequenceRecommendation
}): NextBestActionEngineInput | null {
  if (input.qualification || input.sequenceRecommendation) {
    return {
      companyId: input.companyId,
      qualification: input.qualification,
      sequenceRecommendation: input.sequenceRecommendation,
    }
  }

  const mapped = mapProspectSearchIntelligenceToSequenceInput({
    companyId: input.companyId,
    companyName: input.companyName,
    website: input.website,
    industry: input.industry,
    companyMatchConfidence: input.companyMatchConfidence,
    isSuppressed: input.isSuppressed,
    suppressionReason: input.suppressionReason,
    intelligence: input.intelligence,
  })
  if (!mapped) return null

  return {
    companyId: input.companyId,
    qualificationInput: mapped.qualificationInput,
  }
}

export function assertNextBestActionViewHasNoSensitiveData(output: unknown): boolean {
  const payload =
    output && typeof output === "object"
      ? { ...(output as Record<string, unknown>), generated_at: "[redacted_timestamp]" }
      : output
  const text = JSON.stringify(payload)

  if (PLAINTEXT_EMAIL_PATTERN.test(text)) return false
  if (LINKEDIN_URL_PATTERN.test(text)) return false
  if (PHONE_PATTERN.test(text)) return false
  if (text.includes("acquisitionCandidate")) return false
  if (/"qualification"\s*:/.test(text)) return false
  if (/"sequenceRecommendation"\s*:/.test(text)) return false
  return true
}
