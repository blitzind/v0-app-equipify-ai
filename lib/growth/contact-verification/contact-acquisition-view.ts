/**
 * GE-IRE-7A — Sanitized Acquisition Candidate view model for UI/API.
 */

import {
  buildAcquisitionCandidate,
  type ContactAcquisitionEngineDependencies,
  type ContactAcquisitionEngineInput,
} from "@/lib/growth/contact-verification/contact-acquisition-engine"
import {
  GROWTH_CONTACT_ACQUISITION_PANEL_QA_MARKER,
  isContactAcquisitionEnabled,
} from "@/lib/growth/contact-verification/contact-acquisition-feature"
import type { AcquisitionCandidate } from "@/lib/growth/contact-verification/contact-acquisition-types"
import { maskEmailForPreview } from "@/lib/growth/contact-verification/contact-engagement-prediction"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

const PLAINTEXT_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const LINKEDIN_URL_PATTERN = /linkedin\.com/i
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/

export type AcquisitionCandidatePrimaryView = {
  person_id?: string
  full_name: string
  title?: string
  email?: string | null
  email_present: boolean
  confidence: number
}

export type AcquisitionCandidateVerificationView = {
  email_verified: boolean
  deliverability: string
  confidence: number
}

export type AcquisitionCandidateCommitteeView = {
  role: string
  confidence: number
}

export type AcquisitionCandidateOutreachView = {
  readiness: string
  preferred_channel: string
  recommended_sequence?: string
}

export type AcquisitionCandidateBackupView = {
  name: string
  title?: string
  role: string
  email?: string | null
  email_present: boolean
  confidence: number
  reason_selected: string
}

export type AcquisitionCandidateView = {
  qa_marker: typeof GROWTH_CONTACT_ACQUISITION_PANEL_QA_MARKER
  company_id: string
  generated_at: string
  primary_contact: AcquisitionCandidatePrimaryView
  verification: AcquisitionCandidateVerificationView
  committee: AcquisitionCandidateCommitteeView
  outreach: AcquisitionCandidateOutreachView
  backup_contacts: AcquisitionCandidateBackupView[]
  blockers: string[]
  reasons: string[]
  overall_confidence: number
}

export type AcquisitionCandidateApiResponse = {
  ok: boolean
  enabled: boolean
  view?: AcquisitionCandidateView
  message?: string
}

export type AcquisitionCandidateViewBuildInput = ContactAcquisitionEngineInput & {
  visibleEmails?: string[]
  generatedAt?: string
}

