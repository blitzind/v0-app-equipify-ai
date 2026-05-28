/** Reachable human scoring — primary contactability dimension. Client-safe. */

import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { ProspectSearchContactOverlay } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"

export const GROWTH_REACHABLE_HUMAN_PRIORITY_QA_MARKER = "growth-reachable-human-priority-v1" as const

export const PROSPECT_SEARCH_REACHABLE_HUMAN_LABELS = [
  "outreach_ready",
  "partial_contactability",
  "role_only",
  "generic_channel_only",
  "no_reachable_humans",
] as const

export type ProspectSearchReachableHumanLabel =
  (typeof PROSPECT_SEARCH_REACHABLE_HUMAN_LABELS)[number]

export type ProspectSearchReachableHumanSnapshot = {
  qa_marker: typeof GROWTH_REACHABLE_HUMAN_PRIORITY_QA_MARKER
  score: number
  label: ProspectSearchReachableHumanLabel
  verified_email_count: number
  verified_phone_count: number
  named_person_count: number
  role_confidence_avg: number | null
  evidence_quality_avg: number | null
  has_linkedin_reference: boolean
  reasons: string[]
  risks: string[]
}

function isVerifiedEmail(contact: ProspectSearchContactOverlay): boolean {
  const status = (contact.verification_status ?? "").toLowerCase()
  if (status.includes("verified") || status.includes("email_verified")) return true
  const depth = (contact.email_verification_depth ?? "").toLowerCase()
  return depth.includes("published") || depth.includes("verified")
}

function isVerifiedPhone(contact: ProspectSearchContactOverlay): boolean {
  const status = (contact.verification_status ?? "").toLowerCase()
  if (status.includes("phone_verified") || status.includes("verified_channels")) return true
  const depth = (contact.phone_verification_depth ?? "").toLowerCase()
  return depth.includes("published") || depth.includes("verified")
}

function isNamedPerson(contact: ProspectSearchContactOverlay): boolean {
  const name = contact.name?.trim() ?? ""
  if (!name || name.length < 2) return false
  if (/^(info|contact|sales|support|admin|office|hello|team)@/i.test(contact.email ?? "")) return false
  return !/^(info|contact|sales|support|admin|office|hello)$/i.test(name)
}

function isGenericChannel(contact: ProspectSearchContactOverlay): boolean {
  const emailClass = (contact.email_classification ?? "").toLowerCase()
  const phoneClass = (contact.phone_classification ?? "").toLowerCase()
  return (
    emailClass.includes("role") ||
    emailClass.includes("generic") ||
    phoneClass.includes("main") ||
    phoneClass.includes("generic")
  )
}

