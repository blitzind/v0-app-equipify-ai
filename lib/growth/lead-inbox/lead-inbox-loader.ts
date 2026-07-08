import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthIntentLeadCandidate } from "@/lib/growth/lead-engine/intent/intent-candidate-types"
import {
  checkLeadInboxDuplicate,
  resolveLeadInboxCrmMatches,
  validateInboxPiiPolicy,
} from "@/lib/growth/lead-inbox/lead-inbox-dedupe"
import { createLeadCandidate } from "@/lib/growth/lead-inbox/lead-inbox-repository"
import { persistBuyingStageAssessment } from "@/lib/growth/buying-stage/buying-stage-repository"
import {
  linkCompanyMatchesToLeadInbox,
  persistCompanyIdentificationMatches,
} from "@/lib/growth/company-identification/company-identification-repository"
import {
  linkSearchIntentSignalsToLeadInbox,
  persistSearchIntentSignals,
} from "@/lib/growth/search-intent/search-intent-repository"
import type {
  GrowthLeadInboxCreateInput,
  GrowthLeadInboxCreateResult,
} from "@/lib/growth/lead-inbox/lead-inbox-types"
import { GROWTH_LEAD_INBOX_QA_MARKER } from "@/lib/growth/lead-inbox/lead-inbox-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function intentCandidateToInboxInput(
  candidate: GrowthIntentLeadCandidate,
  options: {
    site_key: string
    session_count: number
    visit_count: number
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    company_name?: string
  },
): GrowthLeadInboxCreateInput {
  const identity = candidate.identity
  const hasExplicitIdentity = Boolean(identity.email || identity.phone || identity.full_name)

  return {
    site_key: options.site_key,
    candidate_type: candidate.candidate_type,
    candidate_priority: candidate.candidate_priority,
    intent_score: candidate.intent_score,
    intent_grade: candidate.intent_grade,
    candidate_confidence: candidate.candidate_confidence,
    pipeline_entry: candidate.recommended_pipeline_entry,
    company_name:
      options.company_name ||
      candidate.company_identification_summary?.company_name ||
      identity.company_name ||
      (candidate.candidate_type === "anonymous"
        ? candidate.domain
          ? `Visitor (${candidate.domain})`
          : "Anonymous visitor"
        : candidate.domain
          ? candidate.domain.split(".")[0]
          : "") ||
      "Unknown company",
    domain:
      candidate.company_identification_summary?.company_domain ?? candidate.domain,
    contact_name: hasExplicitIdentity ? identity.full_name : null,
    email: hasExplicitIdentity ? identity.email : null,
    phone: hasExplicitIdentity ? identity.phone : null,
    linkedin_url: hasExplicitIdentity ? null : null,
    dedupe_hash: candidate.dedupe_hash,
    candidate_reasoning: candidate.candidate_reasoning,
    candidate_evidence: candidate.candidate_evidence,
    candidate_attribution: candidate.candidate_attribution,
    session_count: options.session_count,
    visit_count: options.visit_count,
    utm_source: options.utm_source ?? candidate.candidate_attribution[0]?.signal ?? "",
    utm_medium: options.utm_medium ?? "",
    utm_campaign: options.utm_campaign ?? "",
    intent_session_id: candidate.session_id,
    visitor_key: candidate.visitor_key,
    human_review_required: true,
    metadata: {
      bridge_qa_marker: candidate.qa_marker,
      threshold_passed: candidate.threshold_passed,
      lead_engine_eligible: candidate.lead_engine_eligible,
      search_intent_summary: candidate.search_intent_summary,
      company_identification_summary: candidate.company_identification_summary,
      buying_stage_summary: candidate.buying_stage_summary,
    },
  }
}

export type GrowthLeadInboxIngestFromIntentOptions = {
  site_key: string
  session_count?: number
  visit_count?: number
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  company_name?: string
  force_duplicate_status?: boolean
}

