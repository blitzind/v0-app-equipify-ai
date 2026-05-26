import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchIntentPixelSite,
  fetchVisitHistory,
} from "@/lib/growth/intent-pixel/intent-pixel-repository"
import { isGrowthIntentPixelSchemaReady } from "@/lib/growth/intent-pixel/intent-pixel-schema-health"
import type {
  GrowthIntentPixelIdentifiedContact,
  GrowthIntentPixelVisitorSession,
} from "@/lib/growth/intent-pixel/intent-pixel-types"
import {
  computeIntentCandidateScore,
  normalizeCandidateConfidence,
} from "@/lib/growth/lead-engine/intent/intent-candidate-scoring"
import { identifyCompanyFromAggregatedSession } from "@/lib/growth/company-identification/company-identification-repository"
import { captureSearchIntentFromAggregatedSession } from "@/lib/growth/search-intent/search-intent-repository"
import {
  aggregateIntentSession,
  extractIdentityFromContacts,
  singleSessionVisitHistory,
  type GrowthIntentAggregatedSession,
} from "@/lib/growth/lead-engine/intent/intent-session-aggregator"
import {
  buildDedupeSourcesFromAggregate,
  checkIntentCandidateDedupe,
} from "@/lib/growth/lead-engine/intent/intent-lead-dedupe"
import { evaluateIntentThreshold } from "@/lib/growth/lead-engine/intent/intent-threshold-engine"
import {
  GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER,
  type GrowthIntentLeadBridgeBatchResult,
  type GrowthIntentLeadBridgeResult,
  type GrowthIntentLeadCandidate,
  type GrowthIntentLeadCandidateAttribution,
  type GrowthIntentLeadCandidateEvidence,
  type GrowthIntentLeadCandidateType,
  type GrowthIntentLeadPipelineEntryStage,
} from "@/lib/growth/lead-engine/intent/intent-candidate-types"
import type { GrowthLeadEnginePipelineStageId } from "@/lib/growth/lead-engine/workspace-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type GrowthIntentBridgeInput = {
  site_key: string
  session: GrowthIntentPixelVisitorSession
  visit_history?: GrowthIntentAggregatedSession["visit_history"]
  identified_contacts?: GrowthIntentPixelIdentifiedContact[]
  consent_required?: boolean
  known_dedupe_hashes?: Set<string>
  crm_dedupe_index?: {
    emails?: Set<string>
    phones?: Set<string>
    domains?: Set<string>
    session_ids?: Set<string>
  }
  existing_lead_ids?: string[]
  existing_customer_ids?: string[]
}

function resolveCandidateType(
  aggregated: GrowthIntentAggregatedSession,
  identity: ReturnType<typeof extractIdentityFromContacts>,
  existingCustomerIds: string[],
  intentScore: number,
): GrowthIntentLeadCandidateType {
  if (existingCustomerIds.length > 0) return "existing_account"
  if (identity.email || identity.phone || identity.full_name) return "identified"
  if (aggregated.visit_history.session_count > 1) return "returning"
  if (intentScore >= 15 || aggregated.high_intent_path_hits.length >= 2) return "high_intent"
  return "anonymous"
}

function resolvePipelineEntry(
  candidateType: GrowthIntentLeadCandidateType,
  identity: ReturnType<typeof extractIdentityFromContacts>,
): GrowthIntentLeadPipelineEntryStage {
  if (candidateType === "existing_account") return "company_discovery"
  if (identity.email || identity.phone) return "contact_research"
  if (candidateType === "high_intent" || candidateType === "returning") return "company_discovery"
  return "icp_targeting"
}

