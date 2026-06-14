/** Signal Feed production route gates — client-safe. */

import { SIGNAL_FEED_EXECUTE_CONFIRM, SIGNAL_FEED_QA_MARKER } from "@/lib/growth/signal-intelligence/signal-feed-types"

export { SIGNAL_FEED_EXECUTE_CONFIRM }
import {
  isSignalIntelligenceAcknowledged,
  isSignalIntelligenceEnabled,
} from "@/lib/growth/signal-intelligence/signal-intelligence-route-gates"

export const SIGNAL_FEED_ROUTE_QA_MARKER = "signal-feed-route-gs1d-v1" as const

export const SIGNAL_FEED_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "GROWTH_SIGNAL_INTELLIGENCE_ENABLED=true and GROWTH_SIGNAL_INTELLIGENCE_ACK=1.",
  "Feed reads routed growth.signal_events only — no duplicate signal stores.",
  "Feed actions update feed_status in event_payload only — no outreach execution.",
  "All recommendations require human approval.",
] as const

export const ALLOWED_SIGNAL_FEED_ACTIONS = ["mark_viewed", "mark_acted_on", "dismiss"] as const

export function assertSignalFeedExecuteAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  if (!isSignalIntelligenceEnabled(env)) {
    blockers.push("GROWTH_SIGNAL_INTELLIGENCE_ENABLED_not_true")
  }
  if (!isSignalIntelligenceAcknowledged(env)) {
    blockers.push("GROWTH_SIGNAL_INTELLIGENCE_ACK_not_set")
  }
  return { ok: blockers.length === 0, blockers }
}

export function validateSignalFeedCertificationConfirmation(body: unknown): {
  ok: boolean
  henry_lead_id: string | null
  dry_run: boolean
  error: string | null
} {
  if (!body || typeof body !== "object") {
    return { ok: false, henry_lead_id: null, dry_run: false, error: "body_required" }
  }
  const record = body as Record<string, unknown>
  if (record.confirm !== SIGNAL_FEED_EXECUTE_CONFIRM) {
    return { ok: false, henry_lead_id: null, dry_run: false, error: "confirmation_token_required" }
  }
  const henryLeadId = typeof record.henry_lead_id === "string" ? record.henry_lead_id.trim() : null
  return {
    ok: true,
    henry_lead_id: henryLeadId || null,
    dry_run: record.dry_run === true,
    error: null,
  }
}

export function validateSignalFeedActionBody(body: unknown): {
  ok: boolean
  audit_event_id: string | null
  action: (typeof ALLOWED_SIGNAL_FEED_ACTIONS)[number] | null
  error: string | null
} {
  if (!body || typeof body !== "object") {
    return { ok: false, audit_event_id: null, action: null, error: "body_required" }
  }
  const record = body as Record<string, unknown>
  const action = typeof record.action === "string" ? record.action.trim() : ""
  const auditEventId = typeof record.audit_event_id === "string" ? record.audit_event_id.trim() : ""
  if (!ALLOWED_SIGNAL_FEED_ACTIONS.includes(action as (typeof ALLOWED_SIGNAL_FEED_ACTIONS)[number])) {
    return { ok: false, audit_event_id: null, action: null, error: "invalid_action" }
  }
  if (!auditEventId) {
    return { ok: false, audit_event_id: null, action: null, error: "audit_event_id_required" }
  }
  return {
    ok: true,
    audit_event_id: auditEventId,
    action: action as (typeof ALLOWED_SIGNAL_FEED_ACTIONS)[number],
    error: null,
  }
}

export function buildSignalFeedReadinessPayload(input?: {
  blockers?: string[]
  gates_ok?: boolean
}): Record<string, unknown> {
  const env = typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : {}
  const gateCheck = assertSignalFeedExecuteAllowed(env)
  return {
    qa_marker: SIGNAL_FEED_QA_MARKER,
    route_qa_marker: SIGNAL_FEED_ROUTE_QA_MARKER,
    execute_confirm: SIGNAL_FEED_EXECUTE_CONFIRM,
    readiness_checklist: [...SIGNAL_FEED_READINESS_CHECKLIST],
    allowed_feed_actions: [...ALLOWED_SIGNAL_FEED_ACTIONS],
    gates_ok: input?.gates_ok ?? gateCheck.ok,
    blockers: input?.blockers ?? gateCheck.blockers,
    no_outreach_execution: true,
  }
}
