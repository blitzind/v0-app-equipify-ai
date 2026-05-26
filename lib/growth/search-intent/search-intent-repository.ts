import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthIntentAggregatedSession } from "@/lib/growth/lead-engine/intent/intent-session-aggregator"
import { attachAttributionToSignals } from "@/lib/growth/search-intent/search-intent-attribution"
import { classifySearchIntentSignal } from "@/lib/growth/search-intent/search-intent-classifier"
import {
  extractKeywordFromPageUrl,
  extractKeywordFromReferrerUrl,
  extractKeywordsFromContentPath,
  inferSourceNameFromReferrer,
  isEmptyKeyword,
  isOrganicSearchReferrer,
  isPaidSearchMedium,
  normalizeKeyword,
} from "@/lib/growth/search-intent/search-intent-keywords"
import {
  computeSearchIntentScoreContribution,
  scoreSearchIntentSignal,
} from "@/lib/growth/search-intent/search-intent-score"
import { isGrowthSearchIntentSchemaReady } from "@/lib/growth/search-intent/search-intent-schema-health"
import {
  GROWTH_SEARCH_INTENT_QA_MARKER,
  type GrowthSearchIntentCaptureInput,
  type GrowthSearchIntentCaptureResult,
  type GrowthSearchIntentClassifiedSignal,
  type GrowthSearchIntentSignalRow,
} from "@/lib/growth/search-intent/search-intent-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseAttribution(value: unknown): GrowthSearchIntentSignalRow["source_attribution"] {
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
    .filter((row): row is GrowthSearchIntentSignalRow["source_attribution"][number] => row !== null)
}

function mapRow(row: Record<string, unknown>): GrowthSearchIntentSignalRow {
  return {
    id: asString(row.id),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    site_key: asString(row.site_key),
    visitor_key: asString(row.visitor_key),
    session_key: asString(row.session_key),
    lead_inbox_id: asString(row.lead_inbox_id) || null,
    company_domain: asString(row.company_domain) || null,
    company_name: asString(row.company_name) || null,
    keyword: asString(row.keyword),
    normalized_keyword: asString(row.normalized_keyword),
    intent_topic: asString(row.intent_topic),
    intent_category: asString(row.intent_category) as GrowthSearchIntentSignalRow["intent_category"],
    intent_stage: asString(row.intent_stage) as GrowthSearchIntentSignalRow["intent_stage"],
    intent_strength: asString(row.intent_strength) as GrowthSearchIntentSignalRow["intent_strength"],
    intent_score: typeof row.intent_score === "number" ? row.intent_score : 0,
    source_type: asString(row.source_type) as GrowthSearchIntentSignalRow["source_type"],
    source_name: asString(row.source_name) || null,
    landing_page: asString(row.landing_page) || null,
    referrer: asString(row.referrer) || null,
    utm_source: asString(row.utm_source),
    utm_medium: asString(row.utm_medium),
    utm_campaign: asString(row.utm_campaign),
    utm_term: asString(row.utm_term),
    utm_content: asString(row.utm_content),
    matched_page_path: asString(row.matched_page_path) || null,
    matched_content_title: asString(row.matched_content_title) || null,
    matched_query_pattern: asString(row.matched_query_pattern) || null,
    evidence: asString(row.evidence),
    source_attribution: parseAttribution(row.source_attribution),
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
  }
}

function dedupeCaptureInputs(inputs: GrowthSearchIntentCaptureInput[]): GrowthSearchIntentCaptureInput[] {
  const seen = new Set<string>()
  const out: GrowthSearchIntentCaptureInput[] = []
  for (const input of inputs) {
    const key = [
      input.source_type,
      input.keyword ?? "",
      input.matched_page_path ?? "",
      input.utm_term ?? "",
    ].join("|")
    if (seen.has(key)) continue
    seen.add(key)
    out.push(input)
  }
  return out
}