function buildCandidateEvidence(aggregated: GrowthIntentAggregatedSession): GrowthIntentLeadCandidateEvidence[] {
  const items: GrowthIntentLeadCandidateEvidence[] = []

  for (const pv of aggregated.all_pageviews.slice(0, 5)) {
    items.push({
      claim: `Pageview: ${pv.page_path || pv.page_url}`,
      evidence: pv.page_url,
      source: "growth.intent_pageview_events",
    })
  }

  for (const cv of aggregated.all_conversions) {
    items.push({
      claim: `Conversion: ${cv.conversion_type}`,
      evidence: cv.conversion_label || cv.page_url,
      source: "growth.intent_conversion_events",
    })
  }

  if (aggregated.high_intent_path_hits.length > 0) {
    items.push({
      claim: "High-intent paths visited",
      evidence: aggregated.high_intent_path_hits.join(", "),
      source: "intent_path_rules",
    })
  }

  return items
}

function buildCandidateAttribution(
  aggregated: GrowthIntentAggregatedSession,
  scoringBreakdown: Record<string, number>,
): GrowthIntentLeadCandidateAttribution[] {
  const entries: GrowthIntentLeadCandidateAttribution[] = [
    {
      source: "growth.intent_visitor_sessions",
      section: "session",
      signal: "visitor_activity",
      evidence: `Session ${aggregated.primary_session.session_key} — ${aggregated.visit_history.session_count} session(s), ${aggregated.unique_page_count} unique pages.`,
      confidence: 0.7,
    },
  ]

  const utm = aggregated.primary_session.last_touch_utm
  if (utm.utm_source || utm.utm_medium) {
    entries.push({
      source: "growth.intent_visitor_sessions",
      section: "utm",
      signal: "last_touch",
      evidence: `utm_source=${utm.utm_source} utm_medium=${utm.utm_medium} utm_campaign=${utm.utm_campaign}`,
      confidence: 0.65,
    })
  }

  for (const [key, points] of Object.entries(scoringBreakdown)) {
    if (points <= 0) continue
    entries.push({
      source: "growth-intent-lead-bridge-v1",
      section: "scoring",
      signal: key,
      evidence: `Scoring factor ${key}: +${points}.`,
      confidence: Math.min(0.9, 0.4 + points / 20),
    })
  }

  return entries
}