export function scoreProspectSearchReachableHumanFromContacts(
  contacts: ProspectSearchContactOverlay[],
): ProspectSearchReachableHumanSnapshot {
  const reasons: string[] = []
  const risks: string[] = []

  const verifiedEmails = contacts.filter((c) => c.email && isVerifiedEmail(c))
  const verifiedPhones = contacts.filter((c) => c.phone && isVerifiedPhone(c))
  const namedPeople = contacts.filter(isNamedPerson)
  const genericOnly =
    contacts.length > 0 &&
    contacts.every((c) => isGenericChannel(c) || !isNamedPerson(c))

  const roleScores = contacts
    .map((c) => c.confidence)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
  const role_confidence_avg =
    roleScores.length > 0
      ? Number((roleScores.reduce((a, b) => a + b, 0) / roleScores.length).toFixed(3))
      : null

  const evidenceScores = contacts
    .map((c) => c.evidence_quality_score)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
  const evidence_quality_avg =
    evidenceScores.length > 0
      ? Number((evidenceScores.reduce((a, b) => a + b, 0) / evidenceScores.length).toFixed(1))
      : null

  const has_linkedin_reference = contacts.some(
    (c) => Boolean(c.linkedin_url?.trim()) || Boolean(c.linkedin_reference_label?.trim()),
  )

  let score = 0
  if (verifiedEmails.length > 0) {
    score += 30
    reasons.push(`${verifiedEmails.length} verified email channel(s)`)
  }
  if (verifiedPhones.length > 0) {
    score += 25
    reasons.push(`${verifiedPhones.length} verified phone channel(s)`)
  }
  if (namedPeople.length > 0) {
    score += 20
    reasons.push(`${namedPeople.length} named person record(s)`)
  }
  if ((role_confidence_avg ?? 0) >= 0.7) {
    score += 10
    reasons.push("Strong role confidence")
  } else if ((role_confidence_avg ?? 0) >= 0.5) {
    score += 5
  }
  if ((evidence_quality_avg ?? 0) >= 70) {
    score += 10
    reasons.push("Strong public evidence quality")
  }
  if (has_linkedin_reference) {
    score += 5
    reasons.push("LinkedIn website reference observed")
  }
  if (contacts.some((c) => c.outreach_ready)) {
    score += 10
    reasons.push("At least one outreach-ready contact")
  }

  if (genericOnly) {
    score = Math.min(score, 25)
    risks.push("Only generic or role channels discovered")
  }
  if (contacts.length === 0) {
    risks.push("No contact evidence on account")
  }
  if (verifiedEmails.length === 0 && verifiedPhones.length === 0 && namedPeople.length > 0) {
    risks.push("Named people without verified channels")
  }

  score = Math.round(Math.min(100, Math.max(0, score)))

  let label: ProspectSearchReachableHumanLabel = "no_reachable_humans"
  if (score >= 75 && (verifiedEmails.length > 0 || verifiedPhones.length > 0) && namedPeople.length > 0) {
    label = "outreach_ready"
  } else if (score >= 45 && (verifiedEmails.length > 0 || verifiedPhones.length > 0 || namedPeople.length > 0)) {
    label = "partial_contactability"
  } else if (namedPeople.length > 0 && verifiedEmails.length === 0 && verifiedPhones.length === 0) {
    label = "role_only"
  } else if (genericOnly || (contacts.length > 0 && namedPeople.length === 0)) {
    label = "generic_channel_only"
  }

  return {
    qa_marker: GROWTH_REACHABLE_HUMAN_PRIORITY_QA_MARKER,
    score,
    label,
    verified_email_count: verifiedEmails.length,
    verified_phone_count: verifiedPhones.length,
    named_person_count: namedPeople.length,
    role_confidence_avg,
    evidence_quality_avg,
    has_linkedin_reference,
    reasons,
    risks,
  }
}

export function resolveProspectSearchReachableHumanScore(
  company: Pick<GrowthProspectSearchCompanyResult, "contact_intelligence" | "decision_maker_coverage"> & {
    decision_maker_count?: number | null
  },
): ProspectSearchReachableHumanSnapshot {
  const contacts = company.contact_intelligence?.contacts ?? []
  if (contacts.length > 0) {
    return scoreProspectSearchReachableHumanFromContacts(contacts)
  }

  const dmCount =
    company.contact_intelligence?.decision_maker_count ??
    (company.decision_maker_coverage != null
      ? Math.round(company.decision_maker_coverage * 5)
      : company.decision_maker_count ?? 0)

  if (dmCount > 0) {
    return {
      qa_marker: GROWTH_REACHABLE_HUMAN_PRIORITY_QA_MARKER,
      score: Math.min(40, 15 + dmCount * 8),
      label: dmCount >= 2 ? "partial_contactability" : "role_only",
      verified_email_count: 0,
      verified_phone_count: 0,
      named_person_count: dmCount,
      role_confidence_avg: null,
      evidence_quality_avg: null,
      has_linkedin_reference: false,
      reasons: [`${dmCount} indexed decision maker(s) — channels not yet hydrated`],
      risks: ["Contact channels require acquisition refresh"],
    }
  }

  return {
    qa_marker: GROWTH_REACHABLE_HUMAN_PRIORITY_QA_MARKER,
    score: 0,
    label: "no_reachable_humans",
    verified_email_count: 0,
    verified_phone_count: 0,
    named_person_count: 0,
    role_confidence_avg: null,
    evidence_quality_avg: null,
    has_linkedin_reference: false,
    reasons: [],
    risks: ["No reachable humans discovered — contact acquisition required"],
  }
}

export function hasProspectSearchReachableHumans(
  snapshot: ProspectSearchReachableHumanSnapshot,
): boolean {
  return (
    snapshot.label === "outreach_ready" ||
    snapshot.label === "partial_contactability" ||
    snapshot.label === "role_only"
  )
}
