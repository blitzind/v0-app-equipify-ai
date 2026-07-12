import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeCompanyContactCoverage } from "@/lib/growth/contact-discovery/company-contact-coverage"
import {
  GROWTH_COMPANY_CONTACTS_PRIVACY_NOTE,
  GROWTH_COMPANY_CONTACTS_QA_MARKER,
  type GrowthCompanyContact,
  type GrowthCompanyContactCoverage,
  type GrowthCompanyContactsSnapshot,
  type GrowthCompanyContactStatus,
} from "@/lib/growth/contact-discovery/company-contact-types"
import { isGrowthCompanyContactsSchemaReady, probeGrowthCompanyContactsSchema } from "@/lib/growth/contact-discovery/company-contact-schema-health"
import { scoreDecisionMakerTitle } from "@/lib/growth/contact-discovery/decision-maker-score"
import type { ExtractedWebsiteContact } from "@/lib/growth/contact-discovery/extract/extract-shared"
import {
  companyContactDedupeHash,
  discoverWebsiteContacts,
} from "@/lib/growth/contact-discovery/website-contact-discovery"
import { verifyCompanyContact } from "@/lib/growth/contact-verification/verify-contact"
import { scheduleUnifiedRevenueWorkflowLifecycleReEvaluation } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-lifecycle-runner"

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
    contact_status: asString(row.contact_status) as GrowthCompanyContactStatus,
    last_verified_at: asString(row.last_verified_at) || null,
    dedupe_hash: asString(row.dedupe_hash),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    metadata:
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
  }
}

function extractedToInsertRow(input: {
  company_id: string
  growth_lead_id?: string | null
  extracted: ExtractedWebsiteContact
}): Record<string, unknown> {
  const score = scoreDecisionMakerTitle({
    title: input.extracted.title,
    source_type: input.extracted.source_type,
    evidence_count: input.extracted.source_evidence.length,
    has_website_evidence: true,
    exact_title_match: Boolean(input.extracted.title),
  })

  const dedupe_hash = companyContactDedupeHash({
    company_id: input.company_id,
    full_name: input.extracted.full_name,
    title: input.extracted.title,
    email: input.extracted.email,
  })

  return {
    company_id: input.company_id,
    growth_lead_id: input.growth_lead_id ?? null,
    full_name: input.extracted.full_name,
    first_name: input.extracted.first_name,
    last_name: input.extracted.last_name,
    title: input.extracted.title,
    department: input.extracted.department,
    email: input.extracted.email,
    email_status: input.extracted.email ? "discovered" : "unknown",
    phone: input.extracted.phone,
    phone_status: input.extracted.phone ? "unknown" : "unknown",
    linkedin_url: input.extracted.linkedin_url,
    confidence_score: score.confidence_score,
    decision_maker_score: score.decision_maker_score,
    source_type: input.extracted.source_type,
    source_evidence: input.extracted.source_evidence,
    contact_status: "candidate",
    dedupe_hash,
    metadata: {
      qa_marker: GROWTH_COMPANY_CONTACTS_QA_MARKER,
      confidence_reasoning: score.confidence_reasoning,
      leadership_indicator: input.extracted.leadership_indicator,
      source_page_type: input.extracted.source_page_type,
      source_page_url: input.extracted.source_page_url,
      email_classification: input.extracted.email_classification,
      phone_classification: input.extracted.phone_classification,
      evidence_quality_score: input.extracted.evidence_quality_score,
      evidence_quality_label: input.extracted.evidence_quality_label,
      evidence_quality_reasons: input.extracted.evidence_quality_reasons,
      extraction_risks: input.extracted.extraction_risks,
      branch_name: input.extracted.branch_name,
      branch_city: input.extracted.branch_city,
      branch_state: input.extracted.branch_state,
      branch_phone: input.extracted.branch_phone,
      location_confidence: input.extracted.location_confidence,
      linkedin_company_url: input.extracted.linkedin_company_url,
      linkedin_reference_label: input.extracted.linkedin_reference_label,
    },
  }
}

export async function listCompanyContacts(
  admin: SupabaseClient,
  companyId: string,
  limit = 50,
): Promise<GrowthCompanyContact[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("*")
    .eq("company_id", companyId)
    .neq("contact_status", "archived")
    .order("decision_maker_score", { ascending: false })
    .order("confidence_score", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => rowToCompanyContact(row as Record<string, unknown>))
}

