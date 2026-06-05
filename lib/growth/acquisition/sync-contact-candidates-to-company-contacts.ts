import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logAcquisitionStep } from "@/lib/growth/acquisition/acquisition-diagnostics"
import {
  GROWTH_COMPANY_CONTACTS_QA_MARKER,
  type GrowthCompanyContact,
} from "@/lib/growth/contact-discovery/company-contact-types"
import { isGrowthCompanyContactsSchemaReady } from "@/lib/growth/contact-discovery/company-contact-schema-health"
import { scoreDecisionMakerTitle } from "@/lib/growth/contact-discovery/decision-maker-score"
import type { GrowthContactCandidate } from "@/lib/growth/contact-discovery/contact-discovery-types"
import { companyContactDedupeHash } from "@/lib/growth/contact-discovery/website-contact-discovery"
import { classifyContactIdentity } from "@/lib/growth/human-identity-evidence/contact-identity-classification"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function rowToCompanyContact(row: Record<string, unknown>): GrowthCompanyContact {
  return {
    id: asString(row.id),
    company_id: asString(row.company_id),
    growth_lead_id: asString(row.growth_lead_id) || null,
    contact_candidate_id: asString(row.contact_candidate_id) || null,
    lead_decision_maker_id: asString(row.lead_decision_maker_id) || null,
    full_name: asString(row.full_name),
    first_name: asString(row.first_name) || null,
    last_name: asString(row.last_name) || null,
    title: asString(row.title) || null,
    department: asString(row.department) || null,
    email: asString(row.email) || null,
    email_status: asString(row.email_status) as GrowthCompanyContact["email_status"],
    phone: asString(row.phone) || null,
    phone_status: asString(row.phone_status) as GrowthCompanyContact["phone_status"],
    linkedin_url: asString(row.linkedin_url) || null,
    confidence_score: typeof row.confidence_score === "number" ? row.confidence_score : Number(row.confidence_score ?? 0),
    decision_maker_score:
      typeof row.decision_maker_score === "number"
        ? row.decision_maker_score
        : Number(row.decision_maker_score ?? 0),
    source_type: asString(row.source_type) as GrowthCompanyContact["source_type"],
    source_evidence: Array.isArray(row.source_evidence)
      ? (row.source_evidence as GrowthCompanyContact["source_evidence"])
      : [],
    contact_status: asString(row.contact_status) as GrowthCompanyContact["contact_status"],
    last_verified_at: asString(row.last_verified_at) || null,
    dedupe_hash: asString(row.dedupe_hash),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    metadata:
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
  }
}

function candidateSourceType(providerType: string): GrowthCompanyContact["source_type"] {
  if (providerType.includes("website")) return "team_page"
  if (providerType.includes("linkedin")) return "linkedin"
  if (providerType.includes("pdl") || providerType.includes("people_data")) return "public_record"
  return "manual"
}

function candidateToCompanyRow(input: {
  company_id: string
  candidate: GrowthContactCandidate
}): Record<string, unknown> {
  const score = scoreDecisionMakerTitle({
    title: input.candidate.job_title,
    source_type: candidateSourceType(input.candidate.provider_type),
    evidence_count: input.candidate.evidence.length,
    has_website_evidence: input.candidate.provider_type.includes("website"),
    exact_title_match: Boolean(input.candidate.job_title),
  })

  const dedupe_hash = companyContactDedupeHash({
    company_id: input.company_id,
    full_name: input.candidate.full_name,
    title: input.candidate.job_title,
    email: input.candidate.email,
  })

  const identity = classifyContactIdentity({
    full_name: input.candidate.full_name,
    title: input.candidate.job_title,
    email: input.candidate.email,
    phone: input.candidate.phone,
    linkedin_url: input.candidate.linkedin_url,
    source_type: candidateSourceType(input.candidate.provider_type),
  })

  return {
    company_id: input.company_id,
    contact_candidate_id: input.candidate.id,
    full_name: input.candidate.full_name,
    first_name: input.candidate.first_name,
    last_name: input.candidate.last_name,
    title: input.candidate.job_title,
    department: input.candidate.department,
    email: input.candidate.email,
    email_status: input.candidate.email ? "discovered" : "unknown",
    phone: input.candidate.phone,
    phone_status: input.candidate.phone ? "unknown" : "unknown",
    linkedin_url: input.candidate.linkedin_url,
    confidence_score: Math.max(score.confidence_score, Math.round(input.candidate.confidence * 100)),
    decision_maker_score: score.decision_maker_score,
    source_type: candidateSourceType(input.candidate.provider_type),
    source_evidence: input.candidate.evidence.map((item) => ({
      claim: item.claim,
      evidence: item.evidence,
      source: item.source,
      page_url: item.page_url ?? null,
    })),
    contact_status: "candidate",
    dedupe_hash,
    metadata: {
      qa_marker: GROWTH_COMPANY_CONTACTS_QA_MARKER,
      acquisition_sync: true,
      discovery_provider: input.candidate.provider_name,
      provider_type: input.candidate.provider_type,
      contact_candidate_id: input.candidate.id,
      identity_classification: identity.classification,
      identity_classification_reasons: identity.reasons,
      eligible_for_canonical_person: identity.eligible_for_canonical_person,
    },
  }
}

