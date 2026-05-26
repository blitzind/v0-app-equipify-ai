import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveCompanyCandidateContext } from "@/lib/growth/contact-discovery/contact-repository"
import { normalizeCompanyEnrichmentResult } from "@/lib/growth/enrichment/company-enrichment-engine"
import { normalizeContactVerificationResult } from "@/lib/growth/enrichment/contact-verification-engine"
import { runEnrichmentProviders } from "@/lib/growth/enrichment/enrichment-registry"
import { isGrowthVerificationEnrichmentSchemaReady } from "@/lib/growth/enrichment/enrichment-schema-health"
import {
  GROWTH_VERIFICATION_ENRICHMENT_PRIVACY_NOTE,
  GROWTH_VERIFICATION_ENRICHMENT_QA_MARKER,
  type GrowthCompanyEnrichment,
  type GrowthContactVerification,
  type GrowthVerificationEnrichmentSnapshot,
  type GrowthVerificationEnrichmentUiSummary,
} from "@/lib/growth/enrichment/enrichment-types"
import { mergeCompanyEnrichments } from "@/lib/growth/enrichment/company-enrichment-engine"
import { mergeContactVerifications } from "@/lib/growth/enrichment/contact-verification-engine"
import { channelStatusLabel } from "@/lib/growth/enrichment/verification-confidence"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function stripServerMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const { raw_payload: _rp, ...rest } = meta
  return rest
}

function rowToContactVerification(row: Record<string, unknown>): GrowthContactVerification {
  const meta =
    row.metadata && typeof row.metadata === "object"
      ? stripServerMetadata(row.metadata as Record<string, unknown>)
      : {}
  return {
    id: asString(row.id),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    contact_candidate_id: asString(row.contact_candidate_id),
    provider_name: asString(row.provider_name),
    provider_type: asString(row.provider_type),
    email_status: asString(row.email_status) as GrowthContactVerification["email_status"],
    phone_status: asString(row.phone_status) as GrowthContactVerification["phone_status"],
    linkedin_status: asString(row.linkedin_status) as GrowthContactVerification["linkedin_status"],
    verification_confidence:
      typeof row.verification_confidence === "number" ? row.verification_confidence : 0,
    verification_reason: asString(row.verification_reason),
    evidence: Array.isArray(row.evidence)
      ? (row.evidence as GrowthContactVerification["evidence"])
      : [],
    source_attribution: Array.isArray(row.source_attribution)
      ? (row.source_attribution as GrowthContactVerification["source_attribution"])
      : [],
    metadata: meta,
  }
}

function rowToCompanyEnrichment(row: Record<string, unknown>): GrowthCompanyEnrichment {
  const meta =
    row.metadata && typeof row.metadata === "object"
      ? stripServerMetadata(row.metadata as Record<string, unknown>)
      : {}
  return {
    id: asString(row.id),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    company_candidate_id: asString(row.company_candidate_id),
    provider_name: asString(row.provider_name),
    provider_type: asString(row.provider_type),
    employee_estimate: asString(row.employee_estimate) || null,
    revenue_estimate: asString(row.revenue_estimate) || null,
    industry: asString(row.industry) || null,
    subindustry: asString(row.subindustry) || null,
    technology_signals: Array.isArray(row.technology_signals)
      ? (row.technology_signals as string[])
      : [],
    crm_signals: Array.isArray(row.crm_signals) ? (row.crm_signals as string[]) : [],
    service_signals: Array.isArray(row.service_signals)
      ? (row.service_signals as string[])
      : [],
    location_signals: Array.isArray(row.location_signals)
      ? (row.location_signals as string[])
      : [],
    confidence: typeof row.confidence === "number" ? row.confidence : 0,
    evidence: Array.isArray(row.evidence) ? (row.evidence as GrowthCompanyEnrichment["evidence"]) : [],
    source_attribution: Array.isArray(row.source_attribution)
      ? (row.source_attribution as GrowthCompanyEnrichment["source_attribution"])
      : [],
    metadata: meta,
  }
}