/** Core bridge: Intent Session → Intent Candidate → Threshold → Dedupe → Pipeline entry. */
export async function bridgeIntentSessionToLeadCandidate(
  input: GrowthIntentBridgeInput,
): Promise<GrowthIntentLeadBridgeResult> {
  const warnings: string[] = []
  const errors: string[] = []

  try {
    const visitHistory =
      input.visit_history ??
      singleSessionVisitHistory(input.session)

    const aggregated = aggregateIntentSession({
      site_key: input.site_key,
      session: input.session,
      visit_history: visitHistory,
      identified_contacts: input.identified_contacts ?? [],
    })

    const identity = extractIdentityFromContacts(aggregated.identified_contacts)
    if (!identity.email && !identity.phone && aggregated.primary_session.is_identified) {
      warnings.push("Session marked identified but no explicit contact record — identity not inferred.")
    }

    const companyIdentification = await identifyCompanyFromAggregatedSession(aggregated, identity)
    const searchCapture = captureSearchIntentFromAggregatedSession(aggregated, {
      company_name: companyIdentification.top_match?.company_name ?? identity.company_name,
      company_domain: companyIdentification.top_match?.company_domain ?? aggregated.domain,
    })
    const score = computeIntentCandidateScore(aggregated, {
      searchIntent: searchCapture.contribution,
      companyIdentification: companyIdentification.contribution,
    })
    const dedupeSources = buildDedupeSourcesFromAggregate(
      aggregated,
      identity,
      input.existing_lead_ids ?? [],
      input.existing_customer_ids ?? [],
    )
    const dedupe = checkIntentCandidateDedupe(
      dedupeSources,
      input.known_dedupe_hashes ?? new Set(),
      input.crm_dedupe_index ?? {},
    )

    const threshold = evaluateIntentThreshold({
      aggregated,
      intent_score: score.intent_score,
      identity,
      consent_required: input.consent_required ?? true,
      dedupe_matched: dedupe.dedupe_matched,
    })

    const candidateType = resolveCandidateType(
      aggregated,
      identity,
      input.existing_customer_ids ?? [],
      score.intent_score,
    )
    const pipelineEntry = resolvePipelineEntry(candidateType, identity)
    const evidence = buildCandidateEvidence(aggregated)
    for (const match of companyIdentification.matches.slice(0, 3)) {
      evidence.push({
        claim: `Company candidate: ${match.company_name}`,
        evidence: match.evidence,
        source: "growth.company_identification_matches",
      })
    }
    for (const signal of searchCapture.signals.slice(0, 4)) {
      evidence.push({
        claim: `Search intent: ${signal.intent_topic}`,
        evidence: signal.evidence,
        source: "growth.search_intent_signals",
      })
    }
    const attribution = buildCandidateAttribution(aggregated, score.scoring_breakdown)
    for (const match of companyIdentification.matches.slice(0, 2)) {
      for (const attr of match.source_attribution) {
        attribution.push(attr)
      }
    }
    for (const signal of searchCapture.signals.slice(0, 3)) {
      for (const attr of signal.source_attribution) {
        attribution.push(attr)
      }
    }

    if (evidence.length === 0) {
      warnings.push("No pageview or conversion evidence — low confidence.")
    }
    if (attribution.length < 2) {
      warnings.push("Low attribution count — review before Lead Engine handoff.")
    }

    const candidate: GrowthIntentLeadCandidate = {
      qa_marker: GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER,
      candidate_id: randomUUID(),
      site_key: input.site_key,
      visitor_key: aggregated.primary_session.visitor_key,
      session_id: aggregated.primary_session.id,
      session_key: aggregated.primary_session.session_key,
      consent_status: aggregated.primary_session.consent_status,
      candidate_type: candidateType,
      candidate_reasoning: [...score.reasoning, ...threshold.reasons, ...threshold.blockers],
      intent_score: score.intent_score,
      intent_grade: score.intent_grade,
      candidate_confidence: normalizeCandidateConfidence(
        score.intent_score,
        evidence.length > 0,
        companyIdentification.contribution.confidence_boost,
      ),
      candidate_priority: score.candidate_priority,
      lead_engine_eligible: threshold.lead_engine_eligible,
      recommended_pipeline_entry: pipelineEntry,
      dedupe_hash: dedupe.dedupe_hash,
      dedupe_matched: dedupe.dedupe_matched,
      dedupe_reason: dedupe.dedupe_reason,
      domain: aggregated.domain,
      identity,
      candidate_evidence: evidence,
      candidate_attribution: attribution,
      scoring_breakdown: {
        ...score.scoring_breakdown,
        ...(searchCapture.contribution.signal_count > 0
          ? { search_intent_signals: searchCapture.contribution.signal_count }
          : {}),
      },
      threshold_passed: threshold.threshold_passed,
      threshold_reasons: [...threshold.reasons, ...threshold.blockers],
      warnings,
      search_intent_summary:
        searchCapture.contribution.signal_count > 0
          ? {
              top_keyword: searchCapture.contribution.top_keyword,
              top_category: searchCapture.contribution.top_category,
              signal_count: searchCapture.contribution.signal_count,
              max_confidence: searchCapture.contribution.max_confidence,
            }
          : null,
      search_intent_signals: searchCapture.signals,
      company_identification_summary: companyIdentification.summary
        ? { ...companyIdentification.summary, is_candidate_match: true }
        : null,
      company_identification_matches: companyIdentification.matches,
    }

    const pipeline_entry: GrowthLeadEnginePipelineStageId | null = threshold.lead_engine_eligible
      ? pipelineEntry
      : null

    return {
      qa_marker: GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER,
      ok: true,
      site_key: input.site_key,
      session_id: aggregated.primary_session.id,
      lead_candidate: candidate,
      pipeline_entry,
      errors,
      warnings,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      qa_marker: GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER,
      ok: false,
      site_key: input.site_key,
      session_id: input.session.id,
      lead_candidate: null,
      pipeline_entry: null,
      errors: [message],
      warnings,
    }
  }
}

