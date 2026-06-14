/** Signal intelligence certification route — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { REVENUE_PATH_HENRY_LEAD_ID } from "@/lib/growth/qa/revenue-path-validation-types"
import {
  assertSignalIntelligenceExecuteAllowed,
  buildSignalIntelligenceReadinessPayload,
} from "@/lib/growth/signal-intelligence/signal-intelligence-route-gates"
import { SIGNAL_EXTERNAL_BRIDGE_QA_MARKER } from "@/lib/growth/signal-intelligence/lead-signal-event-types"
import { routeNormalizedExternalSignal } from "@/lib/growth/signal-intelligence/external-signal-producers"
import { matchSignalToLead } from "@/lib/growth/signal-intelligence/signal-lead-matcher"

export async function buildSignalIntelligenceReadiness(_admin: SupabaseClient) {
  const gateCheck = assertSignalIntelligenceExecuteAllowed(process.env)
  return buildSignalIntelligenceReadinessPayload({
    gates_ok: gateCheck.ok,
    blockers: gateCheck.blockers,
  })
}

export async function executeSignalIntelligenceCertification(
  admin: SupabaseClient,
  input: { henry_lead_id?: string | null; dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertSignalIntelligenceExecuteAllowed(process.env)
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: SIGNAL_EXTERNAL_BRIDGE_QA_MARKER,
      blockers: gateCheck.blockers,
    }
  }

  if (input.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: SIGNAL_EXTERNAL_BRIDGE_QA_MARKER,
      dry_run: true,
      blockers: [],
    }
  }

  const henryLeadId = input.henry_lead_id ?? REVENUE_PATH_HENRY_LEAD_ID
  const runStartedAt = new Date().toISOString()
  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []

  const company = await routeNormalizedExternalSignal(admin, {
    source_system: "company_growth_signals",
    signal_type: "company_hiring",
    evidence_ref: { table: "company_growth_signals", id: randomUUID() },
    match: { lead_id: henryLeadId },
    occurred_at: runStartedAt,
    metadata: { certification: "gs1c_company_signal" },
  })
  const companyResult = company.results[0]
  checks.push({
    id: "company_signal_audit_timeline_recompute_attention",
    pass:
      company.matched_lead_count === 1 &&
      Boolean(companyResult?.audit_event_id) &&
      companyResult.timeline_emitted &&
      companyResult.recompute_succeeded &&
      companyResult.attention_evaluated,
    detail: {
      audit_event_id: companyResult?.audit_event_id ?? null,
      attention_evaluated: companyResult?.attention_evaluated ?? false,
    },
  })

  const search = await routeNormalizedExternalSignal(admin, {
    source_system: "search_intent_signals",
    signal_type: "high_intent_search",
    evidence_ref: { table: "search_intent_signals", id: randomUUID() },
    match: { lead_id: henryLeadId },
    occurred_at: runStartedAt,
    metadata: { certification: "gs1c_search_intent" },
  })
  const searchResult = search.results[0]
  checks.push({
    id: "search_intent_lead_matched_router_recompute",
    pass:
      search.matched_lead_count === 1 &&
      Boolean(searchResult?.audit_event_id) &&
      searchResult.recompute_succeeded,
    detail: { audit_event_id: searchResult?.audit_event_id ?? null },
  })

  const website = await routeNormalizedExternalSignal(admin, {
    source_system: "intent_pageview_events",
    signal_type: "repeat_visit",
    evidence_ref: { table: "intent_pageview_events", id: randomUUID() },
    match: { lead_id: henryLeadId },
    occurred_at: runStartedAt,
    metadata: { certification: "gs1c_repeat_visit", visit_count: 3 },
  })
  checks.push({
    id: "website_intent_repeat_visit_queue_hint",
    pass:
      Boolean(website.results[0]?.audit_event_id) &&
      (website.results[0]?.queue_hint !== null || website.queue_hints.length > 0),
    detail: {
      queue_hints: website.queue_hints,
      queue_hint: website.results[0]?.queue_hint ?? null,
      audit_event_id: website.results[0]?.audit_event_id ?? null,
    },
  })

  const multi = await routeNormalizedExternalSignal(admin, {
    source_system: "company_growth_signals",
    signal_type: "expansion_event",
    evidence_ref: { table: "company_growth_signals", id: randomUUID() },
    match: { lead_id: henryLeadId },
    occurred_at: runStartedAt,
    metadata: { certification: "gs1c_multi_lead" },
  })
  checks.push({
    id: "multi_lead_company_match_one_event_per_lead",
    pass: multi.results.length === multi.matched_lead_count && multi.matched_lead_count >= 1,
    detail: { matched_lead_count: multi.matched_lead_count, routed_count: multi.routed_count },
  })

  const unmatched = await routeNormalizedExternalSignal(admin, {
    source_system: "search_intent_signals",
    signal_type: "competitor_search",
    evidence_ref: { table: "search_intent_signals", id: randomUUID() },
    match: { domain: `no-match-${randomUUID()}.invalid` },
    occurred_at: runStartedAt,
  })
  checks.push({
    id: "no_matching_lead_audited_no_throw",
    pass:
      unmatched.matched_lead_count === 0 &&
      unmatched.unmatched_audit_event_id !== null &&
      unmatched.routed_count === 0,
    detail: { unmatched_audit_event_id: unmatched.unmatched_audit_event_id },
  })

  const duplicateEvidenceId = randomUUID()
  const firstDup = await routeNormalizedExternalSignal(admin, {
    source_system: "search_intent_signals",
    signal_type: "category_interest",
    evidence_ref: { table: "search_intent_signals", id: duplicateEvidenceId },
    match: { lead_id: henryLeadId },
    occurred_at: runStartedAt,
  })
  const secondDup = await routeNormalizedExternalSignal(admin, {
    source_system: "search_intent_signals",
    signal_type: "category_interest",
    evidence_ref: { table: "search_intent_signals", id: duplicateEvidenceId },
    match: { lead_id: henryLeadId },
    occurred_at: runStartedAt,
  })
  checks.push({
    id: "duplicate_signal_ignored",
    pass: secondDup.results.some((result) => result.duplicate),
    detail: {
      first_routed: firstDup.routed_count,
      second_duplicate: secondDup.results[0]?.duplicate ?? false,
    },
  })

  const matcher = await matchSignalToLead(admin, { lead_id: henryLeadId })
  checks.push({
    id: "lead_matcher_lead_id_resolution",
    pass: matcher.matches.length === 1 && matcher.matches[0]?.lead_id === henryLeadId,
    detail: { matches: matcher.matches },
  })

  const passCount = checks.filter((check) => check.pass).length
  const certification_pct = checks.length === 0 ? 0 : Math.round((passCount / checks.length) * 1000) / 10

  return {
    ok: passCount === checks.length,
    execution_id,
    qa_marker: SIGNAL_EXTERNAL_BRIDGE_QA_MARKER,
    henry_lead_id: henryLeadId,
    certification_pct,
    certification_checks: checks,
    final_verdict: passCount === checks.length ? "PASS" : "FAIL",
    blockers: checks.filter((check) => !check.pass).map((check) => check.id),
  }
}
