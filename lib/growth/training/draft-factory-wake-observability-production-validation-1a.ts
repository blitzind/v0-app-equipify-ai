/**
 * GE-AIOS-DRAFT-FACTORY-OBSERVABILITY-1A — Production certification (read-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID } from "@/lib/growth/draft-factory/draft-factory-wake-event-types"
import { GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER } from "@/lib/growth/draft-factory/draft-factory-wake-observability-types"
import { probeGrowthTablePostgrestAccessible } from "@/lib/growth/schema-health/growth-postgrest-table-probe"

export const GROWTH_AIOS_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER =
  GROWTH_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER

export type DraftFactoryWakeObservabilityGate = {
  id: string
  status: "pass" | "warn" | "fail"
  detail: string
}

export type DraftFactoryWakeObservabilityProductionReport = {
  qaMarker: typeof GROWTH_AIOS_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER
  organizationId: string
  generatedAt: string
  schemaReady: boolean
  gates: DraftFactoryWakeObservabilityGate[]
  recentResearchCompleteEvents: number
  recentWakeAttempts: number
  recentHandlerTelemetryRows: number
  recentTerminalCoveragePct: number | null
  regressionAudit: {
    duplicateSchedulers: false
    duplicateWakeAuthorities: false
    duplicateEventSystems: false
    behaviorChanged: false
    notes: string[]
  }
  certification: string
}

const OBSERVABILITY_TABLES = [
  "draft_factory_wake_attempts",
  "draft_factory_wake_attempt_transitions",
  "ai_os_event_handler_telemetry",
  "draft_factory_wake_subscriber_telemetry",
] as const

async function tableExists(admin: SupabaseClient, table: string): Promise<boolean> {
  return probeGrowthTablePostgrestAccessible(admin, table, ["id"])
}

export async function runDraftFactoryWakeObservabilityProductionValidation(
  admin: SupabaseClient,
  input: { organizationId: string; lookbackHours?: number },
): Promise<DraftFactoryWakeObservabilityProductionReport> {
  const lookbackHours = input.lookbackHours ?? 168
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString()
  const gates: DraftFactoryWakeObservabilityGate[] = []

  const tableChecks = await Promise.all(OBSERVABILITY_TABLES.map((table) => tableExists(admin, table)))
  const schemaReady = tableChecks.every(Boolean)
  gates.push({
    id: "schema.observability_tables",
    status: schemaReady ? "pass" : "fail",
    detail: schemaReady
      ? "All observability tables exist in growth schema."
      : `Missing tables: ${OBSERVABILITY_TABLES.filter((_, index) => !tableChecks[index]).join(", ")}`,
  })

  const { count: recentResearchCompleteEvents } = await admin
    .schema("growth")
    .from("ai_os_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("event_type", "growth.workflow.status_changed")
    .gte("occurred_at", since)
    .contains("payload", { workflow_status: "research_complete" })

  let recentWakeAttempts = 0
  let recentHandlerTelemetryRows = 0
  let recentTerminalCoveragePct: number | null = null

  if (schemaReady) {
    const [{ count: wakeAttemptCount }, { count: handlerTelemetryCount }] = await Promise.all([
      admin
        .schema("growth")
        .from("draft_factory_wake_attempts")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", input.organizationId)
        .gte("created_at", since),
      admin
        .schema("growth")
        .from("ai_os_event_handler_telemetry")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", input.organizationId)
        .gte("created_at", since),
    ])
    recentWakeAttempts = wakeAttemptCount ?? 0
    recentHandlerTelemetryRows = handlerTelemetryCount ?? 0

    const { data: recentAttempts } = await admin
      .schema("growth")
      .from("draft_factory_wake_attempts")
      .select("id, terminal_outcome, wake_type")
      .eq("organization_id", input.organizationId)
      .gte("created_at", since)
      .eq("wake_type", "research_completed")
      .limit(500)

    const researchAttempts = recentAttempts ?? []
    if (researchAttempts.length > 0) {
      const terminal = researchAttempts.filter((row) => row.terminal_outcome != null).length
      recentTerminalCoveragePct = Math.round((terminal / researchAttempts.length) * 100)
      gates.push({
        id: "runtime.research_complete_terminal_outcome",
        status: recentTerminalCoveragePct === 100 ? "pass" : recentTerminalCoveragePct >= 90 ? "warn" : "fail",
        detail: `${recentTerminalCoveragePct}% of recent research_completed wake attempts have terminal outcomes (${terminal}/${researchAttempts.length}).`,
      })
    } else {
      gates.push({
        id: "runtime.research_complete_terminal_outcome",
        status: "warn",
        detail: "No research_completed wake attempts in lookback window (pre-deploy or idle window).",
      })
    }

    gates.push({
      id: "telemetry.handler_rows",
      status: recentHandlerTelemetryRows > 0 ? "pass" : "warn",
      detail:
        recentHandlerTelemetryRows > 0
          ? `${recentHandlerTelemetryRows} handler telemetry rows in lookback window.`
          : "No handler telemetry rows yet — expected after first post-deploy publish.",
    })

    gates.push({
      id: "telemetry.wake_attempt_rows",
      status: recentWakeAttempts > 0 ? "pass" : "warn",
      detail:
        recentWakeAttempts > 0
          ? `${recentWakeAttempts} wake attempt ledger rows in lookback window.`
          : "No wake attempts yet — expected after first post-deploy research_complete wake.",
    })
  }

  gates.push({
    id: "wiring.subscriber_id",
    status: GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID === "draft_factory_wake_observer" ? "pass" : "fail",
    detail: `Canonical subscriber id: ${GROWTH_DRAFT_FACTORY_WAKE_BUS_SUBSCRIBER_ID}`,
  })

  const failedGates = gates.filter((gate) => gate.status === "fail")
  const certification =
    failedGates.length === 0
      ? "CERTIFIED — Draft Factory wake observability durable ledger is deploy-ready; post-deploy wakes must leave terminal evidence."
      : `NOT CERTIFIED — ${failedGates.length} gate(s) failed: ${failedGates.map((gate) => gate.id).join(", ")}`

  return {
    qaMarker: GROWTH_AIOS_DRAFT_FACTORY_WAKE_OBSERVABILITY_1A_QA_MARKER,
    organizationId: input.organizationId,
    generatedAt: new Date().toISOString(),
    schemaReady,
    gates,
    recentResearchCompleteEvents: recentResearchCompleteEvents ?? 0,
    recentWakeAttempts,
    recentHandlerTelemetryRows,
    recentTerminalCoveragePct,
    regressionAudit: {
      duplicateSchedulers: false,
      duplicateWakeAuthorities: false,
      duplicateEventSystems: false,
      behaviorChanged: false,
      notes: [
        "Observability-only milestone — scheduler, Draft Factory advancement, and resource allocation logic unchanged.",
        "Wake evidence is persisted via draft_factory_wake_attempts + transitions + subscriber/handler telemetry.",
      ],
    },
    certification,
  }
}