/** Build capture inputs from observable session traffic — no private search APIs. */
export function buildSearchIntentCaptureInputsFromAggregate(
  aggregated: GrowthIntentAggregatedSession,
  options?: {
    lead_inbox_id?: string | null
    company_name?: string | null
    company_domain?: string | null
  },
): GrowthSearchIntentCaptureInput[] {
  const session = aggregated.primary_session
  const utm = session.last_touch_utm
  const inputs: GrowthSearchIntentCaptureInput[] = []
  const base = {
    site_key: aggregated.site_key,
    visitor_key: session.visitor_key,
    session_key: session.session_key,
    lead_inbox_id: options?.lead_inbox_id ?? null,
    company_domain: options?.company_domain ?? aggregated.domain,
    company_name: options?.company_name ?? null,
    landing_page: session.first_landing_url || session.last_page_url,
    referrer: session.last_referrer || session.first_referrer,
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    utm_term: utm.utm_term,
    utm_content: utm.utm_content,
    session_count: aggregated.visit_history.session_count,
    visit_count: aggregated.all_pageviews.length,
  }

  if (utm.utm_term && !isEmptyKeyword(utm.utm_term)) {
    inputs.push({
      ...base,
      keyword: normalizeKeyword(utm.utm_term),
      source_type: isPaidSearchMedium(utm.utm_medium) ? "paid_search" : "utm_keyword",
      source_name: utm.utm_source || "utm",
      matched_query_pattern: "utm:utm_term",
    })
  }

  const referrer = session.last_referrer || session.first_referrer
  if (referrer) {
    const extracted = extractKeywordFromReferrerUrl(referrer)
    if (extracted.keyword) {
      inputs.push({
        ...base,
        keyword: extracted.keyword,
        source_type: isPaidSearchMedium(utm.utm_medium) ? "paid_search" : "organic_search",
        source_name: extracted.source_name,
        matched_query_pattern: extracted.pattern,
      })
    } else if (isOrganicSearchReferrer(referrer)) {
      inputs.push({
        ...base,
        keyword: null,
        source_type: "referrer_keyword",
        source_name: inferSourceNameFromReferrer(referrer),
        matched_query_pattern: "referrer:host_only",
      })
    }
  }

  for (const pv of aggregated.all_pageviews) {
    const fromUrl = extractKeywordFromPageUrl(pv.page_url)
    if (fromUrl.keyword) {
      inputs.push({
        ...base,
        keyword: fromUrl.keyword,
        source_type: "site_search",
        source_name: "on_site_query_param",
        matched_page_path: pv.page_path || pv.page_url,
        matched_content_title: pv.page_title || null,
        matched_query_pattern: fromUrl.pattern,
      })
    }
  }

  const pathCounts = new Map<string, number>()
  for (const pv of aggregated.all_pageviews) {
    const path = (pv.page_path || pv.page_url).split("?")[0] ?? ""
    pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1)
  }

  for (const [path, count] of pathCounts) {
    if (!path || path === "/") continue
    const pathKeywords = extractKeywordsFromContentPath(path)
    for (const segment of pathKeywords) {
      inputs.push({
        ...base,
        keyword: segment,
        source_type: "content_path",
        source_name: "path_segment",
        matched_page_path: path,
        matched_query_pattern: `path:${segment}`,
        metadata: { pageview_hits: count },
      })
    }
  }

  return dedupeCaptureInputs(inputs)
}

export function captureSearchIntentFromAggregatedSession(
  aggregated: GrowthIntentAggregatedSession,
  options?: {
    lead_inbox_id?: string | null
    company_name?: string | null
    company_domain?: string | null
  },
): GrowthSearchIntentCaptureResult {
  const inputs = buildSearchIntentCaptureInputsFromAggregate(aggregated, options)
  const classified = inputs
    .map((input) => classifySearchIntentSignal(input))
    .filter((s): s is GrowthSearchIntentClassifiedSignal => s !== null)

  const withAttribution = attachAttributionToSignals(
    classified.map((s) => ({ ...s, intent_score: scoreSearchIntentSignal(s) })),
  )

  const contribution = computeSearchIntentScoreContribution(withAttribution, {
    session_count: aggregated.visit_history.session_count,
  })

  return {
    qa_marker: GROWTH_SEARCH_INTENT_QA_MARKER,
    signals: withAttribution,
    contribution,
  }
}

