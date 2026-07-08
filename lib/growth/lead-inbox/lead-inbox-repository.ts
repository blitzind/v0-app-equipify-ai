import type { SupabaseClient } from "@supabase/supabase-js"
import {
  checkLeadInboxDuplicate,
  resolveLeadInboxCrmMatches,
  validateInboxPiiPolicy,
} from "@/lib/growth/lead-inbox/lead-inbox-dedupe"
import {
  buildCanonicalIntakeLeadMetadata,
  GROWTH_LEAD_INBOX_CANONICAL_INTAKE_CUTOVER_QA_MARKER,
  resolveCanonicalLeadForInboxInput,
} from "@/lib/growth/lead-inbox/lead-inbox-canonical-intake-bridge"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById, updateGrowthLead } from "@/lib/growth/lead-repository"
import {
  GROWTH_LEAD_INBOX_QA_MARKER,
  type GrowthLeadInboxCreateInput,
  type GrowthLeadInboxCreateResult,
} from "@/lib/growth/lead-inbox/lead-inbox-types"

function assertAttributionAndEvidence(input: GrowthLeadInboxCreateInput): string | null {
  if (input.candidate_attribution.length === 0) {
    return "candidate_attribution is required."
  }
  if (input.candidate_evidence.length === 0) {
    return "candidate_evidence is required."
  }
  for (const entry of input.candidate_attribution) {
    if (!entry.source?.trim() || !entry.evidence?.trim()) {
      return "Each attribution entry requires source and evidence."
    }
  }
  return null
}

/** Canonical-only intake — creates/resolves growth.leads; no lead_inbox insert (GE-LEADS-CANONICAL-4B). */
export async function createLeadCandidate(
  admin: SupabaseClient,
  input: GrowthLeadInboxCreateInput,
): Promise<GrowthLeadInboxCreateResult> {
  const validationError = assertAttributionAndEvidence(input)
  if (validationError) {
    return {
      qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
      ok: false,
      row: null,
      duplicate: false,
      reason: validationError,
      errors: [validationError],
    }
  }

  const pii = validateInboxPiiPolicy(input)
  let sanitized = pii.sanitized
  const actor = input.actor

  if (!sanitized.existing_lead_match && !sanitized.existing_account_match) {
    const crm = await resolveLeadInboxCrmMatches(admin, sanitized)
    sanitized = {
      ...sanitized,
      existing_account_match: crm.existing_account_match,
      existing_lead_match: crm.existing_lead_match,
    }
  }

  const dedupe = await checkLeadInboxDuplicate(admin, {
    dedupe_hash: sanitized.dedupe_hash,
    intent_session_id: sanitized.intent_session_id,
    email: sanitized.email,
    phone: sanitized.phone,
    domain: sanitized.domain,
  })

  if (dedupe.is_duplicate && dedupe.existing_growth_lead_id) {
    const existing = await fetchGrowthLeadById(admin, dedupe.existing_growth_lead_id)
    return {
      qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
      ok: false,
      row: null,
      duplicate: true,
      reason: `Duplicate prevented (${dedupe.reasons.join(", ")}).`,
      errors: [],
      growth_lead_id: dedupe.existing_growth_lead_id,
      lead_status: existing?.status ?? null,
      lead_created: false,
    }
  }

  const canonical = await resolveCanonicalLeadForInboxInput(admin, sanitized, actor)
  if ("error" in canonical) {
    return {
      qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
      ok: false,
      row: null,
      duplicate: false,
      reason: canonical.error,
      errors: [canonical.error],
      growth_lead_id: null,
      lead_status: null,
      lead_created: null,
    }
  }

  logGrowthEngine("lead_canonical_intake_linked", {
    growthLeadId: canonical.growth_lead_id,
    leadCreated: canonical.lead_created,
    dedupeRule: canonical.dedupe_rule,
    siteKey: sanitized.site_key,
    cutoverMarker: GROWTH_LEAD_INBOX_CANONICAL_INTAKE_CUTOVER_QA_MARKER,
  })

  try {
    await updateGrowthLead(admin, canonical.growth_lead_id, {
      metadata: buildCanonicalIntakeLeadMetadata(sanitized, canonical),
      externalRef: `lead_inbox:${sanitized.dedupe_hash}`,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
      ok: false,
      row: null,
      duplicate: false,
      reason: message,
      errors: [message],
      growth_lead_id: canonical.growth_lead_id,
      lead_status: canonical.lead_status,
      lead_created: canonical.lead_created,
    }
  }

  return {
    qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
    ok: true,
    row: null,
    duplicate: false,
    reason: "Canonical lead created or resolved.",
    errors: [],
    growth_lead_id: canonical.growth_lead_id,
    lead_status: canonical.lead_status,
    lead_created: canonical.lead_created,
  }
}
