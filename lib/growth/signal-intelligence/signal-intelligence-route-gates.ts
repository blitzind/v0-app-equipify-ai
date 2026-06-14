/** Signal intelligence production route gates — client-safe. */

import { SIGNAL_EXTERNAL_BRIDGE_QA_MARKER } from "@/lib/growth/signal-intelligence/lead-signal-event-types"

export const SIGNAL_INTELLIGENCE_ROUTE_QA_MARKER = "signal-intelligence-route-gs1c-v1" as const

export const SIGNAL_INTELLIGENCE_EXECUTE_CONFIRM = "RUN_SIGNAL_INTELLIGENCE_CERTIFICATION" as const

export const SIGNAL_INTELLIGENCE_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production (not preview).",
  "GROWTH_SIGNAL_INTELLIGENCE_ENABLED=true",
  "GROWTH_SIGNAL_INTELLIGENCE_ACK=1",
  "External signals route through routeLeadSignalEvent() only — no alternate recompute paths.",
  "Human approval required for sequence enrollment — queue hints are recommendations only.",
] as const

export function isSignalIntelligenceEnabled(env: Record<string, string | undefined>): boolean {
  return env.GROWTH_SIGNAL_INTELLIGENCE_ENABLED?.trim().toLowerCase() === "true"
}

export function isSignalIntelligenceAcknowledged(env: Record<string, string | undefined>): boolean {
  const ack = env.GROWTH_SIGNAL_INTELLIGENCE_ACK?.trim()
  return ack === "1" || ack?.toLowerCase() === "true"
}

export function assertSignalIntelligenceExecuteAllowed(env: Record<string, string | undefined>): {
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

export function validateSignalIntelligenceCertificationConfirmation(body: unknown): {
  ok: boolean
  dry_run: boolean
  henry_lead_id: string | null
  error: string | null
} {
  if (!body || typeof body !== "object") {
    return { ok: false, dry_run: false, henry_lead_id: null, error: "body_required" }
  }
  const record = body as Record<string, unknown>
  if (record.confirm !== SIGNAL_INTELLIGENCE_EXECUTE_CONFIRM) {
    return { ok: false, dry_run: false, henry_lead_id: null, error: "confirmation_token_required" }
  }
  const henryLeadId = typeof record.henry_lead_id === "string" ? record.henry_lead_id.trim() : null
  return {
    ok: true,
    dry_run: record.dry_run === true,
    henry_lead_id: henryLeadId || null,
    error: null,
  }
}

export function buildSignalIntelligenceReadinessPayload(input?: {
  blockers?: string[]
  gates_ok?: boolean
}): Record<string, unknown> {
  const env = typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : {}
  const gateCheck = assertSignalIntelligenceExecuteAllowed(env)
  return {
    qa_marker: SIGNAL_EXTERNAL_BRIDGE_QA_MARKER,
    route_qa_marker: SIGNAL_INTELLIGENCE_ROUTE_QA_MARKER,
    execute_confirm: SIGNAL_INTELLIGENCE_EXECUTE_CONFIRM,
    readiness_checklist: [...SIGNAL_INTELLIGENCE_READINESS_CHECKLIST],
    gates_ok: input?.gates_ok ?? gateCheck.ok,
    blockers: input?.blockers ?? gateCheck.blockers,
    env: {
      GROWTH_SIGNAL_INTELLIGENCE_ENABLED: isSignalIntelligenceEnabled(env),
      GROWTH_SIGNAL_INTELLIGENCE_ACK: isSignalIntelligenceAcknowledged(env),
      vercel_env: env.VERCEL_ENV ?? null,
    },
  }
}