export async function loadCompanyContactsSnapshot(
  admin: SupabaseClient,
  companyId: string,
): Promise<GrowthCompanyContactsSnapshot> {
  const schema_health = await probeGrowthCompanyContactsSchema(admin)
  const schema_ready = schema_health.ready
  if (!schema_ready) {
    return {
      qa_marker: GROWTH_COMPANY_CONTACTS_QA_MARKER,
      schema_ready: false,
      schema_health,
      company_id: companyId,
      contacts: [],
      coverage: computeCompanyContactCoverage([]),
      privacy_note: GROWTH_COMPANY_CONTACTS_PRIVACY_NOTE,
    }
  }

  const contacts = await listCompanyContacts(admin, companyId)
  return {
    qa_marker: GROWTH_COMPANY_CONTACTS_QA_MARKER,
    schema_ready: true,
    schema_health,
    company_id: companyId,
    contacts,
    coverage: computeCompanyContactCoverage(contacts),
    privacy_note: GROWTH_COMPANY_CONTACTS_PRIVACY_NOTE,
  }
}

export async function upsertExtractedCompanyContacts(
  admin: SupabaseClient,
  input: {
    company_id: string
    growth_lead_id?: string | null
    extracted: ExtractedWebsiteContact[]
    extraction_diagnostics?: import("@/lib/growth/contact-discovery/website-extraction-acquisition-types").WebsiteExtractionDiagnosticsSnapshot
  },
): Promise<GrowthCompanyContact[]> {
  if (!(await isGrowthCompanyContactsSchemaReady(admin))) return []
  const stored: GrowthCompanyContact[] = []
  const nowIso = new Date().toISOString()

  for (const item of input.extracted) {
    const row = extractedToInsertRow({
      company_id: input.company_id,
      growth_lead_id: input.growth_lead_id,
      extracted: item,
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
      const mergedEvidence = [...prior.source_evidence]
      for (const next of (row.source_evidence as GrowthCompanyContact["source_evidence"]) ?? []) {
        const duplicate = mergedEvidence.some(
          (item) => item.claim === next.claim && item.page_url === next.page_url,
        )
        if (!duplicate) mergedEvidence.push(next)
      }

      const mergedConfidence = Math.max(prior.confidence_score, Number(row.confidence_score ?? 0))
      const { data, error } = await admin
        .schema("growth")
        .from("company_contacts")
        .update({
          email: prior.email ?? row.email,
          phone: prior.phone ?? row.phone,
          linkedin_url: prior.linkedin_url ?? row.linkedin_url,
          title: prior.title ?? row.title,
          confidence_score: mergedConfidence,
          source_evidence: mergedEvidence,
          updated_at: nowIso,
          metadata: {
            ...prior.metadata,
            ...(row.metadata as Record<string, unknown>),
            last_checked_at: nowIso,
            discovery_provider: "website_public_extract",
            ...(input.extraction_diagnostics
              ? { website_extraction_diagnostics: input.extraction_diagnostics }
              : {}),
          },
        })
        .eq("id", prior.id)
        .select("*")
        .single()
      if (!error && data) stored.push(rowToCompanyContact(data as Record<string, unknown>))
      continue
    }

    const { data, error } = await admin
      .schema("growth")
      .from("company_contacts")
      .insert({
        ...row,
        metadata: {
          ...(row.metadata as Record<string, unknown>),
          last_checked_at: nowIso,
          discovery_provider: "website_public_extract",
          ...(input.extraction_diagnostics
            ? { website_extraction_diagnostics: input.extraction_diagnostics }
            : {}),
        },
      })
      .select("*")
      .single()
    if (!error && data) stored.push(rowToCompanyContact(data as Record<string, unknown>))
  }

  return stored
}

export async function runWebsiteContactDiscoveryForCompany(
  admin: SupabaseClient,
  input: {
    company_id: string
    website: string | null | undefined
    growth_lead_id?: string | null
  },
): Promise<GrowthCompanyContactsSnapshot> {
  const discovery = await discoverWebsiteContacts(input.website)
  if (discovery.contacts.length > 0) {
    await upsertExtractedCompanyContacts(admin, {
      company_id: input.company_id,
      growth_lead_id: input.growth_lead_id,
      extracted: discovery.contacts,
      extraction_diagnostics: discovery.diagnostics,
    })
  }
  return loadCompanyContactsSnapshot(admin, input.company_id)
}

export async function refreshCompanyContactVerification(
  admin: SupabaseClient,
  contactId: string,
): Promise<GrowthCompanyContact | null> {
  const { data, error } = await admin.schema("growth").from("company_contacts").select("*").eq("id", contactId).maybeSingle()
  if (error || !data) return null
  const contact = rowToCompanyContact(data as Record<string, unknown>)
  const verification = await verifyCompanyContact(contact, { admin })
  const { data: updated, error: updateError } = await admin
    .schema("growth")
    .from("company_contacts")
    .update({
      email_status: verification.email_status,
      phone_status: verification.phone_status,
      confidence_score: verification.confidence_score,
      last_verified_at: verification.last_verified_at,
      updated_at: new Date().toISOString(),
      metadata: {
        ...contact.metadata,
        ...verification.email_verification_metadata,
        verification_reasons: verification.verification_reasons,
      },
    })
    .eq("id", contactId)
    .select("*")
    .single()
  if (updateError || !updated) return null
  const refreshed = rowToCompanyContact(updated as Record<string, unknown>)
  if (refreshed.growth_lead_id) {
    const emailVerified =
      refreshed.email_status === "verified" && contact.email_status !== "verified"
    const phoneVerified =
      refreshed.phone_status === "verified" && contact.phone_status !== "verified"
    if (emailVerified) {
      void scheduleUnifiedRevenueWorkflowLifecycleReEvaluation({
        admin,
        leadId: refreshed.growth_lead_id,
        event: "email_verified",
      })
      const { getGrowthEngineAiOrgId } = await import("@/lib/growth/access")
      const organizationId = getGrowthEngineAiOrgId()
      if (organizationId) {
        const { publishDraftFactoryContactVerified } = await import(
          "@/lib/growth/draft-factory/draft-factory-wake-emitters"
        )
        void publishDraftFactoryContactVerified(admin, {
          organizationId,
          leadId: refreshed.growth_lead_id,
          contactId: refreshed.id,
        })
      }
    }
    if (phoneVerified) {
      void scheduleUnifiedRevenueWorkflowLifecycleReEvaluation({
        admin,
        leadId: refreshed.growth_lead_id,
        event: "phone_verified",
      })
    }
  }
  return refreshed
}

export async function updateCompanyContactStatus(
  admin: SupabaseClient,
  contactId: string,
  contact_status: GrowthCompanyContactStatus,
): Promise<GrowthCompanyContact | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("company_contacts")
    .update({ contact_status, updated_at: new Date().toISOString() })
    .eq("id", contactId)
    .select("*")
    .single()
  if (error || !data) return null
  return rowToCompanyContact(data as Record<string, unknown>)
}

