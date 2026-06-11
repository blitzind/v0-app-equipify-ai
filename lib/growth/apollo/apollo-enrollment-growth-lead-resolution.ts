/** Apollo enrollment growth lead resolution — server-only, no outreach. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createGrowthLeadDecisionMaker } from "@/lib/growth/decision-maker-repository"
import { findImportDedupeMatch, proposeImportRowAction } from "@/lib/growth/import/dedupe"
import type { NormalizedImportRow } from "@/lib/growth/import/types"
import { createGrowthLead, fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { buildApolloEnrollmentAttributionRecord } from "@/lib/growth/apollo/apollo-enrollment-automation-evidence"
import { loadStagingCompanyCandidateRow } from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import type { GrowthCompanyContact } from "@/lib/growth/contact-discovery/company-contact-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return null
}

export async function loadApolloEnrollmentCompanyContactRow(
  admin: SupabaseClient,
  companyContactId: string,
): Promise<GrowthCompanyContact | null> {
  const { data } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("*")
    .eq("id", companyContactId)
    .maybeSingle()

  if (!data) return null
  const row = data as Record<string, unknown>
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
    confidence_score: asNumber(row.confidence_score) ?? 0,
    decision_maker_score: asNumber(row.decision_maker_score) ?? 0,
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
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  }
}

async function loadStagingCompanyForEnrollment(
  admin: SupabaseClient,
  companyCandidateId: string,
): Promise<{
  company_name: string
  domain: string | null
  website: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  staging_row_id: string | null
} | null> {
  const staging = await loadStagingCompanyCandidateRow(admin, companyCandidateId)
  if (!staging) return null
  const row = staging.row
  return {
    company_name: asString(row.company_name) || companyCandidateId,
    domain: canonicalNormalizedDomain(asString(row.domain), asString(row.website)),
    website: asString(row.website) || null,
    phone: asString(row.phone) || null,
    address: asString(row.address) || null,
    city: asString(row.city) || null,
    state: asString(row.state) || null,
    country: asString(row.country) || "US",
    staging_row_id: staging.staging_row_id,
  }
}

function companyContactToImportRow(
  contact: GrowthCompanyContact,
  company: NonNullable<Awaited<ReturnType<typeof loadStagingCompanyForEnrollment>>>,
): NormalizedImportRow {
  const website =
    company.website ??
    (company.domain ? (company.domain.startsWith("http") ? company.domain : `https://${company.domain}`) : null)

  return {
    companyName: company.company_name,
    contactName: contact.full_name,
    firstName: contact.first_name,
    lastName: contact.last_name,
    email: contact.email,
    phone: contact.phone ?? company.phone,
    website,
    linkedinUrl: contact.linkedin_url,
    title: contact.title,
    addressLine1: company.address,
    city: company.city,
    state: company.state,
    postalCode: null,
    country: company.country ?? "US",
    notes: null,
    externalRef: `apollo:enrollment:${contact.id}`,
  }
}

export async function resolveOrCreateLeadForEnrollmentCandidate(
  admin: SupabaseClient,
  input: {
    company_candidate_id: string
    company_contact_id: string
    candidate_id: string
    created_by?: string | null
    source_detail?: string
  },
): Promise<{ ok: true; lead_id: string; prospect_id: string | null } | { ok: false; code: string }> {
  const contact = await loadApolloEnrollmentCompanyContactRow(admin, input.company_contact_id)
  if (!contact) return { ok: false, code: "company_contact_not_found" }

  if (contact.growth_lead_id) {
    const lead = await fetchGrowthLeadById(admin, contact.growth_lead_id)
    if (lead) {
      return {
        ok: true,
        lead_id: lead.id,
        prospect_id: lead.promotedProspectId,
      }
    }
  }

  const company = await loadStagingCompanyForEnrollment(admin, input.company_candidate_id)
  if (!company) return { ok: false, code: "company_candidate_not_found" }

  const normalized = companyContactToImportRow(contact, company)
  const dedupe = await findImportDedupeMatch(admin, {
    vendorKey: "apollo_enrollment_automation",
    row: normalized,
    externalRef: normalized.externalRef,
  })
  const action = proposeImportRowAction(dedupe, "skip_high_confidence")

  if ((action === "skip" || action === "merge") && dedupe) {
    await admin
      .schema("growth")
      .from("company_contacts")
      .update({
        growth_lead_id: dedupe.leadId,
        updated_at: new Date().toISOString(),
        metadata: {
          ...contact.metadata,
          apollo_enrollment_candidate_id: input.candidate_id,
        },
      })
      .eq("id", contact.id)

    const lead = await fetchGrowthLeadById(admin, dedupe.leadId)
    return {
      ok: true,
      lead_id: dedupe.leadId,
      prospect_id: lead?.promotedProspectId ?? null,
    }
  }

  const sourceDetail = input.source_detail ?? "apollo_enrollment_automation"
  const lead = await createGrowthLead(admin, {
    sourceKind: "other",
    sourceDetail,
    externalRef: normalized.externalRef,
    companyName: normalized.companyName,
    contactName: normalized.contactName,
    contactEmail: normalized.email,
    contactPhone: normalized.phone,
    website: normalized.website,
    addressLine1: normalized.addressLine1,
    city: normalized.city,
    state: normalized.state,
    postalCode: normalized.postalCode,
    country: normalized.country,
    createdBy: input.created_by ?? null,
    metadata: {
      apollo_enrollment_automation: {
        company_contact_id: contact.id,
        company_candidate_id: input.company_candidate_id,
        enrollment_candidate_id: input.candidate_id,
        source_attribution: buildApolloEnrollmentAttributionRecord({}),
        promoted_at: new Date().toISOString(),
        source_detail: sourceDetail,
      },
    },
  })

  const decisionMaker = await createGrowthLeadDecisionMaker(admin, {
    leadId: lead.id,
    fullName: contact.full_name,
    title: contact.title,
    email: contact.email,
    phone: contact.phone,
    linkedinUrl: contact.linkedin_url,
    source: "public_web",
    sourceDetail,
    confidence: contact.confidence_score / 100,
    isPrimary: true,
    createdBy: input.created_by ?? null,
  })

  await recomputeGrowthLeadWorkflowSignals(admin, lead.id)

  await admin
    .schema("growth")
    .from("company_contacts")
    .update({
      growth_lead_id: lead.id,
      lead_decision_maker_id: decisionMaker.id,
      updated_at: new Date().toISOString(),
      metadata: {
        ...contact.metadata,
        apollo_enrollment_candidate_id: input.candidate_id,
      },
    })
    .eq("id", contact.id)

  return {
    ok: true,
    lead_id: lead.id,
    prospect_id: lead.promotedProspectId,
  }
}
