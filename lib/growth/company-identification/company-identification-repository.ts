import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthIntentAggregatedSession } from "@/lib/growth/lead-engine/intent/intent-session-aggregator"
import type { GrowthIntentLeadCandidateIdentity } from "@/lib/growth/lead-engine/intent/intent-candidate-types"
import {
  buildObservableCompanyMatches,
  rankCompanyIdentificationMatches,
  resolveCrmCompanyMatches,
} from "@/lib/growth/company-identification/company-identification-match"
import { computeCompanyIdentificationScoreContribution } from "@/lib/growth/company-identification/company-identification-score"
import { isGrowthCompanyIdentificationSchemaReady } from "@/lib/growth/company-identification/company-identification-schema-health"
import {
  GROWTH_COMPANY_IDENTIFICATION_QA_MARKER,
  type GrowthCompanyIdentificationInput,
  type GrowthCompanyIdentificationMatchCandidate,
  type GrowthCompanyIdentificationMatchRow,
  type GrowthCompanyIdentificationResult,
} from "@/lib/growth/company-identification/company-identification-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseAttribution(value: unknown): GrowthCompanyIdentificationMatchRow["source_attribution"] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
      const source = asString(row.source)
      const section = asString(row.section)
      const signal = asString(row.signal)
      const evidence = asString(row.evidence)
      const confidence = typeof row.confidence === "number" ? row.confidence : 0
      if (!source || !evidence) return null
      return { source, section, signal, evidence, confidence }
    })
    .filter((row): row is GrowthCompanyIdentificationMatchRow["source_attribution"][number] => row !== null)
}

function mapRow(row: Record<string, unknown>): GrowthCompanyIdentificationMatchRow {
  return {
    id: asString(row.id),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    site_key: asString(row.site_key),
    visitor_key: asString(row.visitor_key),
    session_key: asString(row.session_key),
    lead_inbox_id: asString(row.lead_inbox_id) || null,
    intent_session_id: asString(row.intent_session_id) || null,
    company_name: asString(row.company_name),
    company_domain: asString(row.company_domain) || null,
    matched_customer_id: asString(row.matched_customer_id) || null,
    matched_prospect_id: asString(row.matched_prospect_id) || null,
    matched_growth_lead_id: asString(row.matched_growth_lead_id) || null,
    matched_source: asString(row.matched_source) as GrowthCompanyIdentificationMatchRow["matched_source"],
    match_type: asString(row.match_type) as GrowthCompanyIdentificationMatchRow["match_type"],
    match_confidence: typeof row.match_confidence === "number" ? row.match_confidence : 0,
    match_score: typeof row.match_score === "number" ? row.match_score : 0,
    match_reasoning: Array.isArray(row.match_reasoning)
      ? row.match_reasoning.filter((v): v is string => typeof v === "string")
      : [],
    evidence: asString(row.evidence),
    source_attribution: parseAttribution(row.source_attribution),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  }
}

export function buildCompanyIdentificationInputFromAggregate(
  aggregated: GrowthIntentAggregatedSession,
  identity: GrowthIntentLeadCandidateIdentity,
  options?: {
    lead_inbox_id?: string | null
    intent_session_id?: string | null
  },
): GrowthCompanyIdentificationInput {
  const session = aggregated.primary_session
  const utm = session.last_touch_utm

  return {
    site_key: aggregated.site_key,
    visitor_key: session.visitor_key,
    session_key: session.session_key,
    intent_session_id: options?.intent_session_id ?? session.id,
    lead_inbox_id: options?.lead_inbox_id ?? null,
    email: identity.email,
    phone: identity.phone,
    company_name: identity.company_name,
    company_domain: aggregated.domain,
    landing_page: session.first_landing_url || session.last_page_url,
    referrer: session.last_referrer || session.first_referrer,
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    submitted_company_name: identity.company_name,
  }
}