export async function bridgeIntentSessionFromStore(
  admin: SupabaseClient,
  siteKey: string,
  sessionId: string,
  options: Omit<GrowthIntentBridgeInput, "site_key" | "session" | "visit_history"> = {},
): Promise<GrowthIntentLeadBridgeResult> {
  if (!(await isGrowthIntentPixelSchemaReady(admin))) {
    return {
      qa_marker: GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER,
      ok: false,
      site_key: siteKey,
      session_id: sessionId,
      lead_candidate: null,
      pipeline_entry: null,
      errors: ["Intent Pixel schema not ready."],
      warnings: [],
    }
  }

  const site = await fetchIntentPixelSite(admin, siteKey)
  if (!site) {
    return {
      qa_marker: GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER,
      ok: false,
      site_key: siteKey,
      session_id: sessionId,
      lead_candidate: null,
      pipeline_entry: null,
      errors: ["Unknown intent pixel site."],
      warnings: [],
    }
  }

  let session: GrowthIntentPixelVisitorSession | null = null
  let contacts: GrowthIntentPixelIdentifiedContact[] = []

  try {
    const { data, error } = await admin
      .schema("growth")
      .from("intent_visitor_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("site_id", site.id)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) {
      return {
        qa_marker: GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER,
        ok: false,
        site_key: siteKey,
        session_id: sessionId,
        lead_candidate: null,
        pipeline_entry: null,
        errors: ["Session not found."],
        warnings: [],
      }
    }

    const row = data as Record<string, unknown>
    session = {
      id: asString(row.id),
      site_id: asString(row.site_id),
      visitor_key: asString(row.visitor_key),
      session_key: asString(row.session_key),
      is_identified: row.is_identified === true,
      consent_status: asString(row.consent_status) as GrowthIntentPixelVisitorSession["consent_status"],
      first_touch_utm: row.first_touch_utm as GrowthIntentPixelVisitorSession["first_touch_utm"],
      last_touch_utm: row.last_touch_utm as GrowthIntentPixelVisitorSession["last_touch_utm"],
      first_referrer: asString(row.first_referrer) || null,
      last_referrer: asString(row.last_referrer) || null,
      first_landing_url: asString(row.first_landing_url) || null,
      last_page_url: asString(row.last_page_url) || null,
      device_metadata: row.device_metadata as GrowthIntentPixelVisitorSession["device_metadata"],
      browser_metadata: row.browser_metadata as GrowthIntentPixelVisitorSession["browser_metadata"],
      pageview_count: typeof row.pageview_count === "number" ? row.pageview_count : 0,
      total_time_on_site_ms:
        typeof row.total_time_on_site_ms === "number" ? Number(row.total_time_on_site_ms) : 0,
      started_at: asString(row.started_at),
      last_activity_at: asString(row.last_activity_at),
      ended_at: asString(row.ended_at) || null,
    }
  } catch (e) {
    return {
      qa_marker: GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER,
      ok: false,
      site_key: siteKey,
      session_id: sessionId,
      lead_candidate: null,
      pipeline_entry: null,
      errors: [e instanceof Error ? e.message : String(e)],
      warnings: [],
    }
  }

  let visitHistory = singleSessionVisitHistory(session!)
  try {
    visitHistory = await fetchVisitHistory(admin, site.id, session!.visitor_key)
  } catch {
    // fault isolated — fall back to single session
  }

  try {
    const { data } = await admin
      .schema("growth")
      .from("intent_identified_contacts")
      .select("*")
      .eq("session_id", sessionId)
    contacts = (data ?? []).map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: asString(r.id),
        session_id: asString(r.session_id),
        capture_source: asString(r.capture_source) as GrowthIntentPixelIdentifiedContact["capture_source"],
        email: asString(r.email) || null,
        phone: asString(r.phone) || null,
        full_name: asString(r.full_name) || null,
        linkedin_url: asString(r.linkedin_url) || null,
        company_name: asString(r.company_name) || null,
        captured_at: asString(r.captured_at),
      }
    })
  } catch {
    // fault isolated
  }

  let crmIndex = options.crm_dedupe_index
  if (!crmIndex) {
    crmIndex = await fetchCrmDedupeIndexSafe(admin, session!, contacts)
  }

  return await bridgeIntentSessionToLeadCandidate({
    site_key: siteKey,
    session: session!,
    visit_history: visitHistory,
    identified_contacts: contacts,
    consent_required: site.consent_required,
    ...options,
    crm_dedupe_index: crmIndex,
  })
}

