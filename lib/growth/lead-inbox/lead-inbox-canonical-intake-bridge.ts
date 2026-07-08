/**
 * GE-LEADS-CANONICAL-2A — Resolve or create growth.leads before legacy lead_inbox writes.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { normalizeLeadIntakeSource } from "@/lib/growth/revenue-workflow/normalize-lead-intake-source"
import { resolveUnifiedLeadFromIntake } from "@/lib/growth/revenue-workflow/unified-revenue-workflow-lead-resolver"
import type { LeadIntakeSource } from "@/lib/growth/revenue-workflow/unified-lead-intake-types"
import type {
  GrowthLeadInboxCreateInput,
  GrowthLeadInboxCrmMatch,
} from "@/lib/growth/lead-inbox/lead-inbox-types"

export const GROWTH_LEAD_INBOX_CANONICAL_BRIDGE_QA_MARKER =
  "growth-lead-inbox-canonical-bridge-v1" as const

export const GROWTH_LEAD_INBOX_METADATA_GROWTH_LEAD_ID = "growth_lead_id" as const

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

function parseCrmMatch(value: unknown): GrowthLeadInboxCrmMatch {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    matched: row.matched === true,
    source: asString(row.source) || null,
    ids: Array.isArray(row.ids) ? row.ids.filter((id): id is string => typeof id === "string") : [],
    evidence: asString(row.evidence),
  }
}

async function loadDuplicateInboxContext(
  admin: SupabaseClient,
  existingInboxId: string,
): Promise<{
  metadata: Record<string, unknown>
  existing_lead_match: GrowthLeadInboxCrmMatch
  existing_account_match: GrowthLeadInboxCrmMatch
} | null> {
  try {
    const { data } = await admin
      .schema("growth")
      .from("lead_inbox")
      .select("metadata, existing_lead_match, existing_account_match")
      .eq("id", existingInboxId)
      .maybeSingle()
    if (!data) return null
    const row = data as Record<string, unknown>
    return {
      metadata:
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as Record<string, unknown>)
          : {},
      existing_lead_match: parseCrmMatch(row.existing_lead_match),
      existing_account_match: parseCrmMatch(row.existing_account_match),
    }
  } catch {
    return null
  }
}

export async function resolveCanonicalLeadForDuplicateInbox(
  admin: SupabaseClient,
  input: GrowthLeadInboxCreateInput,
  existingInboxId: string,
  actor?: { userId: string | null; email?: string | null },
): Promise<CanonicalInboxIntakeBridgeResult | null> {
  const existingRow = await loadDuplicateInboxContext(admin, existingInboxId)
  if (existingRow) {
    const fromMetadata = readPresetGrowthLeadId(existingRow.metadata)
    if (fromMetadata) {
      const resolved = await resolveFromExistingLeadId(admin, fromMetadata, "inbox_metadata")
      if (resolved) return resolved
    }

    const matchedLeadId = existingRow.existing_lead_match?.ids?.[0]
    if (matchedLeadId) {
      const resolved = await resolveFromExistingLeadId(admin, matchedLeadId, "inbox_crm_lead_match")
      if (resolved) return resolved
    }
  }

  const bridge = await resolveCanonicalLeadForInboxInput(
    admin,
    {
      ...input,
      existing_lead_match: existingRow?.existing_lead_match ?? input.existing_lead_match,
      existing_account_match: existingRow?.existing_account_match ?? input.existing_account_match,
    },
    actor,
  )

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
    canonical_lead_created: canonical.lead_created,
    canonical_lead_status: canonical.lead_status,
    ...(canonical.dedupe_rule ? { canonical_dedupe_rule: canonical.dedupe_rule } : {}),
  }
}