export async function persistSearchIntentSignals(
  admin: SupabaseClient,
  signals: GrowthSearchIntentClassifiedSignal[],
): Promise<{ ok: boolean; rows: GrowthSearchIntentSignalRow[]; reason: string | null }> {
  if (signals.length === 0) return { ok: true, rows: [], reason: null }
  if (!(await isGrowthSearchIntentSchemaReady(admin))) {
    return { ok: false, rows: [], reason: "schema_not_ready" }
  }

  const payload = signals.map((signal) => ({
    site_key: signal.site_key,
    visitor_key: signal.visitor_key,
    session_key: signal.session_key,
    lead_inbox_id: signal.lead_inbox_id,
    company_domain: signal.company_domain,
    company_name: signal.company_name,
    keyword: signal.keyword,
    normalized_keyword: signal.normalized_keyword,
    intent_topic: signal.intent_topic,
    intent_category: signal.intent_category,
    intent_stage: signal.intent_stage,
    intent_strength: signal.intent_strength,
    intent_score: signal.intent_score,
    source_type: signal.source_type,
    source_name: signal.source_name,
    landing_page: signal.landing_page,
    referrer: signal.referrer,
    utm_source: signal.utm_source ?? "",
    utm_medium: signal.utm_medium ?? "",
    utm_campaign: signal.utm_campaign ?? "",
    utm_term: signal.utm_term ?? "",
    utm_content: signal.utm_content ?? "",
    matched_page_path: signal.matched_page_path,
    matched_content_title: signal.matched_content_title,
    matched_query_pattern: signal.matched_query_pattern,
    evidence: signal.evidence,
    source_attribution: signal.source_attribution,
    metadata: signal.metadata ?? {},
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await admin
    .schema("growth")
    .from("search_intent_signals")
    .insert(payload)
    .select("*")

  if (error) {
    return { ok: false, rows: [], reason: error.message }
  }

  return {
    ok: true,
    rows: ((data ?? []) as Record<string, unknown>[]).map(mapRow),
    reason: null,
  }
}

export async function loadSearchIntentSignalsForLeadInbox(
  admin: SupabaseClient,
  leadInboxId: string,
  limit = 20,
): Promise<GrowthSearchIntentSignalRow[]> {
  if (!(await isGrowthSearchIntentSchemaReady(admin))) return []

  const { data, error } = await admin
    .schema("growth")
    .from("search_intent_signals")
    .select("*")
    .eq("lead_inbox_id", leadInboxId)
    .order("intent_score", { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(mapRow)
}

export async function loadSearchIntentSignalsForVisitor(
  admin: SupabaseClient,
  siteKey: string,
  visitorKey: string,
  limit = 20,
): Promise<GrowthSearchIntentSignalRow[]> {
  if (!(await isGrowthSearchIntentSchemaReady(admin))) return []

  const { data, error } = await admin
    .schema("growth")
    .from("search_intent_signals")
    .select("*")
    .eq("site_key", siteKey)
    .eq("visitor_key", visitorKey)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(mapRow)
}

export async function linkSearchIntentSignalsToLeadInbox(
  admin: SupabaseClient,
  leadInboxId: string,
  signalIds: string[],
): Promise<void> {
  if (signalIds.length === 0) return
  if (!(await isGrowthSearchIntentSchemaReady(admin))) return

  await admin
    .schema("growth")
    .from("search_intent_signals")
    .update({ lead_inbox_id: leadInboxId, updated_at: new Date().toISOString() })
    .in("id", signalIds)
}
