import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateEmailDiscoveryVerificationCertification } from "@/lib/growth/email-discovery/email-discovery-certification"
import { runEmailDiscoveryForCanonicalPerson } from "@/lib/growth/email-discovery/email-discovery-orchestrator"
import { runSocialProfileDiscoveryForCanonicalPerson } from "@/lib/growth/social-profile-discovery/social-profile-discovery-orchestrator"

export const GROWTH_HUMAN_IDENTITY_CHANNEL_COMPLETION_QA_MARKER =
  "growth-human-identity-channel-completion-7-ps-hn-v1" as const

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

export type DiscoveredEmailAuditRow = {
  person_id: string
  email: string
  verification_status: string
  source: "person_emails" | "company_contacts" | "contact_candidates"
  provider_ready: boolean
  promotion_attempted: boolean
  promotion_result: string | null
}

export type LinkedInEvidenceAuditRow = {
  person_id: string
  linkedin_url: string
  source: "company_contacts" | "contact_candidates"
  discovery_attempted: boolean
  promoted_count: number
  result: string | null
}

export async function auditDiscoveredEmailsForPerson(
  admin: SupabaseClient,
  input: { person_id: string; company_id: string; attempt_verification?: boolean },
): Promise<DiscoveredEmailAuditRow[]> {
  const cert = evaluateEmailDiscoveryVerificationCertification()
  const rows: DiscoveredEmailAuditRow[] = []
  const seen = new Set<string>()

  const sources: Array<{
    source: DiscoveredEmailAuditRow["source"]
    table: "person_emails" | "company_contacts" | "contact_candidates"
    filter: Record<string, string>
  }> = [
    { source: "person_emails", table: "person_emails", filter: { person_id: input.person_id } },
  ]

  const { data: companyContact } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("email, contact_candidate_id")
    .eq("canonical_person_id", input.person_id)
    .maybeSingle()

  if (companyContact?.email) {
    rows.push({
      person_id: input.person_id,
      email: asString(companyContact.email),
      verification_status: "discovered",
      source: "company_contacts",
      provider_ready: cert.zerobounce_configured,
      promotion_attempted: false,
      promotion_result: cert.zerobounce_configured ? null : "config_blocked: ZeroBounce not configured",
    })
    seen.add(asString(companyContact.email).toLowerCase())
  }

  const { data: personEmails } = await admin
    .schema("growth")
    .from("person_emails")
    .select("email, verification_status")
    .eq("person_id", input.person_id)

  for (const row of personEmails ?? []) {
    const email = asString(row.email)
    if (!email || seen.has(email.toLowerCase())) continue
    seen.add(email.toLowerCase())
    rows.push({
      person_id: input.person_id,
      email,
      verification_status: asString(row.verification_status) || "unknown",
      source: "person_emails",
      provider_ready: cert.zerobounce_configured,
      promotion_attempted: false,
      promotion_result: null,
    })
  }

  if (input.attempt_verification && cert.zerobounce_configured) {
    try {
      const result = await runEmailDiscoveryForCanonicalPerson(admin, {
        company_id: input.company_id,
        person_id: input.person_id,
        promote: true,
      })
      for (const row of rows) {
        row.promotion_attempted = true
        row.promotion_result = `verified=${result.verified_count} promoted=${result.promoted_count}`
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      for (const row of rows) {
        row.promotion_attempted = true
        row.promotion_result = message
      }
    }
  } else if (input.attempt_verification) {
    for (const row of rows) {
      row.promotion_result = cert.blockers.join("; ") || "config_blocked"
    }
  }

  return rows
}

export async function auditLinkedInEvidenceForPerson(
  admin: SupabaseClient,
  input: { person_id: string; company_id: string; attempt_discovery?: boolean },
): Promise<LinkedInEvidenceAuditRow[]> {
  const rows: LinkedInEvidenceAuditRow[] = []

  const { data: companyContact } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("linkedin_url, contact_candidate_id")
    .eq("canonical_person_id", input.person_id)
    .maybeSingle()

  const linkedin = asString(companyContact?.linkedin_url)
  if (linkedin) {
    rows.push({
      person_id: input.person_id,
      linkedin_url: linkedin,
      source: "company_contacts",
      discovery_attempted: false,
      promoted_count: 0,
      result: null,
    })
  }

  if (companyContact?.contact_candidate_id) {
    const { data: candidate } = await admin
      .schema("growth")
      .from("contact_candidates")
      .select("linkedin_url")
      .eq("id", companyContact.contact_candidate_id)
      .maybeSingle()
    const candidateUrl = asString(candidate?.linkedin_url)
    if (candidateUrl && !rows.some((r) => r.linkedin_url === candidateUrl)) {
      rows.push({
        person_id: input.person_id,
        linkedin_url: candidateUrl,
        source: "contact_candidates",
        discovery_attempted: false,
        promoted_count: 0,
        result: null,
      })
    }
  }

  if (input.attempt_discovery && rows.length > 0) {
    try {
      const result = await runSocialProfileDiscoveryForCanonicalPerson(admin, {
        company_id: input.company_id,
        person_id: input.person_id,
        promote: true,
      })
      for (const row of rows) {
        row.discovery_attempted = true
        row.promoted_count = result.promoted_count
        row.result = `verified=${result.verified_count} promoted=${result.promoted_count}`
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      for (const row of rows) {
        row.discovery_attempted = true
        row.result = message
      }
    }
  } else if (rows.length === 0) {
    rows.push({
      person_id: input.person_id,
      linkedin_url: "",
      source: "company_contacts",
      discovery_attempted: false,
      promoted_count: 0,
      result: "no_linkedin_evidence",
    })
  }

  return rows
}

export async function completeVerifiedChannelsForPerson(
  admin: SupabaseClient,
  input: { person_id: string; company_id: string },
): Promise<{
  email_audit: DiscoveredEmailAuditRow[]
  social_audit: LinkedInEvidenceAuditRow[]
  zerobounce_configured: boolean
}> {
  const cert = evaluateEmailDiscoveryVerificationCertification()
  const email_audit = await auditDiscoveredEmailsForPerson(admin, {
    ...input,
    attempt_verification: cert.zerobounce_configured,
  })
  const social_audit = await auditLinkedInEvidenceForPerson(admin, {
    ...input,
    attempt_discovery: true,
  })
  return {
    email_audit,
    social_audit,
    zerobounce_configured: cert.zerobounce_configured,
  }
}
