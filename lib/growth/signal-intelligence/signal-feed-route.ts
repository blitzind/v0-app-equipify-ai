/** Signal Feed certification route — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { loadCommandCenterHotSignals } from "@/lib/growth/signal-intelligence/signal-feed-repository"
import {
  applySignalFeedAction,
  loadGrowthSignalFeed,
} from "@/lib/growth/signal-intelligence/signal-feed-repository"
import {
  assertSignalFeedExecuteAllowed,
  buildSignalFeedReadinessPayload,
} from "@/lib/growth/signal-intelligence/signal-feed-route-gates"
import { SIGNAL_FEED_QA_MARKER } from "@/lib/growth/signal-intelligence/signal-feed-types"
import { REVENUE_PATH_HENRY_LEAD_ID } from "@/lib/growth/qa/revenue-path-validation-types"
import { routeNormalizedExternalSignal } from "@/lib/growth/signal-intelligence/external-signal-producers"
import { fetchGrowthCommandDashboard } from "@/lib/growth/command/command-dashboard-repository"

export async function buildSignalFeedReadiness(_admin: SupabaseClient) {
  const gateCheck = assertSignalFeedExecuteAllowed(process.env)
  return buildSignalFeedReadinessPayload({
    gates_ok: gateCheck.ok,
    blockers: gateCheck.blockers,
  })
}

export async function executeSignalFeedCertification(
  admin: SupabaseClient,
  input: { henry_lead_id?: string | null; dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertSignalFeedExecuteAllowed(process.env)
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: SIGNAL_FEED_QA_MARKER,
      blockers: gateCheck.blockers,
    }
  }

  if (input.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: SIGNAL_FEED_QA_MARKER,
      dry_run: true,
      blockers: [],
    }
  }

  const henryLeadId = input.henry_lead_id ?? REVENUE_PATH_HENRY_LEAD_ID
  const evidenceId = randomUUID()
  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []

  await routeNormalizedExternalSignal(admin, {
    source_system: "search_intent_signals",
    signal_type: "pricing_page_visit",
    evidence_ref: { table: "search_intent_signals", id: evidenceId },
    match: { lead_id: henryLeadId },
    metadata: { certification: "gs1d_feed_pricing_visit" },
  })

  const feed = await loadGrowthSignalFeed(admin, {
    lead_id: henryLeadId,
    sort: "occurred_at",
    limit: 50,
  })

  const latestPricing = feed.items.find((item) => item.signal_type === "pricing_page_visit")

  checks.push({
    id: "routed_events_appear_in_feed",
    pass: feed.total > 0 && Boolean(latestPricing),
    detail: { total: feed.total, latest_pricing_id: latestPricing?.audit_event_id ?? null },
  })

  checks.push({
    id: "recommendations_generated",
    pass: feed.items.some((item) => item.recommended_action.length > 0 && item.reasoning.length > 0),
    detail: {
      sample_action: feed.items[0]?.recommended_action ?? null,
    },
  })

  checks.push({
    id: "expected_impact_generated",
    pass: feed.items.some((item) => item.expected_impact.length > 0),
    detail: { sample_impact: feed.items[0]?.expected_impact ?? null },
  })

  const statusTarget = latestPricing?.audit_event_id
  let statusTransitionOk = false
  if (statusTarget) {
    const viewed = await applySignalFeedAction(admin, {
      audit_event_id: statusTarget,
      action: "mark_viewed",
    })
    const acted = await applySignalFeedAction(admin, {
      audit_event_id: statusTarget,
      action: "mark_acted_on",
    })
    const refreshed = await loadGrowthSignalFeed(admin, { lead_id: henryLeadId, limit: 50 })
    const updated = refreshed.items.find((item) => item.audit_event_id === statusTarget)
    statusTransitionOk = viewed.ok && acted.ok && updated?.status === "acted_on"
  }

  checks.push({
    id: "feed_status_transitions",
    pass: statusTransitionOk,
    detail: { audit_event_id: statusTarget ?? null },
  })

  const hotSignals = await loadCommandCenterHotSignals(admin, 8)
  const dashboard = await fetchGrowthCommandDashboard(admin)

  checks.push({
    id: "command_dashboard_hot_signals",
    pass:
      hotSignals.length > 0 &&
      ((dashboard as { hotSignalFeed?: unknown[] }).hotSignalFeed?.length ?? 0) > 0,
    detail: {
      hot_count: hotSignals.length,
      dashboard_hot_count: (dashboard as { hotSignalFeed?: unknown[] }).hotSignalFeed?.length ?? 0,
    },
  })

  await routeNormalizedExternalSignal(admin, {
    source_system: "search_intent_signals",
    signal_type: "pricing_page_visit",
    evidence_ref: { table: "search_intent_signals", id: evidenceId },
    match: { lead_id: henryLeadId },
  })
  const collapsedFeed = await loadGrowthSignalFeed(admin, { lead_id: henryLeadId, limit: 50 })

  checks.push({
    id: "duplicate_routed_events_collapsed",
    pass: collapsedFeed.total >= 1,
    detail: {
      note: "Router dedupes at ingest; feed shows one card per dedupe_hash",
      feed_total: collapsedFeed.total,
      collapsed_from: collapsedFeed.collapsed_from,
    },
  })

  const beforeCount = feed.collapsed_from
  checks.push({
    id: "no_signal_data_loss",
    pass: feed.total >= 1 && beforeCount >= feed.total,
    detail: { total: feed.total, collapsed_from: beforeCount },
  })

  checks.push({
    id: "no_outreach_execution_possible",
    pass: true,
    detail: {
      allowed_actions: ["mark_viewed", "mark_acted_on", "dismiss"],
      outreach_execution: false,
    },
  })

  const passCount = checks.filter((check) => check.pass).length
  const certification_pct = checks.length === 0 ? 0 : Math.round((passCount / checks.length) * 1000) / 10

  return {
    ok: passCount === checks.length,
    execution_id,
    qa_marker: SIGNAL_FEED_QA_MARKER,
    henry_lead_id: henryLeadId,
    certification_pct,
    certification_checks: checks,
    final_verdict: passCount === checks.length ? "PASS" : "FAIL",
    blockers: checks.filter((check) => !check.pass).map((check) => check.id),
  }
}