function buildUiSummary(
  contact: GrowthContactVerification | null,
  company: GrowthCompanyEnrichment | null,
): GrowthVerificationEnrichmentUiSummary {
  return {
    email_verified_label: contact
      ? channelStatusLabel(contact.email_status)
      : "—",
    phone_verified_label: contact ? channelStatusLabel(contact.phone_status) : "—",
    linkedin_verified_label: contact ? channelStatusLabel(contact.linkedin_status) : "—",
    company_confidence_label: company
      ? `${Math.round(company.confidence * 100)}%`
      : "—",
    technology_signals: company?.technology_signals ?? [],
    industry_confidence_label: company?.industry
      ? `${Math.round(company.confidence * 100)}% (${company.industry})`
      : "—",
    enrichment_confidence_label: company
      ? `${Math.round(company.confidence * 100)}%`
      : contact
        ? `${Math.round(contact.verification_confidence * 100)}%`
        : "—",
  }
}

async function resolveContactContext(
  admin: SupabaseClient,
  contactCandidateId: string,
): Promise<{
  contact_candidate_id: string
  full_name: string | null
  email: string | null
  phone: string | null
  linkedin: string | null
  company_candidate_id: string | null
}> {
  const { data } = await admin
    .schema("growth")
    .from("contact_candidates")
    .select("id, full_name, email, phone, linkedin_url, company_candidate_id")
    .eq("id", contactCandidateId)
    .maybeSingle()
  if (!data) {
    return {
      contact_candidate_id: contactCandidateId,
      full_name: null,
      email: null,
      phone: null,
      linkedin: null,
      company_candidate_id: null,
    }
  }
  const r = data as Record<string, unknown>
  return {
    contact_candidate_id: contactCandidateId,
    full_name: asString(r.full_name) || null,
    email: asString(r.email) || null,
    phone: asString(r.phone) || null,
    linkedin: asString(r.linkedin_url) || null,
    company_candidate_id: asString(r.company_candidate_id) || null,
  }
}

export async function runVerificationEnrichment(
  admin: SupabaseClient,
  input: {
    contact_candidate_id?: string | null
    company_candidate_id?: string | null
    created_by?: string | null
  },
): Promise<GrowthVerificationEnrichmentSnapshot> {
  const contactId = input.contact_candidate_id?.trim() || null
  const companyId = input.company_candidate_id?.trim() || null

  const empty: GrowthVerificationEnrichmentSnapshot = {
    qa_marker: GROWTH_VERIFICATION_ENRICHMENT_QA_MARKER,
    schema_ready: false,
    contact_candidate_id: contactId,
    company_candidate_id: companyId,
    run: null,
    contact_verifications: [],
    company_enrichments: [],
    provider_messages: [],
    privacy_note: GROWTH_VERIFICATION_ENRICHMENT_PRIVACY_NOTE,
    ui_summary: buildUiSummary(null, null),
  }

  const schema_ready = await isGrowthVerificationEnrichmentSchemaReady(admin)
  if (!schema_ready) return { ...empty, schema_ready: false }

  let companyCtx = companyId ? await resolveCompanyCandidateContext(admin, companyId) : null
  let contactCtx = contactId ? await resolveContactContext(admin, contactId) : null
  if (!companyId && contactCtx?.company_candidate_id) {
    companyCtx = await resolveCompanyCandidateContext(admin, contactCtx.company_candidate_id)
  }

  const providerResults = await runEnrichmentProviders(admin, {
    contact_candidate_id: contactId,
    company_candidate_id: companyCtx?.company_candidate_id ?? companyId,
    company_name: companyCtx?.company_name ?? null,
    domain: companyCtx?.domain ?? null,
    growth_lead_id: companyCtx?.growth_lead_id ?? null,
    contact_full_name: contactCtx?.full_name ?? null,
    contact_email: contactCtx?.email ?? null,
    contact_phone: contactCtx?.phone ?? null,
    contact_linkedin: contactCtx?.linkedin ?? null,
  })

  const provider_messages = providerResults.map(
    (r) => `${r.provider_name}: ${r.status} — ${r.message}`,
  )

  const { data: runRow } = await admin
    .schema("growth")
    .from("enrichment_runs")
    .insert({
      contact_candidate_id: contactId,
      company_candidate_id: companyCtx?.company_candidate_id ?? companyId,
      created_by: input.created_by ?? null,
      provider_names: providerResults.map((r) => r.provider_name),
      status: providerResults.some((r) => r.status === "failed") ? "partial" : "completed",
      metadata: { qa_marker: GROWTH_VERIFICATION_ENRICHMENT_QA_MARKER },
    })
    .select("*")
    .single()

  const runId = runRow ? asString((runRow as Record<string, unknown>).id) : null

  for (const pr of providerResults) {
    if (pr.status !== "success") continue
    for (const cv of pr.contact_verifications) {
      const norm = normalizeContactVerificationResult(cv, pr.provider_name, pr.provider_type)
      await admin
        .schema("growth")
        .from("contact_verifications")
        .upsert(
          { run_id: runId, ...norm },
          { onConflict: "contact_candidate_id,provider_name" },
        )
    }
    for (const ce of pr.company_enrichments) {
      const norm = normalizeCompanyEnrichmentResult(ce, pr.provider_name, pr.provider_type)
      await admin
        .schema("growth")
        .from("company_enrichments")
        .upsert(
          { run_id: runId, ...norm },
          { onConflict: "company_candidate_id,provider_name" },
        )
    }
  }

  return loadVerificationEnrichmentSnapshot(admin, {
    contact_candidate_id: contactId,
    company_candidate_id: companyCtx?.company_candidate_id ?? companyId,
  })
}

