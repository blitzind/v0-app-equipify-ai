/**
 * GE-IRE-7C — Sanitized Sequence Recommendation view model for UI/API.
 */

import {
  buildSequenceRecommendation,
  type SequenceRecommendationEngineDependencies,
  type SequenceRecommendationEngineInput,
} from "@/lib/growth/contact-verification/sequence-recommendation-engine"
import {
  GROWTH_SEQUENCE_RECOMMENDATION_PANEL_QA_MARKER,
  isSequenceRecommendationEnabled,
} from "@/lib/growth/contact-verification/sequence-recommendation-feature"
import type { SequenceRecommendation } from "@/lib/growth/contact-verification/sequence-recommendation-types"
import { mapProspectSearchIntelligenceToQualificationContext } from "@/lib/growth/contact-verification/prospect-qualification-view"
import type { ProspectQualification } from "@/lib/growth/contact-verification/prospect-qualification-types"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

const PLAINTEXT_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const LINKEDIN_URL_PATTERN = /linkedin\.com/i
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/

export type SequenceRecommendationCadenceView = {
  intensity: string
  suggested_touch_count: number
  suggested_duration_days: number
}

export type SequenceRecommendationPersonalizationView = {
  primary_reason: string
  company_context?: string
  contact_context?: string
  buying_committee_context?: string
  risk_context?: string
}

export type SequenceRecommendationView = {
  qa_marker: typeof GROWTH_SEQUENCE_RECOMMENDATION_PANEL_QA_MARKER
  company_id: string
  generated_at: string
  recommended_sequence: {
    name: string
    type: string
    confidence: number
  }
  enrollment_readiness: string
  preferred_channel: string
  cadence: SequenceRecommendationCadenceView
  personalization_inputs: SequenceRecommendationPersonalizationView
  reasons: string[]
  risks: string[]
  blockers: string[]
  next_action: string
  confidence: number
}

export type SequenceRecommendationApiResponse = {
  ok: boolean
  enabled: boolean
  view?: SequenceRecommendationView
  message?: string
}

export type SequenceRecommendationViewBuildInput = SequenceRecommendationEngineInput

function sanitizeViewString(value: string): string {
  let sanitized = value
  sanitized = sanitized.replace(PLAINTEXT_EMAIL_PATTERN, "[redacted_email]")
  sanitized = sanitized.replace(LINKEDIN_URL_PATTERN, "[redacted_linkedin]")
  sanitized = sanitized.replace(PHONE_PATTERN, "[redacted_phone]")
  return sanitized
}

export function sanitizeSequenceRecommendationView(
  recommendation: SequenceRecommendation,
): SequenceRecommendationView {
  return {
    qa_marker: GROWTH_SEQUENCE_RECOMMENDATION_PANEL_QA_MARKER,
    company_id: recommendation.companyId,
    generated_at: recommendation.generatedAt,
    recommended_sequence: {
      name: sanitizeViewString(recommendation.recommendedSequence.name),
      type: recommendation.recommendedSequence.type,
      confidence: recommendation.recommendedSequence.confidence,
    },
    enrollment_readiness: recommendation.enrollmentReadiness,
    preferred_channel: recommendation.preferredChannel,
    cadence: {
      intensity: recommendation.cadence.intensity,
      suggested_touch_count: recommendation.cadence.suggestedTouchCount,
      suggested_duration_days: recommendation.cadence.suggestedDurationDays,
    },
    personalization_inputs: {
      primary_reason: sanitizeViewString(recommendation.personalizationInputs.primaryReason),
      company_context: recommendation.personalizationInputs.companyContext
        ? sanitizeViewString(recommendation.personalizationInputs.companyContext)
        : undefined,
      contact_context: recommendation.personalizationInputs.contactContext
        ? sanitizeViewString(recommendation.personalizationInputs.contactContext)
        : undefined,
      buying_committee_context: recommendation.personalizationInputs.buyingCommitteeContext
        ? sanitizeViewString(recommendation.personalizationInputs.buyingCommitteeContext)
        : undefined,
      risk_context: recommendation.personalizationInputs.riskContext
        ? sanitizeViewString(recommendation.personalizationInputs.riskContext)
        : undefined,
    },
    reasons: recommendation.reasons.map(sanitizeViewString),
    risks: recommendation.risks.map(sanitizeViewString),
    blockers: recommendation.blockers.map(sanitizeViewString),
    next_action: recommendation.nextAction,
    confidence: recommendation.confidence,
  }
}

export async function buildSequenceRecommendationView(
  input: SequenceRecommendationViewBuildInput,
  dependencies: SequenceRecommendationEngineDependencies = {},
): Promise<SequenceRecommendationView | null> {
  if (!isSequenceRecommendationEnabled()) return null

  const hasQualification = Boolean(input.qualification)
  const hasQualificationInput =
    Boolean(input.qualificationInput?.acquisitionCandidate) ||
    Boolean(input.qualificationInput?.acquisitionInput?.contacts.length)

  if (!hasQualification && !hasQualificationInput) return null

  const recommendation = await buildSequenceRecommendation(input, {
    skipDns: true,
    ...dependencies,
  })

  return sanitizeSequenceRecommendationView(recommendation)
}

export function mapProspectSearchIntelligenceToSequenceInput(input: {
  companyId: string
  companyName?: string | null
  website?: string | null
  industry?: string | null
  companyMatchConfidence?: number | null
  isSuppressed?: boolean
  suppressionReason?: string | null
  intelligence: GrowthProspectSearchContactIntelligence
  qualification?: ProspectQualification
}): SequenceRecommendationEngineInput | null {
  if (input.qualification) {
    return {
      companyId: input.companyId,
      qualification: input.qualification,
    }
  }

  const mapped = mapProspectSearchIntelligenceToQualificationContext({
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
    qualificationInput: {
      companyId: input.companyId,
      acquisitionInput: mapped.acquisitionInput,
      prospectIntelligence: mapped.prospectIntelligence,
    },
  }
}

export function assertSequenceRecommendationViewHasNoSensitiveData(output: unknown): boolean {
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
  return true
}
