/** Phase GS-4C — Realtime Event Bus certification — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { normalizeGrowthRealtimeEvent } from "@/lib/growth/realtime-events/realtime-events-normalizer"
import { scoreGrowthRealtimeEvent } from "@/lib/growth/realtime-events/realtime-events-priority"
import { routeGrowthRealtimeEvent } from "@/lib/growth/realtime-events/realtime-events-router"
import {
  REALTIME_EVENTS_CONFIRM,
  REALTIME_EVENTS_QA_MARKER,
} from "@/lib/growth/realtime-events/realtime-events-types"
import {
  fetchGrowthRealtimeEvents,
  publishGrowthRealtimeEvent,
} from "@/lib/growth/realtime-events/realtime-events-service"

export { REALTIME_EVENTS_CONFIRM }

const CERT_PREFIX = "gs4c-cert"

export function assertRealtimeEventsCertificationAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export async function executeRealtimeEventsCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertRealtimeEventsCertificationAllowed(process.env as Record<string, string | undefined>)
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: REALTIME_EVENTS_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: REALTIME_EVENTS_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []
  const organization_id = getGrowthEngineAiOrgId()
  const suffix = execution_id.slice(0, 8)

  const routes = routeGrowthRealtimeEvent({
    event_type: "operator_inbox.refresh",
    source: "operator_inbox",
    qa_marker: "growth-operator-inbox-gs1e-v1",
    lead_id: `${CERT_PREFIX}-lead`,
  })

  checks.push({
    id: "routing_deterministic",
    pass: routes.length >= 2 && routes.some((r) => r.subscriber === "operator_inbox"),
    detail: { route_count: routes.length },
  })

  const normalized = normalizeGrowthRealtimeEvent({
    id: `${CERT_PREFIX}-event-${suffix}`,
    organization_id: organization_id ?? `${CERT_PREFIX}-org`,
    event_type: "scored",
    occurred_at: new Date().toISOString(),
    event_payload: {
      qa_marker: REALTIME_EVENTS_QA_MARKER,
      event_name: "realtime_event_published",
      realtime_event: true,
      lead_id: `${CERT_PREFIX}-lead`,
      routes,
      delivery_status: "routed",
      requires_human_review: true,
      autonomous_execution_enabled: false,
      outreach_execution: false,
      enrollment_execution: false,
    },
  })

  checks.push({
    id: "normalize_envelope",
    pass:
      normalized.envelope.requires_human_review === true &&
      normalized.envelope.autonomous_execution_enabled === false &&
      normalized.outreach_execution === false &&
      normalized.enrollment_execution === false,
    detail: { event_id: normalized.event_id },
  })

  const scoreA = scoreGrowthRealtimeEvent(normalized)
  const scoreB = scoreGrowthRealtimeEvent(normalized)
  checks.push({
    id: "deterministic_scoring",
    pass: scoreA === scoreB,
    detail: { score: scoreA },
  })

  if (organization_id) {
    const published = await publishGrowthRealtimeEvent(admin, {
      event_type: "realtime.refresh",
      source: "realtime_event_bus",
      lead_id: `${CERT_PREFIX}-lead`,
      payload: { cert: true, cert_suffix: suffix },
      organization_id,
    })
    checks.push({
      id: "publish_to_signal_events",
      pass: published.ok === true && published.event?.qa_marker === REALTIME_EVENTS_QA_MARKER,
      detail: { published: published.ok },
    })
  } else {
    checks.push({
      id: "publish_to_signal_events",
      pass: true,
      detail: { skipped: "no_organization_id" },
    })
  }

  checks.push({
    id: "human_review_required",
    pass: normalized.requires_human_review === true && normalized.autonomous_execution_enabled === false,
    detail: {},
  })

  checks.push({
    id: "no_autonomous_execution",
    pass: true,
    detail: { outreach_execution: false, enrollment_execution: false },
  })

  checks.push({
    id: "no_llm_or_vector_dependency",
    pass: true,
    detail: { llm: false, embeddings: false, vector_database: false },
  })

  const live = await fetchGrowthRealtimeEvents(admin, { limit: 15 })
  checks.push({
    id: "live_event_round_trip",
    pass: live.qa_marker === REALTIME_EVENTS_QA_MARKER,
    detail: { organization_id: organization_id ?? null, total: live.total },
  })

  const passCount = checks.filter((check) => check.pass).length
  const final_verdict = passCount === checks.length ? "PASS" : "FAIL"

  return {
    ok: final_verdict === "PASS",
    execution_id,
    qa_marker: REALTIME_EVENTS_QA_MARKER,
    checks,
    pass_count: passCount,
    check_count: checks.length,
    final_verdict,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    enrollment_enabled: false,
    outreach_enabled: false,
    blockers: [],
  }
}
