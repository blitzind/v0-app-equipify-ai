/**
 * GE-LEADS-CANONICAL-4E — Canonical intake bridge (growth.leads only; no lead_inbox writes).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById, mergeGrowthLeadMetadata } from "@/lib/growth/lead-repository"
import { normalizeLeadIntakeSource } from "@/lib/growth/revenue-workflow/normalize-lead-intake-source"
import { resolveUnifiedLeadFromIntake } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-lead-resolver"
import type { LeadIntakeSource } from "@/lib/growth/revenue-workflow/unified-lead-intake-types"
import type { GrowthLeadInboxCreateInput } from "@/lib/growth/lead-inbox/lead-inbox-types"

export const GROWTH_LEAD_INBOX_CANONICAL_BRIDGE_QA_MARKER =
  "growth-lead-inbox-canonical-bridge-v1" as const

export const GROWTH_LEAD_INBOX_CANONICAL_INTAKE_CUTOVER_QA_MARKER =
  "growth-lead-inbox-canonical-intake-cutover-v1" as const

export const GROWTH_LEAD_INBOX_METADATA_GROWTH_LEAD_ID = "growth_lead_id" as const

export const GROWTH_UNIFIED_INTAKE_EXTERNAL_DISCOVERY_ADMISSION_CLOSURE_1M_QA_MARKER =
  "ge-aios-unified-intake-external-discovery-admission-closure-1m-v1" as const

export type CanonicalInboxIntakeBridgeResult = {
  growth_lead_id: string
  lead_status: string
  lead_created: boolean
  dedupe_rule: string | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readPresetGrowthLeadId(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null
  return (
    asString(metadata[GROWTH_LEAD_INBOX_METADATA_GROWTH_LEAD_ID]) ||
    asString(metadata.preset_growth_lead_id) ||
    null
  )
}

export function resolveIntakeSourceFromInboxInput(input: GrowthLeadInboxCreateInput): LeadIntakeSource {
  const siteKey = asString(input.site_key)
  // Autonomous external discovery pushes use site_key prospect_search_external_discovery.
  // Classify as datamoon so Admission applies deferred operational keyword validation (GE-AIOS-1M).
  if (siteKey === "prospect_search_external_discovery") return "datamoon"
  if (siteKey.startsWith("prospect_search")) return "saved_search"
  if (siteKey === "growth_audience") return "saved_search"
  return "website"
}

function websiteFromDomain(domain: string | null | undefined): string | null {
  const normalized = asString(domain)
  if (!normalized) return null
  return normalized.startsWith("http") ? normalized : `https://${normalized}`
}

async function resolveFromExistingLeadId(
  admin: SupabaseClient,
  leadId: string,
  dedupeRule: string,
): Promise<CanonicalInboxIntakeBridgeResult | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (!lead) return null
  return {
    growth_lead_id: lead.id,
    lead_status: lead.status,
    lead_created: false,
    dedupe_rule: dedupeRule,
  }
}

export async function resolveCanonicalLeadForInboxInput(
  admin: SupabaseClient,
  input: GrowthLeadInboxCreateInput,
  actor?: { userId: string | null; email?: string | null },
): Promise<CanonicalInboxIntakeBridgeResult | { error: string }> {
  const presetId = readPresetGrowthLeadId(input.metadata)
  if (presetId) {
    const preset = await resolveFromExistingLeadId(admin, presetId, "preset_growth_lead_id")
    if (preset) return preset
  }

  const matchedLeadId = input.existing_lead_match?.ids?.[0]
  if (matchedLeadId) {
    const matched = await resolveFromExistingLeadId(admin, matchedLeadId, "crm_lead_match")
    if (matched) return matched
  }

  const source = resolveIntakeSourceFromInboxInput(input)
  const intake = normalizeLeadIntakeSource({
    source,
    company: {
      name: input.company_name,
      website: websiteFromDomain(input.domain),
      domain: input.domain ?? null,
    },
    contact: {
      name: input.contact_name,
      email: input.email,
      phone: input.phone,
      linkedinUrl: input.linkedin_url,
    },
    metadata: {
      ...(input.metadata ?? {}),
      leadInboxDedupeHash: input.dedupe_hash,
      intakeSiteKey: input.site_key,
      externalRef: `lead_inbox:${input.dedupe_hash}`,
    },
  })

  if (intake.blockers.includes("company_name_required")) {
    return { error: "company_name_required" }
  }

  try {
    const resolved = await resolveUnifiedLeadFromIntake(admin, intake, actor)
    return {
      growth_lead_id: resolved.lead.id,
      lead_status: resolved.lead.status,
      lead_created: resolved.created,
      dedupe_rule: resolved.dedupeRule,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "canonical_resolve_failed"
    return { error: message }
  }
}

/** @deprecated Legacy inbox rows retired (GE-LEADS-CANONICAL-4E) — resolves via canonical intake only. */
export async function resolveCanonicalLeadForDuplicateInbox(
  admin: SupabaseClient,
  input: GrowthLeadInboxCreateInput,
  _existingInboxId: string,
  actor?: { userId: string | null; email?: string | null },
): Promise<CanonicalInboxIntakeBridgeResult | null> {
  const bridge = await resolveCanonicalLeadForInboxInput(admin, input, actor)
  if ("error" in bridge) return null
  return bridge
}

export function mergeCanonicalLeadIntoInboxMetadata(
  metadata: Record<string, unknown> | undefined,
  canonical: CanonicalInboxIntakeBridgeResult,
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    [GROWTH_LEAD_INBOX_METADATA_GROWTH_LEAD_ID]: canonical.growth_lead_id,
    canonical_intake_bridge: GROWTH_LEAD_INBOX_CANONICAL_BRIDGE_QA_MARKER,
    canonical_intake_cutover: GROWTH_LEAD_INBOX_CANONICAL_INTAKE_CUTOVER_QA_MARKER,
    canonical_lead_created: canonical.lead_created,
    canonical_lead_status: canonical.lead_status,
    ...(canonical.dedupe_rule ? { canonical_dedupe_rule: canonical.dedupe_rule } : {}),
  }
}

/** Persist intake context on growth.leads (GE-LEADS-CANONICAL-4B). */
export function buildCanonicalIntakeLeadMetadata(
  input: GrowthLeadInboxCreateInput,
  canonical: CanonicalInboxIntakeBridgeResult,
  existingLeadMetadata?: Record<string, unknown> | null,
): Record<string, unknown> {
  return mergeCanonicalLeadIntoInboxMetadata(
    mergeGrowthLeadMetadata(existingLeadMetadata, {
      ...(input.metadata ?? {}),
      leadInboxDedupeHash: input.dedupe_hash,
      intake_site_key: input.site_key,
      intent_session_id: input.intent_session_id,
      visitor_key: input.visitor_key,
      session_count: input.session_count,
      visit_count: input.visit_count,
      utm_source: input.utm_source ?? "",
      utm_medium: input.utm_medium ?? "",
      utm_campaign: input.utm_campaign ?? "",
      candidate_type: input.candidate_type,
      candidate_priority: input.candidate_priority,
      intent_score: input.intent_score,
      intent_grade: input.intent_grade,
      candidate_confidence: input.candidate_confidence,
      pipeline_entry: input.pipeline_entry,
      candidate_reasoning: input.candidate_reasoning,
      candidate_evidence: input.candidate_evidence,
      candidate_attribution: input.candidate_attribution,
      existing_account_match: input.existing_account_match,
      existing_lead_match: input.existing_lead_match,
      revenue_queue_source: "canonical",
    }),
    canonical,
  )
}