export async function identifyCompanyCandidates(
  input: GrowthCompanyIdentificationInput,
  admin?: SupabaseClient | null,
): Promise<GrowthCompanyIdentificationResult> {
  const observable = buildObservableCompanyMatches(input)
  const crm = await resolveCrmCompanyMatches(admin, input)
  const matches = rankCompanyIdentificationMatches([...observable, ...crm])
  const top_match = matches[0] ?? null

  return {
    qa_marker: GROWTH_COMPANY_IDENTIFICATION_QA_MARKER,
    matches,
    top_match,
    is_candidate_match: top_match != null,
    summary: top_match
      ? {
          company_name: top_match.company_name,
          company_domain: top_match.company_domain,
          match_type: top_match.match_type,
          matched_source: top_match.matched_source,
          match_confidence: top_match.match_confidence,
          match_score: top_match.match_score,
        }
      : null,
  }
}

export async function identifyCompanyFromAggregatedSession(
  aggregated: GrowthIntentAggregatedSession,
  identity: GrowthIntentLeadCandidateIdentity,
  options?: {
    admin?: SupabaseClient | null
    lead_inbox_id?: string | null
  },
): Promise<GrowthCompanyIdentificationResult & { contribution: ReturnType<typeof computeCompanyIdentificationScoreContribution> }> {
  const input = buildCompanyIdentificationInputFromAggregate(aggregated, identity, {
    lead_inbox_id: options?.lead_inbox_id,
    intent_session_id: aggregated.primary_session.id,
  })
  const result = await identifyCompanyCandidates(input, options?.admin)
  const contribution = computeCompanyIdentificationScoreContribution(result.matches, result.top_match)
  return { ...result, contribution }
}

export async function persistCompanyIdentificationMatches(
  admin: SupabaseClient,
  matches: GrowthCompanyIdentificationMatchCandidate[],
  context: Pick<
    GrowthCompanyIdentificationInput,
    "site_key" | "visitor_key" | "session_key" | "lead_inbox_id" | "intent_session_id"
  >,
): Promise<{ ok: boolean; rows: GrowthCompanyIdentificationMatchRow[]; reason: string | null }> {
  if (matches.length === 0) return { ok: true, rows: [], reason: null }
  if (!(await isGrowthCompanyIdentificationSchemaReady(admin))) {
    return { ok: false, rows: [], reason: "schema_not_ready" }
  }

  const payload = matches.map((match) => ({
    site_key: context.site_key,
    visitor_key: context.visitor_key,
    session_key: context.session_key,
    lead_inbox_id: context.lead_inbox_id,
    intent_session_id: context.intent_session_id,
    company_name: match.company_name,
    company_domain: match.company_domain,
    matched_customer_id: match.matched_customer_id,
    matched_prospect_id: match.matched_prospect_id,
    matched_growth_lead_id: match.matched_growth_lead_id,
    matched_source: match.matched_source,
    match_type: match.match_type,
    match_confidence: match.match_confidence,
    match_score: match.match_score,
    match_reasoning: match.match_reasoning,
    evidence: match.evidence,
    source_attribution: match.source_attribution,
    metadata: {
      ...match.metadata,
      is_candidate_match: true,
      disclaimer: "Candidate company match — not guaranteed identity. No IP-to-company claim.",
    },
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await admin
    .schema("growth")
    .from("company_identification_matches")
    .insert(payload)
    .select("*")

  if (error) return { ok: false, rows: [], reason: error.message }

  return {
    ok: true,
    rows: ((data ?? []) as Record<string, unknown>[]).map(mapRow),
    reason: null,
  }
}

export async function loadCompanyIdentificationMatchesForLeadInbox(
  admin: SupabaseClient,
  leadInboxId: string,
  limit = 10,
): Promise<GrowthCompanyIdentificationMatchRow[]> {
  if (!(await isGrowthCompanyIdentificationSchemaReady(admin))) return []

  const { data, error } = await admin
    .schema("growth")
    .from("company_identification_matches")
    .select("*")
    .eq("lead_inbox_id", leadInboxId)
    .order("match_score", { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(mapRow)
}

export async function linkCompanyMatchesToLeadInbox(
  admin: SupabaseClient,
  leadInboxId: string,
  matchIds: string[],
): Promise<void> {
  if (matchIds.length === 0) return
  if (!(await isGrowthCompanyIdentificationSchemaReady(admin))) return

  await admin
    .schema("growth")
    .from("company_identification_matches")
    .update({ lead_inbox_id: leadInboxId, updated_at: new Date().toISOString() })
    .in("id", matchIds)
}
