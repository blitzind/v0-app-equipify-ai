/** Map staging contact rows → canonical person candidate input (Phase 7.2B). */

import {
  canonicalDisplayPersonName,
  splitPersonName,
} from "@/lib/growth/canonical-persons/canonical-person-normalize"
import type {
  GrowthCanonicalPersonCandidateInput,
  GrowthCanonicalPersonSourceTable,
} from "@/lib/growth/canonical-persons/canonical-person-types"

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function asNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function mapVerificationState(state: string): string {
  const s = state.trim().toLowerCase()
  if (s === "operator_verified") return "operator_verified"
  if (s === "rejected") return "rejected"
  if (s === "insufficient_evidence") return "insufficient_evidence"
  if (s === "verified" || s === "discovered") return "observed"
  return "unverified"
}

export function mapContactCandidateRow(
  row: Record<string, unknown>,
): GrowthCanonicalPersonCandidateInput {
  const full_name = canonicalDisplayPersonName({
    full_name: asString(row.full_name),
    first_name: asString(row.first_name),
    last_name: asString(row.last_name),
  })
  const split = splitPersonName(full_name)
  return {
    source_table: "contact_candidates",
    source_id: asString(row.id),
    run_id: asString(row.run_id) || null,
    provider_name: asString(row.provider_name) || "unknown",
    provider_type: asString(row.provider_type) || "internal_growth",
    discovery_source: "contact_discovery",
    company_candidate_id: asString(row.company_candidate_id) || null,
    first_name: asString(row.first_name) || split.first_name,
    last_name: asString(row.last_name) || split.last_name,
    full_name,
    title: asString(row.job_title) || null,
    department: asString(row.department) || null,
    seniority: asString(row.seniority) || null,
    email: asString(row.email) || null,
    phone: asString(row.phone) || null,
    linkedin_url: asString(row.linkedin_url) || null,
    email_verification_status: mapVerificationState(asString(row.verification_state)),
    confidence: asNumber(row.confidence),
    observed_at: asString(row.created_at) || null,
    source_metadata: {
      evidence: row.evidence,
      source_attribution: row.source_attribution,
      dedupe_hash: asString(row.dedupe_hash),
      metadata: row.metadata,
    },
  }
}

export function mapCompanyContactRow(
  row: Record<string, unknown>,
): GrowthCanonicalPersonCandidateInput {
  const full_name = canonicalDisplayPersonName({
    full_name: asString(row.full_name),
    first_name: asString(row.first_name),
    last_name: asString(row.last_name),
  })
  const split = splitPersonName(full_name)
  return {
    source_table: "company_contacts",
    source_id: asString(row.id),
    run_id: null,
    provider_name: asString(row.source_type) || "company_contact",
    provider_type: "internal_growth",
    discovery_source: asString(row.source_type) || "company_contact",
    canonical_company_id: asString(row.canonical_company_id) || null,
    first_name: asString(row.first_name) || split.first_name,
    last_name: asString(row.last_name) || split.last_name,
    full_name,
    title: asString(row.title) || null,
    department: asString(row.department) || null,
    email: asString(row.email) || null,
    phone: asString(row.phone) || null,
    linkedin_url: asString(row.linkedin_url) || null,
    email_verification_status: mapVerificationState(asString(row.email_status)),
    phone_verification_status: mapVerificationState(asString(row.phone_status)),
    confidence: asNumber(row.confidence_score),
    observed_at: asString(row.last_verified_at) || asString(row.updated_at) || null,
    source_metadata: {
      company_id: asString(row.company_id),
      growth_lead_id: asString(row.growth_lead_id),
      contact_candidate_id: asString(row.contact_candidate_id),
      lead_decision_maker_id: asString(row.lead_decision_maker_id),
      source_evidence: row.source_evidence,
      dedupe_hash: asString(row.dedupe_hash),
      metadata: row.metadata,
    },
  }
}

export function mapLeadDecisionMakerRow(
  row: Record<string, unknown>,
  canonicalCompanyId: string | null,
): GrowthCanonicalPersonCandidateInput {
  const full_name = canonicalDisplayPersonName({ full_name: asString(row.full_name) })
  const split = splitPersonName(full_name)
  return {
    source_table: "lead_decision_makers",
    source_id: asString(row.id),
    run_id: null,
    provider_name: asString(row.source) || "lead_decision_maker",
    provider_type: "internal_growth",
    discovery_source: asString(row.source) || "lead_decision_maker",
    lead_id: asString(row.lead_id) || null,
    canonical_company_id: canonicalCompanyId,
    first_name: split.first_name,
    last_name: split.last_name,
    full_name,
    title: asString(row.title) || null,
    email: asString(row.email) || null,
    phone: asString(row.phone) || null,
    linkedin_url: asString(row.linkedin_url) || null,
    confidence: asNumber(row.confidence),
    observed_at: asString(row.updated_at) || asString(row.created_at) || null,
    source_metadata: {
      source_detail: asString(row.source_detail),
      evidence_excerpt: asString(row.evidence_excerpt),
      status: asString(row.status),
    },
  }
}

export function selectForPersonSourceTable(table: GrowthCanonicalPersonSourceTable): string {
  if (table === "contact_candidates") {
    return "id, run_id, company_candidate_id, provider_name, provider_type, full_name, first_name, last_name, job_title, department, seniority, linkedin_url, email, phone, verification_state, confidence, source_attribution, evidence, dedupe_hash, created_at, metadata, canonical_person_id"
  }
  if (table === "company_contacts") {
    return "id, company_id, growth_lead_id, contact_candidate_id, lead_decision_maker_id, full_name, first_name, last_name, title, department, email, email_status, phone, phone_status, linkedin_url, confidence_score, source_type, source_evidence, contact_status, last_verified_at, dedupe_hash, created_at, updated_at, metadata, canonical_person_id, canonical_company_id"
  }
  return "id, lead_id, full_name, title, email, phone, linkedin_url, source, source_detail, confidence, evidence_excerpt, status, created_at, updated_at, canonical_person_id"
}