/** Bridge contact_candidates → company_contacts for acquisition promotion. */
export async function syncContactCandidatesToCompanyContacts(
  admin: SupabaseClient,
  input: {
    company_id: string
    candidates: GrowthContactCandidate[]
  },
): Promise<number> {
  logAcquisitionStep("syncContactCandidatesToCompanyContacts", {
    companyId: input.company_id,
    candidate_count: input.candidates.length,
  })

  if (!(await isGrowthCompanyContactsSchemaReady(admin))) return 0
  if (input.candidates.length === 0) return 0

  let synced = 0
  const nowIso = new Date().toISOString()

  for (const candidate of input.candidates) {
    if (!candidate.full_name.trim()) continue

    const row = candidateToCompanyRow({
      company_id: input.company_id,
      candidate,
    })
    const dedupe_hash = asString(row.dedupe_hash)

    const { data: existing } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("*")
      .eq("company_id", input.company_id)
      .eq("dedupe_hash", dedupe_hash)
      .maybeSingle()

    if (existing) {
      const prior = rowToCompanyContact(existing as Record<string, unknown>)
      const { error } = await admin
        .schema("growth")
        .from("company_contacts")
        .update({
          contact_candidate_id: prior.contact_candidate_id ?? candidate.id,
          email: row.email ?? prior.email,
          phone: row.phone ?? prior.phone,
          title: row.title ?? prior.title,
          linkedin_url: row.linkedin_url ?? prior.linkedin_url,
          confidence_score: Math.max(prior.confidence_score, Number(row.confidence_score ?? 0)),
          decision_maker_score: Math.max(prior.decision_maker_score, Number(row.decision_maker_score ?? 0)),
          updated_at: nowIso,
          metadata: {
            ...prior.metadata,
            acquisition_sync: true,
            contact_candidate_id: prior.contact_candidate_id ?? candidate.id,
          },
        })
        .eq("id", prior.id)
      if (!error) synced += 1
      continue
    }

    const { error } = await admin.schema("growth").from("company_contacts").insert({
      ...row,
      metadata: {
        ...(row.metadata as Record<string, unknown>),
        last_checked_at: nowIso,
      },
    })
    if (!error) synced += 1
  }

  const companyCandidateId = asString(input.candidates[0]?.company_candidate_id)
  if (companyCandidateId) {
    const { ensureStagingCanonicalCompanyLinkage } = await import(
      "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
    )
    await ensureStagingCanonicalCompanyLinkage(admin, companyCandidateId, {
      explicit_canonical_company_id: input.company_id,
    })
  }

  logAcquisitionStep("syncContactCandidatesToCompanyContacts_done", {
    companyId: input.company_id,
    synced,
  })

  return synced
}

export async function listContactCandidatesForCompany(
  admin: SupabaseClient,
  companyCandidateId: string,
  limit = 50,
): Promise<GrowthContactCandidate[]> {
  const { data } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select(
      "id, created_at, updated_at, company_candidate_id, provider_name, provider_type, full_name, first_name, last_name, job_title, department, seniority, linkedin_url, email, phone, verification_state, confidence, source_attribution, evidence, dedupe_hash, metadata",
    )
    .eq("company_candidate_id", companyCandidateId)
    .order("confidence", { ascending: false })
    .limit(limit)

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: asString(r.id),
      created_at: asString(r.created_at),
      updated_at: asString(r.updated_at),
      company_candidate_id: asString(r.company_candidate_id),
      provider_name: asString(r.provider_name),
      provider_type: asString(r.provider_type),
      full_name: asString(r.full_name),
      first_name: asString(r.first_name) || null,
      last_name: asString(r.last_name) || null,
      job_title: asString(r.job_title) || null,
      department: asString(r.department) || null,
      seniority: asString(r.seniority) || null,
      linkedin_url: asString(r.linkedin_url) || null,
      email: asString(r.email) || null,
      phone: asString(r.phone) || null,
      verification_state: asString(r.verification_state) as GrowthContactCandidate["verification_state"],
      confidence: typeof r.confidence === "number" ? r.confidence : 0,
      source_attribution: Array.isArray(r.source_attribution)
        ? (r.source_attribution as GrowthContactCandidate["source_attribution"])
        : [],
      evidence: Array.isArray(r.evidence) ? (r.evidence as GrowthContactCandidate["evidence"]) : [],
      dedupe_hash: asString(r.dedupe_hash),
      metadata: r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : {},
    }
  })
}
