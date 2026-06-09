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
import {
  resolveCompanyContactsCanonicalCompanyId,
  type CompanyContactsPersistenceResolution,
} from "@/lib/growth/contact-discovery/resolve-company-contacts-company-id"
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

function candidateSourceType(
  providerType: string,
  metadata?: Record<string, unknown>,
): GrowthCompanyContact["source_type"] {
  const metaSource = asString(metadata?.source_type)
  if (metaSource === "contact_page") return "contact_page"
  if (metaSource === "team_page") return "team_page"
  if (metaSource === "website") return "website"
  if (providerType.includes("website")) return "website"
  if (providerType.includes("linkedin")) return "linkedin"
  if (providerType.includes("pdl") || providerType.includes("people_data")) return "public_record"
  return "manual"
}

function candidateToCompanyRow(input: {
  company_id: string
  candidate: GrowthContactCandidate
}): Record<string, unknown> {
  const candidateMetadata =
    input.candidate.metadata && typeof input.candidate.metadata === "object"
      ? (input.candidate.metadata as Record<string, unknown>)
      : {}
  const resolvedSourceType = candidateSourceType(input.candidate.provider_type, candidateMetadata)

  const score = scoreDecisionMakerTitle({
    title: input.candidate.job_title,
    source_type: resolvedSourceType,
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

  const metaClassification = asString(candidateMetadata.identity_classification)
  const identity =
    metaClassification &&
    ["named_person", "role_contact", "company_channel", "generic_placeholder"].includes(metaClassification)
      ? {
          classification: metaClassification as ReturnType<typeof classifyContactIdentity>["classification"],
          eligible_for_canonical_person: candidateMetadata.eligible_for_canonical_person === true,
          eligible_for_committee: candidateMetadata.eligible_for_committee === true,
          reasons: Array.isArray(candidateMetadata.identity_classification_reasons)
            ? (candidateMetadata.identity_classification_reasons as string[])
            : ["normalized_at_ingest"],
        }
      : classifyContactIdentity({
          full_name: input.candidate.full_name,
          title: input.candidate.job_title,
          email: input.candidate.email,
          phone: input.candidate.phone,
          linkedin_url: input.candidate.linkedin_url,
          source_type: resolvedSourceType,
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
    source_type: resolvedSourceType,
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
      source_type: resolvedSourceType,
      source_page_type: asString(candidateMetadata.source_page_type) || null,
      source_page_url: asString(candidateMetadata.source_page_url) || null,
      identity_classification: identity.classification,
      identity_classification_reasons: identity.reasons,
      eligible_for_canonical_person: identity.eligible_for_canonical_person,
    },
  }
}

export type SyncContactCandidatesToCompanyContactsInput = {
  candidates: GrowthContactCandidate[]
  /** Staging candidate id — used to resolve canonical company id when not explicit. */
  company_candidate_id?: string
  /** Canonical `growth.companies` id — preferred when already known. */
  canonical_company_id?: string | null
  /**
   * @deprecated Legacy alias for `canonical_company_id`.
   * Do not pass staging candidate ids here after Phase 7.PCA-1.
   */
  company_id?: string
  /**
   * When true, candidates without email/phone/linkedin are not promoted to company_contacts.
   * Used by Apollo search-only pilots — identity remains in contact_candidates for research.
   */
  require_contact_channel?: boolean
}

export type SyncContactCandidatesToCompanyContactsResult = {
  synced: number
  resolution: CompanyContactsPersistenceResolution | null
  canonical_sync_attempted: boolean
  rejection_reasons: Record<string, number>
}

function hasObservedContactChannel(candidate: GrowthContactCandidate): boolean {
  return Boolean(
    asString(candidate.email) || asString(candidate.phone) || asString(candidate.linkedin_url),
  )
}

function bumpRejectionReason(reasons: Record<string, number>, reason: string): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1
}

function classifyInsertFailure(error: { code?: string | null; message?: string | null }): string {
  const code = asString(error.code)
  if (code) return `insert_failed_${code.toLowerCase()}`
  return "insert_failed"
}

async function syncContactCandidatesToCanonicalCompany(
  admin: SupabaseClient,
  input: {
    canonical_company_id: string
    candidates: GrowthContactCandidate[]
    require_contact_channel?: boolean
  },
): Promise<{ synced: number; rejection_reasons: Record<string, number> }> {
  const rejection_reasons: Record<string, number> = {}
  const canonical_company_id = input.canonical_company_id
  if (!(await isGrowthCompanyContactsSchemaReady(admin))) {
    bumpRejectionReason(rejection_reasons, "schema_not_ready")
    return { synced: 0, rejection_reasons }
  }
  if (input.candidates.length === 0) {
    return { synced: 0, rejection_reasons }
  }

  let synced = 0
  const nowIso = new Date().toISOString()

  for (const candidate of input.candidates) {
    if (!candidate.full_name.trim()) {
      bumpRejectionReason(rejection_reasons, "missing_full_name")
      continue
    }

    if (input.require_contact_channel && !hasObservedContactChannel(candidate)) {
      bumpRejectionReason(rejection_reasons, "missing_contact_channel")
      continue
    }

    const row = candidateToCompanyRow({
      company_id: canonical_company_id,
      candidate,
    })
    const dedupe_hash = asString(row.dedupe_hash)

    const { data: existing } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("*")
      .eq("company_id", canonical_company_id)
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
      else bumpRejectionReason(rejection_reasons, classifyInsertFailure(error))
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
    else bumpRejectionReason(rejection_reasons, classifyInsertFailure(error))
  }

  return { synced, rejection_reasons }
}

/** Bridge contact_candidates → company_contacts for acquisition promotion. */
export async function syncContactCandidatesToCompanyContacts(
  admin: SupabaseClient,
  input: SyncContactCandidatesToCompanyContactsInput,
): Promise<number> {
  const result = await syncContactCandidatesToCompanyContactsWithResolution(admin, input)
  return result.synced
}

/** Same as syncContactCandidatesToCompanyContacts but returns canonical resolution diagnostics. */
export async function syncContactCandidatesToCompanyContactsWithResolution(
  admin: SupabaseClient,
  input: SyncContactCandidatesToCompanyContactsInput,
): Promise<SyncContactCandidatesToCompanyContactsResult> {
  const company_candidate_id =
    asString(input.company_candidate_id) || asString(input.candidates[0]?.company_candidate_id)
  const explicitCanonical =
    asString(input.canonical_company_id) || asString(input.company_id) || null

  logAcquisitionStep("syncContactCandidatesToCompanyContacts", {
    company_candidate_id: company_candidate_id || null,
    canonical_company_id: explicitCanonical,
    candidate_count: input.candidates.length,
  })

  if (input.candidates.length === 0) {
    return {
      synced: 0,
      resolution: null,
      canonical_sync_attempted: false,
      rejection_reasons: {},
    }
  }

  if (!company_candidate_id && !explicitCanonical) {
    logAcquisitionStep("syncContactCandidatesToCompanyContacts_skipped", {
      reason: "missing_company_candidate_and_canonical_id",
    })
    return {
      synced: 0,
      resolution: null,
      canonical_sync_attempted: false,
      rejection_reasons: { missing_company_candidate_and_canonical_id: input.candidates.length },
    }
  }

  const resolution = company_candidate_id
    ? await resolveCompanyContactsCanonicalCompanyId(admin, {
        company_candidate_id,
        explicit_canonical_company_id: explicitCanonical,
      })
    : null

  const canonical_company_id = resolution?.canonical_company_id ?? explicitCanonical
  if (!canonical_company_id) {
    logAcquisitionStep("syncContactCandidatesToCompanyContacts_skipped", {
      company_candidate_id,
      diagnostics: resolution?.diagnostics ?? ["canonical_company_id_unresolved"],
    })
    return {
      synced: 0,
      resolution,
      canonical_sync_attempted: true,
      rejection_reasons: {
        canonical_company_id_unresolved: input.candidates.length,
      },
    }
  }

  const syncResult = await syncContactCandidatesToCanonicalCompany(admin, {
    canonical_company_id,
    candidates: input.candidates,
    require_contact_channel: input.require_contact_channel === true,
  })

  if (company_candidate_id) {
    const { ensureStagingCanonicalCompanyLinkage } = await import(
      "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
    )
    await ensureStagingCanonicalCompanyLinkage(admin, company_candidate_id, {
      explicit_canonical_company_id: canonical_company_id,
    })
  }

  logAcquisitionStep("syncContactCandidatesToCompanyContacts_done", {
    company_candidate_id: company_candidate_id || null,
    canonical_company_id,
    synced: syncResult.synced,
    rejection_reasons: syncResult.rejection_reasons,
  })

  return {
    synced: syncResult.synced,
    resolution,
    canonical_sync_attempted: true,
    rejection_reasons: syncResult.rejection_reasons,
  }
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
