/**
 * GE-IRE-7B — Sanitized Prospect Qualification view model for UI/API.
 */

import {
  buildProspectQualification,
  type ProspectQualificationEngineDependencies,
  type ProspectQualificationEngineInput,
  type ProspectQualificationProspectIntelligence,
} from "@/lib/growth/contact-verification/prospect-qualification-engine"
import {
  GROWTH_PROSPECT_QUALIFICATION_PANEL_QA_MARKER,
  isProspectQualificationEnabled,
} from "@/lib/growth/contact-verification/prospect-qualification-feature"
import type { ProspectQualification } from "@/lib/growth/contact-verification/prospect-qualification-types"
import { mapProspectSearchIntelligenceToAcquisitionInput } from "@/lib/growth/contact-verification/contact-acquisition-view"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

const PLAINTEXT_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const LINKEDIN_URL_PATTERN = /linkedin\.com/i
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/

export type ProspectQualificationView = {
  qa_marker: typeof GROWTH_PROSPECT_QUALIFICATION_PANEL_QA_MARKER
  company_id: string
  generated_at: string
  qualification: string
  overall_score: number
  confidence: number
  fit_score: number
  contact_score: number
  engagement_score: number
  buying_committee_coverage: number
  strengths: string[]
  risks: string[]
  recommendations: string[]
  blockers: string[]
  next_action: string
  primary_contact_name: string
  primary_contact_role: string
}

export type ProspectQualificationApiResponse = {
  ok: boolean
  enabled: boolean
  view?: ProspectQualificationView
  message?: string
}

export type ProspectQualificationViewBuildInput = ProspectQualificationEngineInput & {
  visibleEmails?: string[]
}

function sanitizeViewString(value: string): string {
  let sanitized = value
  sanitized = sanitized.replace(PLAINTEXT_EMAIL_PATTERN, "[redacted_email]")
  sanitized = sanitized.replace(LINKEDIN_URL_PATTERN, "[redacted_linkedin]")
  sanitized = sanitized.replace(PHONE_PATTERN, "[redacted_phone]")
  return sanitized
}

export function sanitizeProspectQualificationView(
  qualification: ProspectQualification,
): ProspectQualificationView {
  return {
    qa_marker: GROWTH_PROSPECT_QUALIFICATION_PANEL_QA_MARKER,
    company_id: qualification.companyId,
    generated_at: qualification.generatedAt,
    qualification: qualification.qualification,
    overall_score: qualification.overallScore,
    confidence: qualification.confidence,
    fit_score: qualification.fitScore,
    contact_score: qualification.contactScore,
    engagement_score: qualification.engagementScore,
    buying_committee_coverage: qualification.buyingCommitteeCoverage,
    strengths: qualification.strengths.map(sanitizeViewString),
    risks: qualification.risks.map(sanitizeViewString),
    recommendations: qualification.recommendations.map(sanitizeViewString),
    blockers: qualification.blockers.map(sanitizeViewString),
    next_action: qualification.nextAction,
    primary_contact_name: qualification.acquisitionCandidate.primaryContact.fullName,
    primary_contact_role: qualification.acquisitionCandidate.committee.role,
  }
}

export async function buildProspectQualificationView(
  input: ProspectQualificationViewBuildInput,
  dependencies: ProspectQualificationEngineDependencies = {},
): Promise<ProspectQualificationView | null> {
  if (!isProspectQualificationEnabled()) return null

  const { visibleEmails: _visibleEmails, ...engineInput } = input
  if (!engineInput.acquisitionCandidate && !engineInput.acquisitionInput?.contacts.length) {
    return null
  }

  const qualification = await buildProspectQualification(engineInput, {
    skipDns: true,
    ...dependencies,
  })

  return sanitizeProspectQualificationView(qualification)
}

export function mapProspectSearchIntelligenceToQualificationContext(input: {
  companyId: string
  companyName?: string | null
  website?: string | null
  industry?: string | null
  companyMatchConfidence?: number | null
  isSuppressed?: boolean
  suppressionReason?: string | null
  intelligence: GrowthProspectSearchContactIntelligence
}): {
  acquisitionInput: NonNullable<ReturnType<typeof mapProspectSearchIntelligenceToAcquisitionInput>>
  prospectIntelligence: ProspectQualificationProspectIntelligence
} | null {
  const acquisitionInput = mapProspectSearchIntelligenceToAcquisitionInput({
    companyId: input.companyId,
    companyName: input.companyName,
    website: input.website,
    industry: input.industry,
    intelligence: input.intelligence,
  })
  if (!acquisitionInput) return null

  const primary = input.intelligence.contacts.find(
    (contact) => contact.id === input.intelligence.first_contact?.contact_id,
  ) ?? input.intelligence.contacts[0]

  return {
    acquisitionInput,
    prospectIntelligence: {
      companyName: input.companyName ?? undefined,
      domain: acquisitionInput.domain,
      industry: input.industry ?? undefined,
      companyMatchConfidence: input.companyMatchConfidence ?? null,
      committeeCompletenessPct: input.intelligence.committee_completeness_pct,
      isSuppressed: input.isSuppressed,
      suppressionReason: input.suppressionReason ?? null,
      outreachReadinessScore:
        input.intelligence.company_contact_coverage?.outreach_readiness_score ?? null,
      personaCompleteness:
        input.intelligence.company_contact_coverage?.persona_completeness ?? null,
      hasPhoneOnPrimary: Boolean(primary?.phone?.trim()),
      contactCount: input.intelligence.contacts.length,
      verifiedContactCount: input.intelligence.contacts.filter((contact) =>
        (contact.verification_status ?? "").includes("verified"),
      ).length,
    },
  }
}

export function assertProspectQualificationViewHasNoSensitiveData(
  output: unknown,
  options: { allowEmails?: string[] } = {},
): boolean {
  const payload =
    output && typeof output === "object"
      ? { ...(output as Record<string, unknown>), generated_at: "[redacted_timestamp]" }
      : output
  const text = JSON.stringify(payload)
  const allowed = new Set((options.allowEmails ?? []).map((email) => email.trim().toLowerCase()))

  const emails = text.match(new RegExp(PLAINTEXT_EMAIL_PATTERN.source, "gi")) ?? []
  for (const email of emails) {
    if (!allowed.has(email.toLowerCase())) return false
  }

  if (LINKEDIN_URL_PATTERN.test(text)) return false
  if (PHONE_PATTERN.test(text)) return false
  if (text.includes("acquisitionCandidate")) return false
  return true
}
