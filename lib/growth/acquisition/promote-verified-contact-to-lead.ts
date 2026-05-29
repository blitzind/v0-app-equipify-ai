import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logAcquisitionStep } from "@/lib/growth/acquisition/acquisition-diagnostics"
import { logGrowthEngine } from "@/lib/growth/access"
import type { PromoteVerifiedContactOutcome } from "@/lib/growth/acquisition/acquisition-types"
import type { GrowthCompanyContact } from "@/lib/growth/contact-discovery/company-contact-types"
import { createGrowthLeadDecisionMaker } from "@/lib/growth/decision-maker-repository"
import { findImportDedupeMatch, proposeImportRowAction } from "@/lib/growth/import/dedupe"
import type { NormalizedImportRow } from "@/lib/growth/import/types"
import { createGrowthLead } from "@/lib/growth/lead-repository"
import { assertEmailSendAllowed } from "@/lib/growth/outbound/suppression-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

type CompanyCandidateRow = {
  id: string
  company_name: string
  website: string | null
  domain: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  phone: string | null
}

async function loadCompanyCandidate(
  admin: SupabaseClient,
  companyId: string,
): Promise<CompanyCandidateRow | null> {
  const select =
    "id, company_name, website, domain, address, city, state, country, phone"

  const { data: realWorld } = await admin
    .schema("growth")
    .from("real_world_company_candidates")
    .select(select)
    .eq("id", companyId)
    .maybeSingle()
  if (realWorld) {
    const row = realWorld as Record<string, unknown>
    return {
      id: asString(row.id),
      company_name: asString(row.company_name),
      website: asString(row.website) || null,
      domain: asString(row.domain) || null,
      address: asString(row.address) || null,
      city: asString(row.city) || null,
      state: asString(row.state) || null,
      country: asString(row.country) || null,
      phone: asString(row.phone) || null,
    }
  }

  const { data: external } = await admin
    .schema("growth")
    .from("external_company_candidates")
    .select(select)
    .eq("id", companyId)
    .maybeSingle()
  if (!external) return null

  const row = external as Record<string, unknown>
  return {
    id: asString(row.id),
    company_name: asString(row.company_name),
    website: asString(row.website) || null,
    domain: asString(row.domain) || null,
    address: asString(row.address) || null,
    city: asString(row.city) || null,
    state: asString(row.state) || null,
    country: asString(row.country) || null,
    phone: asString(row.phone) || null,
  }
}

function companyContactToImportRow(
  contact: GrowthCompanyContact,
  company: CompanyCandidateRow,
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
    externalRef: `acquisition:contact:${contact.id}`,
  }
}

async function linkCompanyContactToLead(
  admin: SupabaseClient,
  input: {
    companyContactId: string
    leadId: string
    decisionMakerId?: string | null
    acquisitionRunId?: string | null
  },
): Promise<void> {
  const { data: existing } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("metadata")
    .eq("id", input.companyContactId)
    .maybeSingle()

  const metadata =
    existing?.metadata && typeof existing.metadata === "object"
      ? (existing.metadata as Record<string, unknown>)
      : {}

  await admin
    .schema("growth")
    .from("company_contacts")
    .update({
      growth_lead_id: input.leadId,
      lead_decision_maker_id: input.decisionMakerId ?? null,
      updated_at: new Date().toISOString(),
      metadata: {
        ...metadata,
        acquisition_run_id: input.acquisitionRunId ?? metadata.acquisition_run_id ?? null,
        promoted_at: new Date().toISOString(),
      },
    })
    .eq("id", input.companyContactId)
}

