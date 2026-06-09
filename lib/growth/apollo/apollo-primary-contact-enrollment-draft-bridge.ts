/** Apollo-Primary-4 enrollment draft bridge — server-only, draft creation only (no confirm/outreach). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { findImportDedupeMatch, proposeImportRowAction } from "@/lib/growth/import/dedupe"
import type { NormalizedImportRow } from "@/lib/growth/import/types"
import { createGrowthLeadDecisionMaker } from "@/lib/growth/decision-maker-repository"
import { createGrowthLead, fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { loadApolloPrimaryContactEnrollmentApprovalQueue } from "@/lib/growth/apollo/apollo-primary-contact-enrollment-bridge"
import { mapEnrollmentQueueDbRow } from "@/lib/growth/apollo/apollo-primary-contact-enrollment-bridge-evidence"
import {
  buildApolloEnrollmentSourceAttributionChain,
  buildApolloPrimaryContactEnrollmentDraftSnapshot,
  evaluateApolloEnrollmentDraftGates,
  mapApolloEnrollmentDraftQueueRow,
  readApolloEnrollmentDraftFromQueueMetadata,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-draft-evidence"
import { resolveApolloEnrichmentCanonicalCompanyId } from "@/lib/growth/apollo/apollo-enrichment-cert-canonical-company-resolution"
import {
  buildApolloEnrollmentDraftStagingEvidence,
  mapApolloEnrollmentDraftStagingRow,
  type ApolloEnrollmentDraftStagingCompanyCandidate,
  type ApolloPrimaryContactEnrollmentDraftStagingEvidence,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-draft-staging-evidence"
import {
  APOLLO_PRIMARY_CONTACT_ENROLLMENT_DRAFT_QA_MARKER,
  type ApolloPrimaryContactEnrollmentDraftActionResult,
  type ApolloPrimaryContactEnrollmentDraftSnapshot,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-draft-types"
import type { GrowthCompanyContact } from "@/lib/growth/contact-discovery/company-contact-types"
import { loadStagingCompanyCandidateRow } from "@/lib/growth/canonical-companies/canonical-company-staging-linkage"
import { canonicalNormalizedDomain } from "@/lib/growth/canonical-companies/canonical-company-normalize"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { createGrowthSequenceEnrollmentDraft } from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
import { runSequenceEnrollmentPreflight } from "@/lib/growth/sequence-enrollment/sequence-enrollment-preflight"

export {
  APOLLO_PRIMARY_CONTACT_ENROLLMENT_DRAFT_QA_MARKER,
  type ApolloPrimaryContactEnrollmentDraftActionResult,
  type ApolloPrimaryContactEnrollmentDraftSnapshot,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-draft-types"

export {
  buildApolloEnrollmentSourceAttributionChain,
  buildApolloPrimaryContactEnrollmentDraftSnapshot,
  evaluateApolloEnrollmentDraftGates,
  mapApolloEnrollmentDraftQueueRow,
} from "@/lib/growth/apollo/apollo-primary-contact-enrollment-draft-evidence"

const QUEUE_TABLE = "apollo_primary_contact_enrollment_queue"
const DRAFTS_TABLE = "apollo_primary_contact_enrollment_drafts"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function emptyDraftActionResult(
  error: string,
  input?: {
    queue_item_id?: string | null
    blockers?: string[]
    staging_evidence?: ApolloPrimaryContactEnrollmentDraftStagingEvidence | null
  },
): ApolloPrimaryContactEnrollmentDraftActionResult {
  return {
    ok: false,
    action: "create_enrollment_draft",
    queue_item_id: input?.queue_item_id ?? null,
    growth_lead_id: null,
    enrollment_draft_id: null,
    source_attribution: buildApolloEnrollmentSourceAttributionChain(),
    staging_evidence: input?.staging_evidence ?? null,
    error,
    blockers: input?.blockers,
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
  }
}

async function loadStagingCompanyCandidateForDraft(
  admin: SupabaseClient,
  input: {
    lookup_key: string
    queue_item_id?: string | null
  },
): Promise<
  | {
      ok: true
      company: ApolloEnrollmentDraftStagingCompanyCandidate
      staging_evidence: ApolloPrimaryContactEnrollmentDraftStagingEvidence
    }
  | {
      ok: false
      code: "company_candidate_not_found"
      staging_evidence: ApolloPrimaryContactEnrollmentDraftStagingEvidence
    }
> {
  const lookupKey = asString(input.lookup_key)
  const staging = await loadStagingCompanyCandidateRow(admin, lookupKey)
  if (!staging) {
    return {
      ok: false,
      code: "company_candidate_not_found",
      staging_evidence: buildApolloEnrollmentDraftStagingEvidence({
        lookup_key: lookupKey,
        queue_item_id: input.queue_item_id ?? null,
      }),
    }
  }

  const domain = canonicalNormalizedDomain(
    asString(staging.row.domain),
    asString(staging.row.website),
  )
  const resolution = await resolveApolloEnrichmentCanonicalCompanyId(admin, {
    company_candidate_id: lookupKey,
    domain,
  })

  const mapped = mapApolloEnrollmentDraftStagingRow({
    lookup_key: staging.lookup_key,
    source_table: staging.source_table,
    staging_row_id: staging.staging_row_id,
    row: staging.row,
    canonical_company_id: resolution.canonical_company_id,
    queue_item_id: input.queue_item_id ?? null,
  })

  if (!mapped.company.company_name.trim()) {
    return {
      ok: false,
      code: "company_candidate_not_found",
      staging_evidence: mapped.staging_evidence,
    }
  }

  return {
    ok: true,
    company: mapped.company,
    staging_evidence: mapped.staging_evidence,
  }
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
    confidence_score:
      typeof row.confidence_score === "number" ? row.confidence_score : Number(row.confidence_score ?? 0),
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

function companyContactToImportRow(
  contact: GrowthCompanyContact,
  company: ApolloEnrollmentDraftStagingCompanyCandidate,
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
    externalRef: `apollo:contact:${contact.id}`,
  }
}

async function linkCompanyContactToLead(
  admin: SupabaseClient,
  input: {
    companyContactId: string
    leadId: string
    decisionMakerId?: string | null
    queueItemId: string
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
        apollo_enrollment_queue_item_id: input.queueItemId,
        promoted_at: metadata.promoted_at ?? new Date().toISOString(),
      },
    })
    .eq("id", input.companyContactId)
}

async function resolveOrCreateGrowthLeadForApolloQueueItem(
  admin: SupabaseClient,
  input: {
    queue_item_id: string
    company_candidate_id: string
    company_contact_id: string
    created_by?: string | null
  },
): Promise<
  | { ok: true; lead_id: string; staging_evidence: ApolloPrimaryContactEnrollmentDraftStagingEvidence }
  | {
      ok: false
      code: string
      staging_evidence: ApolloPrimaryContactEnrollmentDraftStagingEvidence | null
    }
> {
  const { data: contactRow, error: contactError } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("*")
    .eq("id", input.company_contact_id)
    .maybeSingle()

  if (contactError) {
    return {
      ok: false,
      code: contactError.message,
      staging_evidence: buildApolloEnrollmentDraftStagingEvidence({
        lookup_key: input.company_candidate_id,
        queue_item_id: input.queue_item_id,
      }),
    }
  }
  if (!contactRow) {
    return {
      ok: false,
      code: "company_contact_not_found",
      staging_evidence: buildApolloEnrollmentDraftStagingEvidence({
        lookup_key: input.company_candidate_id,
        queue_item_id: input.queue_item_id,
      }),
    }
  }

  const contact = rowToCompanyContact(contactRow as Record<string, unknown>)

  if (contact.contact_status === "suppressed" || contact.contact_status === "archived") {
    return {
      ok: false,
      code: "contact_suppressed",
      staging_evidence: buildApolloEnrollmentDraftStagingEvidence({
        lookup_key: input.company_candidate_id,
        queue_item_id: input.queue_item_id,
      }),
    }
  }

  if (contact.growth_lead_id) {
    const lead = await fetchGrowthLeadById(admin, contact.growth_lead_id)
    if (lead) {
      const existingStaging = await loadStagingCompanyCandidateForDraft(admin, {
        lookup_key: input.company_candidate_id,
        queue_item_id: input.queue_item_id,
      })
      return {
        ok: true,
        lead_id: lead.id,
        staging_evidence: existingStaging.staging_evidence,
      }
    }
  }

  const staging = await loadStagingCompanyCandidateForDraft(admin, {
    lookup_key: input.company_candidate_id,
    queue_item_id: input.queue_item_id,
  })
  if (!staging.ok) {
    return {
      ok: false,
      code: staging.code,
      staging_evidence: staging.staging_evidence,
    }
  }

  const company = staging.company
  const normalized = companyContactToImportRow(contact, company)
  const dedupe = await findImportDedupeMatch(admin, {
    vendorKey: "apollo_primary_contact",
    row: normalized,
    externalRef: normalized.externalRef,
  })
  const action = proposeImportRowAction(dedupe, "skip_high_confidence")

  if ((action === "skip" || action === "merge") && dedupe) {
    await linkCompanyContactToLead(admin, {
      companyContactId: contact.id,
      leadId: dedupe.leadId,
      queueItemId: input.queue_item_id,
    })
    return { ok: true, lead_id: dedupe.leadId, staging_evidence: staging.staging_evidence }
  }

  if (action === "skip") {
    return { ok: false, code: "dedupe_skip", staging_evidence: staging.staging_evidence }
  }

  const lead = await createGrowthLead(admin, {
    sourceKind: "other",
    sourceDetail: "apollo_primary_contact",
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
      apollo_primary_contact: {
        company_contact_id: contact.id,
        company_candidate_id: input.company_candidate_id,
        staging_row_id: company.staging_row_id,
        contact_candidate_id: contact.contact_candidate_id,
        queue_item_id: input.queue_item_id,
        staging_evidence: staging.staging_evidence,
        source_attribution: buildApolloEnrollmentSourceAttributionChain(),
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
    sourceDetail: "apollo_primary_contact",
    confidence: contact.confidence_score / 100,
    isPrimary: true,
    createdBy: input.created_by ?? null,
  })

  await recomputeGrowthLeadWorkflowSignals(admin, lead.id)

  await linkCompanyContactToLead(admin, {
    companyContactId: contact.id,
    leadId: lead.id,
    decisionMakerId: decisionMaker.id,
    queueItemId: input.queue_item_id,
  })

  return { ok: true, lead_id: lead.id, staging_evidence: staging.staging_evidence }
}

async function recordDraftEvidence(
  admin: SupabaseClient,
  input: {
    queue_item_id: string
    company_candidate_id: string
    company_contact_id: string | null
    growth_lead_id: string | null
    enrollment_draft_id: string | null
    status: "draft_created" | "blocked"
    blockers: string[]
    staging_evidence?: ApolloPrimaryContactEnrollmentDraftStagingEvidence | null
    created_by?: string | null
    created_by_email?: string | null
  },
): Promise<void> {
  await admin.schema("growth").from(DRAFTS_TABLE).insert({
    queue_item_id: input.queue_item_id,
    company_candidate_id: input.company_candidate_id,
    company_contact_id: input.company_contact_id,
    growth_lead_id: input.growth_lead_id,
    sequence_enrollment_id: input.enrollment_draft_id,
    status: input.status,
    blockers: input.blockers,
    source_attribution: buildApolloEnrollmentSourceAttributionChain(),
    auto_enrollment_attempted: false,
    outreach_sent: false,
    created_by: input.created_by ?? null,
    created_by_email: input.created_by_email ?? null,
    metadata: {
      qa_marker: APOLLO_PRIMARY_CONTACT_ENROLLMENT_DRAFT_QA_MARKER,
      staging_evidence: input.staging_evidence ?? null,
    },
  })
}

async function patchQueueDraftMetadata(
  admin: SupabaseClient,
  input: {
    queue_item_id: string
    existing_metadata: Record<string, unknown>
    growth_lead_id: string
    enrollment_draft_id: string
    created_by_email?: string | null
    blockers?: string[]
  },
): Promise<void> {
  const now = new Date().toISOString()
  await admin
    .schema("growth")
    .from(QUEUE_TABLE)
    .update({
      updated_at: now,
      metadata: {
        ...input.existing_metadata,
        qa_marker: APOLLO_PRIMARY_CONTACT_ENROLLMENT_DRAFT_QA_MARKER,
        apollo_enrollment_draft: {
          growth_lead_id: input.growth_lead_id,
          enrollment_draft_id: input.enrollment_draft_id,
          created_at: now,
          created_by_email: input.created_by_email ?? null,
          source_attribution: buildApolloEnrollmentSourceAttributionChain(),
          blockers: input.blockers ?? [],
        },
      },
    })
    .eq("id", input.queue_item_id)
}

export async function loadApolloPrimaryContactEnrollmentDraftSnapshot(
  admin: SupabaseClient,
  input?: {
    company_candidate_id?: string | null
    limit?: number
  },
): Promise<ApolloPrimaryContactEnrollmentDraftSnapshot> {
  let query = admin
    .schema("growth")
    .from(QUEUE_TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 100)

  const companyCandidateId = asString(input?.company_candidate_id)
  if (companyCandidateId) {
    query = query.eq("company_candidate_id", companyCandidateId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const items = ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const queueRow = mapEnrollmentQueueDbRow(row)
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
    return mapApolloEnrollmentDraftQueueRow({ queue_row: queueRow, metadata })
  })

  return buildApolloPrimaryContactEnrollmentDraftSnapshot({ items })
}

export async function createApolloPrimaryContactEnrollmentDraft(
  admin: SupabaseClient,
  input: {
    queue_item_id: string
    acting_user_id?: string | null
    acting_user_email?: string | null
    pattern_id?: string | null
  },
): Promise<ApolloPrimaryContactEnrollmentDraftActionResult> {
  const { data, error } = await admin
    .schema("growth")
    .from(QUEUE_TABLE)
    .select("*")
    .eq("id", input.queue_item_id)
    .maybeSingle()

  if (error) return emptyDraftActionResult(error.message, { queue_item_id: input.queue_item_id })
  if (!data) return emptyDraftActionResult("queue_item_not_found", { queue_item_id: input.queue_item_id })

  const dbRow = data as Record<string, unknown>
  const queueRow = mapEnrollmentQueueDbRow(dbRow)
  const metadata =
    dbRow.metadata && typeof dbRow.metadata === "object"
      ? (dbRow.metadata as Record<string, unknown>)
      : {}
  const existingDraft = readApolloEnrollmentDraftFromQueueMetadata(metadata)

  const gate = evaluateApolloEnrollmentDraftGates({
    queue_row: queueRow,
    enrollment_draft_id: existingDraft.enrollment_draft_id,
  })

  if (!gate.allowed) {
    await recordDraftEvidence(admin, {
      queue_item_id: input.queue_item_id,
      company_candidate_id: queueRow.company_candidate_id,
      company_contact_id: queueRow.company_contact_id,
      growth_lead_id: existingDraft.growth_lead_id,
      enrollment_draft_id: null,
      status: "blocked",
      blockers: gate.blockers,
      created_by: input.acting_user_id ?? null,
      created_by_email: input.acting_user_email ?? null,
    })

    return emptyDraftActionResult(gate.code ?? "draft_blocked", {
      queue_item_id: input.queue_item_id,
      blockers: gate.blockers,
    })
  }

  if (!queueRow.company_contact_id) {
    return emptyDraftActionResult("missing_company_contact_id", { queue_item_id: input.queue_item_id })
  }

  const leadResolution = await resolveOrCreateGrowthLeadForApolloQueueItem(admin, {
    queue_item_id: input.queue_item_id,
    company_candidate_id: queueRow.company_candidate_id,
    company_contact_id: queueRow.company_contact_id,
    created_by: input.acting_user_id ?? null,
  })

  if (!leadResolution.ok) {
    await recordDraftEvidence(admin, {
      queue_item_id: input.queue_item_id,
      company_candidate_id: queueRow.company_candidate_id,
      company_contact_id: queueRow.company_contact_id,
      growth_lead_id: null,
      enrollment_draft_id: null,
      status: "blocked",
      blockers: [leadResolution.code],
      staging_evidence: leadResolution.staging_evidence,
      created_by: input.acting_user_id ?? null,
      created_by_email: input.acting_user_email ?? null,
    })

    logGrowthEngine("apollo_primary_contact_enrollment_draft_staging_blocked", {
      queue_item_id: input.queue_item_id.slice(0, 8),
      code: leadResolution.code,
      lookup_key: leadResolution.staging_evidence?.lookup_key?.slice(0, 8) ?? null,
      staging_table_detected: leadResolution.staging_evidence?.staging_table_detected ?? null,
      staging_row_id: leadResolution.staging_evidence?.staging_row_id?.slice(0, 8) ?? null,
      candidate_domain_normalized: leadResolution.staging_evidence?.candidate_domain_normalized ?? null,
      canonical_company_id: leadResolution.staging_evidence?.canonical_company_id?.slice(0, 8) ?? null,
      auto_enrollment: false,
      outreach_sent: false,
    })

    return emptyDraftActionResult(leadResolution.code, {
      queue_item_id: input.queue_item_id,
      blockers: [leadResolution.code],
      staging_evidence: leadResolution.staging_evidence,
    })
  }

  const stagingEvidence = leadResolution.staging_evidence

  const lead = await fetchGrowthLeadById(admin, leadResolution.lead_id)
  if (!lead) {
    return emptyDraftActionResult("lead_not_found", {
      queue_item_id: input.queue_item_id,
      staging_evidence: stagingEvidence,
    })
  }

  const preflight = await runSequenceEnrollmentPreflight(admin, lead, {
    patternId: input.pattern_id ?? null,
  })

  if (!preflight.allowed) {
    const blockers = [preflight.code ?? "preflight_blocked"]
    await recordDraftEvidence(admin, {
      queue_item_id: input.queue_item_id,
      company_candidate_id: queueRow.company_candidate_id,
      company_contact_id: queueRow.company_contact_id,
      growth_lead_id: lead.id,
      enrollment_draft_id: null,
      status: "blocked",
      blockers,
      staging_evidence: stagingEvidence,
      created_by: input.acting_user_id ?? null,
      created_by_email: input.acting_user_email ?? null,
    })

    await admin
      .schema("growth")
      .from(QUEUE_TABLE)
      .update({
        updated_at: new Date().toISOString(),
        metadata: {
          ...metadata,
          apollo_enrollment_draft: {
            growth_lead_id: lead.id,
            enrollment_draft_id: null,
            blockers,
            source_attribution: buildApolloEnrollmentSourceAttributionChain(),
          },
        },
      })
      .eq("id", input.queue_item_id)

    return emptyDraftActionResult(preflight.code ?? "preflight_blocked", {
      queue_item_id: input.queue_item_id,
      blockers,
      staging_evidence: stagingEvidence,
    })
  }

  let enrollment
  try {
    enrollment = await createGrowthSequenceEnrollmentDraft(admin, {
      leadId: lead.id,
      patternId: input.pattern_id ?? null,
      actingUserId: input.acting_user_id ?? "system",
      actingUserEmail: input.acting_user_email ?? "system@equipify.internal",
    })
  } catch (draftError) {
    const code = draftError instanceof Error ? draftError.message : "draft_creation_failed"
    const blockers = [code]

    await recordDraftEvidence(admin, {
      queue_item_id: input.queue_item_id,
      company_candidate_id: queueRow.company_candidate_id,
      company_contact_id: queueRow.company_contact_id,
      growth_lead_id: lead.id,
      enrollment_draft_id: null,
      status: "blocked",
      blockers,
      staging_evidence: stagingEvidence,
      created_by: input.acting_user_id ?? null,
      created_by_email: input.acting_user_email ?? null,
    })

    return emptyDraftActionResult(code, {
      queue_item_id: input.queue_item_id,
      blockers,
      staging_evidence: stagingEvidence,
    })
  }

  await recordDraftEvidence(admin, {
    queue_item_id: input.queue_item_id,
    company_candidate_id: queueRow.company_candidate_id,
    company_contact_id: queueRow.company_contact_id,
    growth_lead_id: lead.id,
    enrollment_draft_id: enrollment.id,
    status: "draft_created",
    blockers: [],
    staging_evidence: stagingEvidence,
    created_by: input.acting_user_id ?? null,
    created_by_email: input.acting_user_email ?? null,
  })

  await patchQueueDraftMetadata(admin, {
    queue_item_id: input.queue_item_id,
    existing_metadata: metadata,
    growth_lead_id: lead.id,
    enrollment_draft_id: enrollment.id,
    created_by_email: input.acting_user_email ?? null,
  })

  logGrowthEngine("apollo_primary_contact_enrollment_draft_created", {
    queue_item_id: input.queue_item_id.slice(0, 8),
    lead_id: lead.id.slice(0, 8),
    enrollment_id: enrollment.id.slice(0, 8),
    lookup_key: stagingEvidence.lookup_key.slice(0, 8),
    staging_table_detected: stagingEvidence.staging_table_detected,
    staging_row_id: stagingEvidence.staging_row_id?.slice(0, 8) ?? null,
    candidate_domain_normalized: stagingEvidence.candidate_domain_normalized,
    canonical_company_id: stagingEvidence.canonical_company_id?.slice(0, 8) ?? null,
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
  })

  return {
    ok: true,
    action: "create_enrollment_draft",
    queue_item_id: input.queue_item_id,
    growth_lead_id: lead.id,
    enrollment_draft_id: enrollment.id,
    source_attribution: buildApolloEnrollmentSourceAttributionChain(),
    staging_evidence: stagingEvidence,
    auto_enrollment: false,
    outreach_sent: false,
    enrolled_count: 0,
    outreach_count: 0,
  }
}

/** Loads enrollment approval queue and merges draft snapshot evidence for unified panel display. */
export async function loadApolloPrimaryContactEnrollmentDraftPanelSnapshot(
  admin: SupabaseClient,
  input?: {
    company_candidate_id?: string | null
    limit?: number
  },
): Promise<ApolloPrimaryContactEnrollmentDraftSnapshot> {
  const queueSnapshot = await loadApolloPrimaryContactEnrollmentApprovalQueue(admin, {
    company_candidate_id: input?.company_candidate_id,
    status: "all",
    limit: input?.limit,
  })

  const { data: queueRows } = await admin
    .schema("growth")
    .from(QUEUE_TABLE)
    .select("id, metadata")
    .in(
      "id",
      queueSnapshot.items.map((item) => item.queue_item_id),
    )

  const metadataByQueueId = new Map<string, Record<string, unknown>>()
  for (const row of (queueRows ?? []) as Record<string, unknown>[]) {
    const id = asString(row.id)
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {}
    metadataByQueueId.set(id, metadata)
  }

  const items = queueSnapshot.items.map((queueRow) =>
    mapApolloEnrollmentDraftQueueRow({
      queue_row: queueRow,
      metadata: metadataByQueueId.get(queueRow.queue_item_id) ?? null,
    }),
  )

  return buildApolloPrimaryContactEnrollmentDraftSnapshot({ items })
}
