/** GE-AUTO-2B/2C/2D — Objective event router (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { rememberObjectiveSourceEventReceipt } from "@/lib/growth/objectives/growth-objective-event-dedupe"
import { listGrowthObjectivesForOrganizationEvent } from "@/lib/growth/objectives/growth-objective-repository"
import {
  autoContinueGrowthObjectiveRuntime,
  ingestGrowthObjectiveSignal,
} from "@/lib/growth/objectives/growth-objective-runtime-service"
import {
  mapSourceEventToObjectiveSignal,
  type GrowthObjectiveSourceEvent,
} from "@/lib/growth/objectives/growth-objective-signal-mapper"
import { objectiveMatchesSourceEvent } from "@/lib/growth/objectives/growth-objective-subscriptions"
import { GROWTH_OBJECTIVE_EVENT_ROUTER_QA_MARKER } from "@/lib/growth/objectives/growth-objective-types"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export type GrowthObjectiveEventRouteResult = {
  qa_marker: typeof GROWTH_OBJECTIVE_EVENT_ROUTER_QA_MARKER
  ok: boolean
  duplicate: boolean
  objectivesMatched: number
  signalsIngested: number
  skippedReason: string | null
}

export async function routeGrowthObjectiveSourceEvent(
  admin: SupabaseClient,
  event: GrowthObjectiveSourceEvent,
): Promise<GrowthObjectiveEventRouteResult> {
  const idempotencyKey =
    event.idempotencyKey ??
    `${event.organizationId}:${event.source}:${event.signalType}:${event.leadId ?? ""}:${event.occurredAt ?? ""}`

  const receipt = await rememberObjectiveSourceEventReceipt(admin, {
    idempotencyKey,
    organizationId: event.organizationId,
    source: event.source,
    signalType: event.signalType,
    leadId: event.leadId,
  })

  if (receipt.duplicate) {
    return {
      qa_marker: GROWTH_OBJECTIVE_EVENT_ROUTER_QA_MARKER,
      ok: true,
      duplicate: true,
      objectivesMatched: 0,
      signalsIngested: 0,
      skippedReason: "Duplicate objective event.",
    }
  }

  const killSwitches = await getRuntimeKillSwitchStates(admin)
  if (!killSwitches.autonomy_enabled || !killSwitches.autonomy_objective_mode_enabled) {
    return {
      qa_marker: GROWTH_OBJECTIVE_EVENT_ROUTER_QA_MARKER,
      ok: true,
      duplicate: false,
      objectivesMatched: 0,
      signalsIngested: 0,
      skippedReason: "Objective mode disabled by kill switch.",
    }
  }

  const signal = mapSourceEventToObjectiveSignal(event)
  if (!signal) {
    return {
      qa_marker: GROWTH_OBJECTIVE_EVENT_ROUTER_QA_MARKER,
      ok: true,
      duplicate: false,
      objectivesMatched: 0,
      signalsIngested: 0,
      skippedReason: `Unmapped signal type: ${event.signalType}`,
    }
  }

  const objectives = await listGrowthObjectivesForOrganizationEvent(admin, event.organizationId)
  const matched = objectives.filter((objective) => objectiveMatchesSourceEvent(objective, event))

  let signalsIngested = 0
  for (const objective of matched) {
    await ingestGrowthObjectiveSignal(admin, event.organizationId, objective.id, signal)
    await autoContinueGrowthObjectiveRuntime(admin, event.organizationId, objective.id)
    signalsIngested += 1
  }

  logGrowthEngine("growth_objective_event_routed", {
    qa_marker: GROWTH_OBJECTIVE_EVENT_ROUTER_QA_MARKER,
    organization_id: event.organizationId,
    source: event.source,
    signal_type: event.signalType,
    objectives_matched: matched.length,
    signals_ingested: signalsIngested,
    dedupe_persisted: receipt.persisted,
  })

  return {
    qa_marker: GROWTH_OBJECTIVE_EVENT_ROUTER_QA_MARKER,
    ok: true,
    duplicate: false,
    objectivesMatched: matched.length,
    signalsIngested,
    skippedReason: matched.length === 0 ? "No running objectives matched event." : null,
  }
}

export const GrowthObjectiveEventRouter = {
  routeGrowthObjectiveSourceEvent,
} as const