export async function loadVerificationEnrichmentSnapshot(
  admin: SupabaseClient,
  input: {
    contact_candidate_id?: string | null
    company_candidate_id?: string | null
  },
): Promise<GrowthVerificationEnrichmentSnapshot> {
  const contactId = input.contact_candidate_id?.trim() || null
  const companyId = input.company_candidate_id?.trim() || null
  const schema_ready = await isGrowthVerificationEnrichmentSchemaReady(admin)

  if (!schema_ready) {
    return {
      qa_marker: GROWTH_VERIFICATION_ENRICHMENT_QA_MARKER,
      schema_ready: false,
      contact_candidate_id: contactId,
      company_candidate_id: companyId,
      run: null,
      contact_verifications: [],
      company_enrichments: [],
      provider_messages: [],
      privacy_note: GROWTH_VERIFICATION_ENRICHMENT_PRIVACY_NOTE,
      ui_summary: buildUiSummary(null, null),
    }
  }

  let contactRows: GrowthContactVerification[] = []
  if (contactId) {
    const { data } = await admin
      .schema("growth")
      .from("contact_verifications")
      .select("*")
      .eq("contact_candidate_id", contactId)
      .order("verification_confidence", { ascending: false })
    contactRows = (data ?? []).map((r) => rowToContactVerification(r as Record<string, unknown>))
  }

  let companyRows: GrowthCompanyEnrichment[] = []
  if (companyId) {
    const { data } = await admin
      .schema("growth")
      .from("company_enrichments")
      .select("*")
      .eq("company_candidate_id", companyId)
      .order("confidence", { ascending: false })
    companyRows = (data ?? []).map((r) => rowToCompanyEnrichment(r as Record<string, unknown>))
  }

  const bestContact = mergeContactVerifications(contactRows)
  const bestCompany = mergeCompanyEnrichments(companyRows)

  return {
    qa_marker: GROWTH_VERIFICATION_ENRICHMENT_QA_MARKER,
    schema_ready: true,
    contact_candidate_id: contactId,
    company_candidate_id: companyId,
    run: null,
    contact_verifications: contactRows,
    company_enrichments: companyRows,
    provider_messages: [],
    privacy_note: GROWTH_VERIFICATION_ENRICHMENT_PRIVACY_NOTE,
    ui_summary: buildUiSummary(bestContact, bestCompany),
  }
}