async function fetchCrmDedupeIndexSafe(
  admin: SupabaseClient,
  session: GrowthIntentPixelVisitorSession,
  contacts: GrowthIntentPixelIdentifiedContact[],
): Promise<{
  emails: Set<string>
  phones: Set<string>
  domains: Set<string>
  session_ids: Set<string>
}> {
  const emails = new Set<string>()
  const phones = new Set<string>()
  const domains = new Set<string>()
  const session_ids = new Set<string>([session.id])

  for (const c of contacts) {
    if (c.email) emails.add(c.email.trim().toLowerCase())
    if (c.phone) phones.add(c.phone.replace(/\D/g, ""))
  }

  try {
    if (emails.size > 0) {
      const { data } = await admin
        .schema("growth")
        .from("leads")
        .select("id, contact_email")
        .in("contact_email", [...emails])
        .limit(20)
      for (const row of data ?? []) {
        const email = asString((row as Record<string, unknown>).contact_email).toLowerCase()
        if (email) emails.add(email)
      }
    }
  } catch {
    // fault isolated
  }

  return { emails, phones, domains, session_ids }
}

export async function bridgeRecentIntentSessions(
  admin: SupabaseClient,
  siteKey: string,
  limit = 25,
): Promise<GrowthIntentLeadBridgeBatchResult> {
  const errors: string[] = []
  const candidates: GrowthIntentLeadCandidate[] = []
  const knownHashes = new Set<string>()

  if (!(await isGrowthIntentPixelSchemaReady(admin))) {
    return {
      qa_marker: GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER,
      site_key: siteKey,
      candidates: [],
      eligible_count: 0,
      duplicate_count: 0,
      rejected_count: 0,
      errors: ["Intent Pixel schema not ready."],
    }
  }

  const site = await fetchIntentPixelSite(admin, siteKey)
  if (!site) {
    return {
      qa_marker: GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER,
      site_key: siteKey,
      candidates: [],
      eligible_count: 0,
      duplicate_count: 0,
      rejected_count: 0,
      errors: ["Unknown site."],
    }
  }

  let sessionRows: Record<string, unknown>[] = []
  try {
    const { data, error } = await admin
      .schema("growth")
      .from("intent_visitor_sessions")
      .select("id")
      .eq("site_id", site.id)
      .order("last_activity_at", { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    sessionRows = (data ?? []) as Record<string, unknown>[]
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e))
  }

  for (const row of sessionRows) {
    const sessionId = asString(row.id)
    if (!sessionId) continue
    try {
      const result = await bridgeIntentSessionFromStore(admin, siteKey, sessionId, {
        known_dedupe_hashes: knownHashes,
      })
      if (result.errors.length > 0) errors.push(...result.errors)
      if (result.lead_candidate) {
        candidates.push(result.lead_candidate)
        knownHashes.add(result.lead_candidate.dedupe_hash)
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  return {
    qa_marker: GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER,
    site_key: siteKey,
    candidates,
    eligible_count: candidates.filter((c) => c.lead_engine_eligible).length,
    duplicate_count: candidates.filter((c) => c.dedupe_matched).length,
    rejected_count: candidates.filter((c) => !c.threshold_passed).length,
    errors,
  }
}
