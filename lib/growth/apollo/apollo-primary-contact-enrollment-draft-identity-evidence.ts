/** Apollo-Primary-4 draft identity + lead resolution evidence — client-safe. */

import { isApolloObfuscatedLastNameToken } from "@/lib/growth/providers/apollo/apollo-search-person-normalize"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type ApolloEnrollmentDraftIdentityGateResult = {
  allowed: boolean
  identity_source: string | null
  obfuscated_name: boolean
  email_present: boolean
  linkedin_present: boolean
  company_contact_id: string | null
  canonical_person_id: string | null
  contact_candidate_id: string | null
  confidence_reason: string | null
  blockers: string[]
}

export type ApolloPrimaryContactEnrollmentDraftLeadResolutionEvidence = {
  lead_resolution_step: string
  confidence_score: number | null
  confidence_reason: string | null
  identity_source: string | null
  company_contact_id: string | null
  canonical_person_id: string | null
  contact_candidate_id: string | null
  email_present: boolean
  linkedin_present: boolean
  obfuscated_name: boolean
  explicit_pattern_id: string | null
  preflight_code: string | null
}

export function isApolloObfuscatedEnrollmentDraftDisplayName(input: {
  full_name?: string | null
  metadata?: Record<string, unknown> | null
}): boolean {
  const metadata = input.metadata ?? {}
  if (metadata.apollo_last_name_obfuscated_present === true) return true
  if (asString(metadata.apollo_name_fields) === "last_name_obfuscated") return true

  const fullName = asString(input.full_name)
  if (!fullName) return false
  const words = fullName.split(/\s+/).filter(Boolean)
  const last = words[words.length - 1]
  return last ? isApolloObfuscatedLastNameToken(last) : false
}

export function evaluateApolloEnrollmentDraftIdentityGate(input: {
  queue_status: string
  sequence_ready: boolean
  company_contact_id: string | null
  contact_candidate_id: string | null
  canonical_person_id: string | null
  email: string | null
  email_status: string | null
  linkedin_url: string | null
  full_name?: string | null
  metadata?: Record<string, unknown> | null
}): ApolloEnrollmentDraftIdentityGateResult {
  const blockers: string[] = []
  const email = asString(input.email)
  const emailPresent = Boolean(email) && asString(input.email_status) !== "blocked"
  const linkedinPresent = Boolean(asString(input.linkedin_url))
  const obfuscatedName = isApolloObfuscatedEnrollmentDraftDisplayName({
    full_name: input.full_name,
    metadata: input.metadata,
  })

  if (input.queue_status !== "enrollment_approved") {
    blockers.push("enrollment_not_approved")
  }
  if (!input.sequence_ready) {
    blockers.push("sequence_not_ready")
  }
  if (!input.company_contact_id) {
    blockers.push("missing_company_contact_id")
  }
  if (!asString(input.canonical_person_id) && !asString(input.contact_candidate_id)) {
    blockers.push("missing_contact_identity_anchor")
  }
  if (!emailPresent && !linkedinPresent) {
    blockers.push("missing_verified_contact_channel")
  }

  let identity_source: string | null = null
  if (blockers.length === 0) {
    if (asString(input.canonical_person_id)) {
      identity_source = emailPresent
        ? "company_contact_id+canonical_person_id+email"
        : linkedinPresent
          ? "company_contact_id+canonical_person_id+linkedin"
          : "company_contact_id+canonical_person_id"
    } else if (asString(input.contact_candidate_id)) {
      identity_source = emailPresent
        ? "company_contact_id+contact_candidate_id+email"
        : "company_contact_id+contact_candidate_id+linkedin"
    }
  }

  const confidence_reason =
    blockers.length === 0
      ? obfuscatedName
        ? "Apollo-approved company_contact identity anchors present; obfuscated display name allowed."
        : "Apollo-approved company_contact identity anchors present."
      : `Identity gate blocked: ${blockers.join(", ")}`

  return {
    allowed: blockers.length === 0,
    identity_source,
    obfuscated_name: obfuscatedName,
    email_present: emailPresent,
    linkedin_present: linkedinPresent,
    company_contact_id: input.company_contact_id,
    canonical_person_id: asString(input.canonical_person_id) || null,
    contact_candidate_id: asString(input.contact_candidate_id) || null,
    confidence_reason,
    blockers,
  }
}

export function shouldUseApolloEnrollmentDraftExplicitPattern(input: {
  identity_gate: ApolloEnrollmentDraftIdentityGateResult
  requested_pattern_id?: string | null
}): boolean {
  if (asString(input.requested_pattern_id)) return true
  return input.identity_gate.allowed
}

export function resolveApolloEnrollmentDraftExplicitPatternId(input: {
  patterns: Array<{ id: string; key: string; isActive: boolean }>
  requested_pattern_id?: string | null
  identity_gate: ApolloEnrollmentDraftIdentityGateResult
}): string | null {
  const requested = asString(input.requested_pattern_id)
  if (requested) return requested
  if (!input.identity_gate.allowed) return null

  const active = input.patterns.filter((pattern) => pattern.isActive)
  const preferred =
    active.find((pattern) => pattern.key === "cold_email_only") ??
    active.find((pattern) => pattern.key === "email_then_call") ??
    active[0]
  return preferred?.id ?? null
}

export function buildApolloEnrollmentDraftLeadResolutionEvidence(input: {
  lead_resolution_step: string
  identity_gate: ApolloEnrollmentDraftIdentityGateResult
  recommended_sequence_confidence?: number | null
  recommended_sequence_reason?: string | null
  explicit_pattern_id?: string | null
  preflight_code?: string | null
  preflight_reason?: string | null
}): ApolloPrimaryContactEnrollmentDraftLeadResolutionEvidence {
  return {
    lead_resolution_step: input.lead_resolution_step,
    confidence_score: input.recommended_sequence_confidence ?? null,
    confidence_reason:
      input.preflight_reason ??
      input.recommended_sequence_reason ??
      input.identity_gate.confidence_reason,
    identity_source: input.identity_gate.identity_source,
    company_contact_id: input.identity_gate.company_contact_id,
    canonical_person_id: input.identity_gate.canonical_person_id,
    contact_candidate_id: input.identity_gate.contact_candidate_id,
    email_present: input.identity_gate.email_present,
    linkedin_present: input.identity_gate.linkedin_present,
    obfuscated_name: input.identity_gate.obfuscated_name,
    explicit_pattern_id: input.explicit_pattern_id ?? null,
    preflight_code: input.preflight_code ?? null,
  }
}