/** Ingest a bridge-qualified intent candidate into the lead inbox queue. */
export async function ingestIntentCandidateToLeadInbox(
  admin: SupabaseClient,
  candidate: GrowthIntentLeadCandidate,
  options: GrowthLeadInboxIngestFromIntentOptions,
): Promise<GrowthLeadInboxCreateResult> {
  if (!candidate.lead_engine_eligible) {
    return {
      qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
      ok: false,
      row: null,
      duplicate: false,
      reason: "Candidate not lead_engine_eligible — inbox ingest skipped.",
      errors: candidate.threshold_reasons,
    }
  }

  if (candidate.candidate_attribution.length === 0) {
    return {
      qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
      ok: false,
      row: null,
      duplicate: false,
      reason: "Attribution required before inbox ingest.",
      errors: ["missing_attribution"],
    }
  }

  if (candidate.candidate_evidence.length === 0) {
    return {
      qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
      ok: false,
      row: null,
      duplicate: false,
      reason: "Evidence required before inbox ingest.",
      errors: ["missing_evidence"],
    }
  }

  let input = intentCandidateToInboxInput(candidate, {
    site_key: options.site_key,
    session_count: options.session_count ?? 1,
    visit_count: options.visit_count ?? candidate.candidate_evidence.length,
    utm_source: options.utm_source,
    utm_medium: options.utm_medium,
    utm_campaign: options.utm_campaign,
    company_name: options.company_name,
  })

  const pii = validateInboxPiiPolicy(input)
  input = pii.sanitized

  const crm = await resolveLeadInboxCrmMatches(admin, input)
  input.existing_account_match = crm.existing_account_match
  input.existing_lead_match = crm.existing_lead_match

  if (crm.existing_account_match.matched) {
    input.candidate_type = "existing_account"
  }

  const dedupe = await checkLeadInboxDuplicate(admin, {
    dedupe_hash: input.dedupe_hash,
    intent_session_id: input.intent_session_id,
    email: input.email,
    phone: input.phone,
    domain: input.domain,
  })

  if (options.force_duplicate_status && !dedupe.is_duplicate) {
    return {
      qa_marker: GROWTH_LEAD_INBOX_QA_MARKER,
      ok: false,
      row: null,
      duplicate: true,
      reason: "Forced duplicate status — inbox ingest skipped.",
      errors: [],
    }
  }

  const result = await createLeadCandidate(admin, input)
  let topCompanyIdentificationId: string | null = null
  if (result.ok && result.row && candidate.company_identification_matches.length > 0) {
    const idInput = {
      site_key: options.site_key,
      visitor_key: candidate.visitor_key,
      session_key: candidate.session_key,
      intent_session_id: candidate.session_id,
      lead_inbox_id: result.row!.id,
    }
    const persistedCompany = await persistCompanyIdentificationMatches(
      admin,
      candidate.company_identification_matches.map((m) => ({ ...m, lead_inbox_id: result.row!.id })),
      idInput,
    )
    if (persistedCompany.ok && persistedCompany.rows.length > 0) {
      topCompanyIdentificationId = persistedCompany.rows[0]?.id ?? null
      await linkCompanyMatchesToLeadInbox(
        admin,
        result.row.id,
        persistedCompany.rows.map((r) => r.id),
      )
    }
  }
  if (result.ok && result.row && candidate.search_intent_signals.length > 0) {
    const persisted = await persistSearchIntentSignals(
      admin,
      candidate.search_intent_signals.map((signal) => ({
        ...signal,
        lead_inbox_id: result.row!.id,
      })),
    )
    if (persisted.ok && persisted.rows.length > 0) {
      await linkSearchIntentSignalsToLeadInbox(
        admin,
        result.row.id,
        persisted.rows.map((r) => r.id),
      )
    }
  }
  if (result.ok && result.row && candidate.buying_stage_assessment) {
    await persistBuyingStageAssessment(admin, candidate.buying_stage_assessment, {
      lead_inbox_id: result.row.id,
      intent_session_id: candidate.session_id,
      company_identification_id: topCompanyIdentificationId,
    })
  }
  return result
}