export async function queueStaleCompanyContactRefresh(admin: SupabaseClient, limit = 50): Promise<number> {
  const staleBefore = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("id")
    .neq("contact_status", "archived")
    .or(`last_verified_at.is.null,last_verified_at.lt.${staleBefore}`)
    .limit(limit)

  let queued = 0
  for (const row of data ?? []) {
    const id = asString((row as Record<string, unknown>).id)
    if (!id) continue
    const { error } = await admin.schema("growth").from("company_contact_refresh_queue").upsert(
      {
        company_contact_id: id,
        reason: "stale",
        status: "pending",
        scheduled_for: new Date().toISOString(),
      },
      { onConflict: "company_contact_id,reason" },
    )
    if (!error) queued += 1
  }
  return queued
}

export async function processCompanyContactRefreshQueue(
  admin: SupabaseClient,
  limit = 25,
): Promise<{ processed: number; failed: number }> {
  const { data } = await admin
    .schema("growth")
    .from("company_contact_refresh_queue")
    .select("id, company_contact_id")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit)

  let processed = 0
  let failed = 0

  for (const row of data ?? []) {
    const queueId = asString((row as Record<string, unknown>).id)
    const contactId = asString((row as Record<string, unknown>).company_contact_id)
    if (!queueId || !contactId) continue

    await admin.schema("growth").from("company_contact_refresh_queue").update({ status: "running" }).eq("id", queueId)

    try {
      const refreshed = await refreshCompanyContactVerification(admin, contactId)
      if (!refreshed) throw new Error("Contact refresh failed")
      await admin
        .schema("growth")
        .from("company_contact_refresh_queue")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", queueId)
      if (refreshed.company_id) {
        const { triggerEmailDiscoveryAfterCompanyEnriched } = await import(
          "@/lib/growth/email-discovery/email-discovery-triggers"
        )
        void triggerEmailDiscoveryAfterCompanyEnriched(admin, { company_id: refreshed.company_id })
        const { triggerPhoneDiscoveryAfterCompanyEnriched } = await import(
          "@/lib/growth/phone-discovery/phone-discovery-triggers"
        )
        void triggerPhoneDiscoveryAfterCompanyEnriched(admin, { company_id: refreshed.company_id })
        const { triggerSocialProfileDiscoveryAfterCompanyEnriched } = await import(
          "@/lib/growth/social-profile-discovery/social-profile-discovery-triggers"
        )
        void triggerSocialProfileDiscoveryAfterCompanyEnriched(admin, { company_id: refreshed.company_id })
        const { triggerCompanyIntelligenceAfterCompanyEnriched } = await import(
          "@/lib/growth/company-intelligence/company-intelligence-triggers"
        )
        void triggerCompanyIntelligenceAfterCompanyEnriched(admin, { company_id: refreshed.company_id })
      }
      processed += 1
    } catch (error) {
      failed += 1
      await admin
        .schema("growth")
        .from("company_contact_refresh_queue")
        .update({
          status: "failed",
          last_error: error instanceof Error ? error.message : "Refresh failed",
          attempts: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", queueId)
    }
  }

  return { processed, failed }
}

export function companyContactCoverageForBridge(contacts: GrowthCompanyContact[]): GrowthCompanyContactCoverage {
  return computeCompanyContactCoverage(contacts)
}