function normalizeVisibleEmails(emails: string[] | undefined): Set<string> {
  return new Set(
    (emails ?? [])
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

function formatEmailForView(
  email: string | null | undefined,
  visibleEmails: Set<string>,
): { value: string | null; present: boolean } {
  const trimmed = email?.trim()
  if (!trimmed) return { value: null, present: false }
  if (visibleEmails.has(trimmed.toLowerCase())) {
    return { value: trimmed, present: true }
  }
  return { value: maskEmailForPreview(trimmed), present: true }
}

function sanitizeViewString(value: string): string {
  let sanitized = value
  sanitized = sanitized.replace(PLAINTEXT_EMAIL_PATTERN, "[redacted_email]")
  sanitized = sanitized.replace(LINKEDIN_URL_PATTERN, "[redacted_linkedin]")
  sanitized = sanitized.replace(PHONE_PATTERN, "[redacted_phone]")
  return sanitized
}

export function sanitizeAcquisitionCandidateView(
  candidate: AcquisitionCandidate,
  options: { visibleEmails?: string[] } = {},
): AcquisitionCandidateView {
  const visibleEmails = normalizeVisibleEmails(options.visibleEmails)
  const primaryEmail = formatEmailForView(candidate.primaryContact.email, visibleEmails)

  return {
    qa_marker: GROWTH_CONTACT_ACQUISITION_PANEL_QA_MARKER,
    company_id: candidate.companyId,
    generated_at: candidate.generatedAt,
    primary_contact: {
      person_id: candidate.primaryContact.personId,
      full_name: candidate.primaryContact.fullName,
      title: candidate.primaryContact.title,
      email: primaryEmail.value,
      email_present: primaryEmail.present,
      confidence: candidate.primaryContact.confidence,
    },
    verification: {
      email_verified: candidate.verification.emailVerified,
      deliverability: candidate.verification.deliverability,
      confidence: candidate.verification.confidence,
    },
    committee: {
      role: candidate.committee.role,
      confidence: candidate.committee.confidence,
    },
    outreach: {
      readiness: candidate.outreach.readiness,
      preferred_channel: candidate.outreach.preferredChannel,
      recommended_sequence: candidate.outreach.recommendedSequence
        ? sanitizeViewString(candidate.outreach.recommendedSequence)
        : undefined,
    },
    backup_contacts: candidate.backupContacts.map((backup) => {
      const email = formatEmailForView(backup.email, visibleEmails)
      return {
        name: backup.name,
        title: backup.title,
        role: backup.role,
        email: email.value,
        email_present: email.present,
        confidence: backup.confidence,
        reason_selected: sanitizeViewString(backup.reasonSelected),
      }
    }),
    blockers: candidate.blockers.map(sanitizeViewString),
    reasons: candidate.reasons
      .filter((reason) => !/\bscore\s*:/i.test(reason) && !/\bscore\s+\d/i.test(reason))
      .map(sanitizeViewString),
    overall_confidence: candidate.overallConfidence,
  }
}

export async function buildAcquisitionCandidateView(
  input: AcquisitionCandidateViewBuildInput,
  dependencies: ContactAcquisitionEngineDependencies = {},
): Promise<AcquisitionCandidateView | null> {
  if (!isContactAcquisitionEnabled()) return null
  if (!input.contacts.length) return null

  const { visibleEmails, generatedAt, ...engineInput } = input
  const candidate = await buildAcquisitionCandidate(
    {
      ...engineInput,
      generatedAt,
    },
    { skipDns: true, ...dependencies },
  )

  return sanitizeAcquisitionCandidateView(candidate, { visibleEmails })
}

function splitDisplayName(name: string | null | undefined): {
  firstName?: string
  lastName?: string
  fullName?: string
} {
  const trimmed = name?.trim()
  if (!trimmed) return {}
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { fullName: trimmed }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
    fullName: trimmed,
  }
}

export function mapProspectSearchIntelligenceToAcquisitionInput(input: {
  companyId: string
  companyName?: string | null
  website?: string | null
  industry?: string | null
  intelligence: GrowthProspectSearchContactIntelligence
}): ContactAcquisitionEngineInput | null {
  if (!input.intelligence.has_contacts || input.intelligence.contacts.length === 0) {
    return null
  }

  let domain: string | undefined
  if (input.website?.trim()) {
    try {
      const url = input.website.startsWith("http")
        ? new URL(input.website)
        : new URL(`https://${input.website}`)
      domain = url.hostname.replace(/^www\./, "")
    } catch {
      domain = input.website.replace(/^https?:\/\//, "").split("/")[0]?.trim() || undefined
    }
  }

  return {
    companyId: input.companyId,
    companyName: input.companyName ?? undefined,
    domain,
    industry: input.industry ?? undefined,
    contacts: input.intelligence.contacts.map((contact) => {
      const nameParts = splitDisplayName(contact.name)
      return {
        personId: contact.id,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        fullName: nameParts.fullName ?? contact.name,
        email: contact.email ?? undefined,
        jobTitle: contact.title ?? undefined,
        phone: contact.phone ?? undefined,
        linkedinUrl: contact.linkedin_url ?? undefined,
        confidence: contact.confidence,
        source: contact.source_label ?? undefined,
      }
    }),
  }
}

export function assertAcquisitionCandidateViewHasNoSensitiveData(
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
  return true
}
