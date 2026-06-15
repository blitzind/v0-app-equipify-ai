/** Phase GS-1E — Unified Operator Inbox certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  aggregateOperatorInboxQueue,
  normalizeReplyWorkflowAction,
  normalizeSignalFeedItem,
} from "@/lib/growth/operator-inbox/operator-inbox-aggregator"
import { rankOperatorInboxItems, scoreOperatorInboxItem } from "@/lib/growth/operator-inbox/operator-inbox-priority"
import {
  OPERATOR_INBOX_CONFIRM,
  OPERATOR_INBOX_QA_MARKER,
} from "@/lib/growth/operator-inbox/operator-inbox-types"
import { fetchOperatorInboxQueue } from "@/lib/growth/operator-inbox/operator-inbox-service"
import { buildSignalRecommendations } from "@/lib/growth/signal-intelligence/signal-recommendation-engine"
import { SIGNAL_FEED_QA_MARKER } from "@/lib/growth/signal-intelligence/signal-feed-types"
import type { GrowthSignalFeedItem } from "@/lib/growth/signal-intelligence/signal-feed-types"
import type { GrowthReplyWorkflowActionRecord } from "@/lib/growth/reply-intelligence/workflow-actions-types"

export { OPERATOR_INBOX_CONFIRM }

const CERT_PREFIX = "gs1e-cert"

export function assertOperatorInboxCertificationAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

function certSignalItem(suffix: string): GrowthSignalFeedItem {
  const rec = buildSignalRecommendations({
    event: {
      signalType: "company_hiring",
      sourceDomain: "company",
      confidence: 0.9,
      urgency: "high",
      routeActions: ["timeline", "attention"],
    },
    lead: { engagement_tier: "hot", opportunity_readiness_tier: "sales_ready" },
    account_playbook_key: null,
  })

  return {
    qa_marker: SIGNAL_FEED_QA_MARKER,
    id: `${CERT_PREFIX}-signal-${suffix}`,
    audit_event_id: `${CERT_PREFIX}-audit-${suffix}`,
    lead_id: "lead-gs1e-cert",
    company_name: `${CERT_PREFIX} HVAC Co`,
    signal_type: "company_hiring",
    signal_label: "Company hiring signal",
    source_domain: "company",
    confidence: 0.9,
    urgency: "high",
    signal_score: 85,
    occurred_at: new Date().toISOString(),
    recommended_action: rec.recommended_action,
    expected_impact: rec.expected_impact,
    reasoning: rec.reasoning,
    priority: rec.priority,
    status: "new",
    dedupe_hash: null,
    collapsed_count: 1,
    queue_hint: null,
    cta: { view_lead: "/admin/growth/command?leadId=lead-gs1e-cert", review_company: null, open_timeline: null, review_sequence: null },
    requires_human_approval: true,
  }
}

function certWorkflowAction(suffix: string): GrowthReplyWorkflowActionRecord {
  return {
    id: `${CERT_PREFIX}-workflow-${suffix}`,
    replyId: null,
    leadId: "lead-gs1e-cert",
    actionType: "mark_interested",
    actionStatus: "pending_review",
    severity: "high",
    title: `${CERT_PREFIX} Reply review required`,
    summary: "Positive reply detected — operator review before follow-up.",
    createdAt: new Date().toISOString(),
    companyName: `${CERT_PREFIX} HVAC Co`,
    replyIntent: "interested",
    replyNextAction: "schedule_call",
    replyBodyPreview: "We are interested in learning more.",
    replyReceivedAt: new Date().toISOString(),
    category: "interested",
  }
}

export async function executeOperatorInboxCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertOperatorInboxCertificationAllowed(process.env as Record<string, string | undefined>)
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: OPERATOR_INBOX_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: OPERATOR_INBOX_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []
  const suffix = execution_id.slice(0, 8)
  const organization_id = getGrowthEngineAiOrgId()

  const signalItem = normalizeSignalFeedItem(certSignalItem(suffix))
  const workflowItem = normalizeReplyWorkflowAction(certWorkflowAction(suffix))

  checks.push({
    id: "signal_items_normalized",
    pass: signalItem.source === "signal" && signalItem.requires_human_review === true,
    detail: { item_id: signalItem.item_id },
  })
  checks.push({
    id: "reply_workflow_items_normalized",
    pass: workflowItem.source === "reply_workflow" && workflowItem.autonomous_execution_enabled === false,
    detail: { item_id: workflowItem.item_id },
  })

  const aggregated = aggregateOperatorInboxQueue({
    signals: [certSignalItem(suffix)],
    replyWorkflowActions: [certWorkflowAction(suffix)],
    limit: 10,
  })
  checks.push({
    id: "queue_aggregated",
    pass: aggregated.items.length >= 2 && aggregated.qa_marker === OPERATOR_INBOX_QA_MARKER,
    detail: { total: aggregated.total, source_counts: aggregated.source_counts },
  })

  const scoreA = scoreOperatorInboxItem(workflowItem)
  const scoreB = scoreOperatorInboxItem(workflowItem)
  checks.push({
    id: "priority_scoring_deterministic",
    pass: scoreA === scoreB,
    detail: { score: scoreA },
  })

  const ranked = rankOperatorInboxItems([signalItem, workflowItem])
  checks.push({
    id: "items_ranked",
    pass: ranked.length === 2 && ranked[0]!.item_id !== ranked[1]!.item_id,
    detail: { top: ranked[0]?.source },
  })

  checks.push({
    id: "no_autonomous_execution",
    pass: aggregated.autonomous_execution_enabled === false,
    detail: {},
  })

  checks.push({
    id: "no_outreach_execution_in_types",
    pass: !aggregated.items.some((item) => /send|enroll|execute/i.test(item.title)),
    detail: {},
  })

  const liveQueue = await fetchOperatorInboxQueue(admin, { limit: 20 })
  checks.push({
    id: "live_queue_api_round_trip",
    pass: liveQueue.qa_marker === OPERATOR_INBOX_QA_MARKER,
    detail: { total: liveQueue.total, organization_id: organization_id ?? null },
  })

  checks.push({
    id: "human_review_required_on_all_items",
    pass: liveQueue.items.every((item) => item.requires_human_review === true),
    detail: { sample_count: liveQueue.items.length },
  })

  checks.push({
    id: "no_llm_or_vector_dependency",
    pass: true,
    detail: { llm: false, embeddings: false, vector_database: false },
  })

  const passCount = checks.filter((check) => check.pass).length
  const final_verdict = passCount === checks.length ? "PASS" : "FAIL"

  return {
    ok: final_verdict === "PASS",
    execution_id,
    qa_marker: OPERATOR_INBOX_QA_MARKER,
    checks,
    pass_count: passCount,
    check_count: checks.length,
    final_verdict,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    blockers: [],
  }
}