export async function promoteVerifiedContactToGrowthLead(
  admin: SupabaseClient,
  input: {
    companyContact: GrowthCompanyContact
    acquisitionRunId?: string | null
    createdBy?: string | null
  },
): Promise<PromoteVerifiedContactOutcome> {
  logAcquisitionStep("promoteVerifiedContactToGrowthLead", {
    contactId: input.companyContact.id,
    companyId: input.companyContact.company_id,
    acquisitionRunId: input.acquisitionRunId ?? null,
  })

  const contact = input.companyContact

  if (contact.growth_lead_id) {
    return { status: "skipped", companyContactId: contact.id, reason: "already_linked" }
  }
  if (contact.email_status === "blocked") {
    return { status: "suppressed", companyContactId: contact.id, reason: "email_blocked" }
  }
  const emailVerification =
    contact.metadata.email_verification &&
    typeof contact.metadata.email_verification === "object"
      ? (contact.metadata.email_verification as Record<string, unknown>)
      : null
  const verifiedByProvider = emailVerification?.verified_by_provider === true
  if (contact.email_status !== "verified" || !contact.email?.trim() || !verifiedByProvider) {
    return { status: "skipped", companyContactId: contact.id, reason: "not_provider_verified" }
  }
  if (contact.contact_status === "suppressed" || contact.contact_status === "archived") {
    return { status: "skipped", companyContactId: contact.id, reason: "contact_suppressed" }
  }

  const suppression = await assertEmailSendAllowed(admin, contact.email)
  if (!suppression.allowed) {
    return {
      status: "suppressed",
      companyContactId: contact.id,
      reason: suppression.reason ?? "suppressed",
    }
  }

  const company = await loadCompanyCandidate(admin, contact.company_id)
  if (!company?.company_name.trim()) {
    return { status: "error", companyContactId: contact.id, message: "company_not_found" }
  }

  const normalized = companyContactToImportRow(contact, company)
  const externalRef = normalized.externalRef

  const dedupe = await findImportDedupeMatch(admin, {
    vendorKey: "bulk_acquisition",
    row: normalized,
    externalRef,
  })
  const action = proposeImportRowAction(dedupe, "skip_high_confidence")

  if ((action === "skip" || action === "merge") && dedupe) {
    await linkCompanyContactToLead(admin, {
      companyContactId: contact.id,
      leadId: dedupe.leadId,
      acquisitionRunId: input.acquisitionRunId,
    })
    logGrowthEngine("acquisition_lead_linked_duplicate", {
      companyContactId: contact.id,
      leadId: dedupe.leadId,
      rule: dedupe.rule,
    })
    return {
      status: "linked_duplicate",
      companyContactId: contact.id,
      leadId: dedupe.leadId,
      rule: dedupe.rule,
    }
  }

  if (action === "skip") {
    return { status: "skipped", companyContactId: contact.id, reason: "dedupe_skip" }
  }

  try {
    const lead = await createGrowthLead(admin, {
      sourceKind: "other",
      sourceDetail: "bulk_acquisition",
      externalRef,
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
      createdBy: input.createdBy ?? null,
      metadata: {
        acquisition: {
          run_id: input.acquisitionRunId ?? null,
          company_contact_id: contact.id,
          company_candidate_id: contact.company_id,
          contact_candidate_id: contact.contact_candidate_id,
          promoted_at: new Date().toISOString(),
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
      sourceDetail: "bulk_acquisition",
      confidence: contact.confidence_score / 100,
      isPrimary: true,
      createdBy: input.createdBy ?? null,
    })

    await recomputeGrowthLeadWorkflowSignals(admin, lead.id)

    await linkCompanyContactToLead(admin, {
      companyContactId: contact.id,
      leadId: lead.id,
      decisionMakerId: decisionMaker.id,
      acquisitionRunId: input.acquisitionRunId,
    })

    logGrowthEngine("acquisition_lead_created", {
      companyContactId: contact.id,
      leadId: lead.id,
      decisionMakerId: decisionMaker.id,
    })

    return {
      status: "created",
      leadId: lead.id,
      decisionMakerId: decisionMaker.id,
      companyContactId: contact.id,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "promote_failed"
    logGrowthEngine("acquisition_lead_create_failed", {
      companyContactId: contact.id,
      message,
    })
    return { status: "error", companyContactId: contact.id, message }
  }
}

export async function promoteVerifiedContactsBatch(
  admin: SupabaseClient,
  input: {
    contacts: GrowthCompanyContact[]
    acquisitionRunId?: string | null
    createdBy?: string | null
  },
): Promise<PromoteVerifiedContactOutcome[]> {
  const outcomes: PromoteVerifiedContactOutcome[] = []
  for (const contact of input.contacts) {
    outcomes.push(
      await promoteVerifiedContactToGrowthLead(admin, {
        companyContact: contact,
        acquisitionRunId: input.acquisitionRunId,
        createdBy: input.createdBy,
      }),
    )
  }
  return outcomes
}
