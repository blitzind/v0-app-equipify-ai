/**
 * GE-AIOS-DRAFT-FACTORY-DIAGNOSTICS-HELPER-1A — Latest research-complete wake diagnostics (read-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildDraftFactoryWakeDiagnosticTimeline } from "@/lib/growth/draft-factory/draft-factory-wake-observability-diagnostics"
import type { DraftFactoryWakeDiagnosticTimeline } from "@/lib/growth/draft-factory/draft-factory-wake-observability-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  isGrowthPostgrestMissingTableError,
  probeGrowthTablePostgrestAccessible,
} from "@/lib/growth/schema-health/growth-postgrest-table-probe"

export const GROWTH_AIOS_DRAFT_FACTORY_DIAGNOSTICS_HELPER_1A_QA_MARKER =
  "ge-aios-draft-factory-diagnostics-helper-1a-v1" as const

export type LatestResearchCompleteWakeTarget = {
  organizationId: string
  leadId: string
  eventId: string
  researchRunId: string | null
  wakeAttemptId: string
  researchRunCompletedAt: string | null
  eventOccurredAt: string | null
}

export type DraftFactoryDiagnosticsLatestProductionReport = {
  qaMarker: typeof GROWTH_AIOS_DRAFT_FACTORY_DIAGNOSTICS_HELPER_1A_QA_MARKER
  organizationId: string
  generatedAt: string
  postDeployWakeAvailable: boolean
  waitingForFirstProductionWake: boolean
  latestCompletedResearchRun: {
    id: string
    leadId: string
    completedAt: string
  } | null
  target: LatestResearchCompleteWakeTarget | null
  leadCompanyName: string | null
  draftFactoryState: string | null
  timeline: DraftFactoryWakeDiagnosticTimeline | null
  failure: {
    message: string | null
    stage: string | null
    file: string | null
    line: number | null
    stack: string | null
  } | null
}

async function isObservabilityLedgerAccessible(admin: SupabaseClient): Promise<boolean> {
  return probeGrowthTablePostgrestAccessible(admin, "draft_factory_wake_attempts", [
    "id",
    "event_id",
    "lead_id",
    "research_run_id",
    "created_at",
    "wake_type",
  ])
}

async function fetchLatestCompletedResearchRun(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ id: string; leadId: string; completedAt: string } | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("research_runs")
    .select("id, lead_id, completed_at")
    .eq("organization_id", organizationId)
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`fetchLatestCompletedResearchRun failed: ${error.message}`)
  if (!data?.lead_id || !data.completed_at) return null
  return {
    id: String(data.id),
    leadId: String(data.lead_id),
    completedAt: String(data.completed_at),
  }
}

export async function discoverLatestPostDeployResearchCompleteWake(
  admin: SupabaseClient,
  organizationId: string,
): Promise<LatestResearchCompleteWakeTarget | null> {
  const observabilityReady = await isObservabilityLedgerAccessible(admin)
  if (!observabilityReady) return null

  const { data: attempts, error } = await admin
    .schema("growth")
    .from("draft_factory_wake_attempts")
    .select("id, event_id, lead_id, research_run_id, created_at, wake_type")
    .eq("organization_id", organizationId)
    .eq("wake_type", "research_completed")
    .order("created_at", { ascending: false })
    .limit(1)
  if (error) {
    if (isGrowthPostgrestMissingTableError(error.message, error.code)) return null
    throw new Error(`discoverLatestPostDeployResearchCompleteWake failed: ${error.message}`)
  }

  const attempt = attempts?.[0]
  if (!attempt?.event_id || !attempt.lead_id) return null

  const leadId = String(attempt.lead_id)
  const researchRunId = attempt.research_run_id ? String(attempt.research_run_id) : null

  const [{ data: event }, { data: researchRun }] = await Promise.all([
    admin
      .schema("growth")
      .from("ai_os_events")
      .select("occurred_at")
      .eq("id", attempt.event_id)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    researchRunId
      ? admin
          .schema("growth")
          .from("research_runs")
          .select("completed_at")
          .eq("id", researchRunId)
          .eq("organization_id", organizationId)
          .maybeSingle()
      : admin
          .schema("growth")
          .from("research_runs")
          .select("id, completed_at")
          .eq("organization_id", organizationId)
          .eq("lead_id", leadId)
          .eq("status", "completed")
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
  ])

  return {
    organizationId,
    leadId,
    eventId: String(attempt.event_id),
    researchRunId: researchRunId ?? (researchRun && "id" in researchRun ? String(researchRun.id) : null),
    wakeAttemptId: String(attempt.id),
    researchRunCompletedAt:
      researchRun?.completed_at != null
        ? String(researchRun.completed_at)
        : null,
    eventOccurredAt: event?.occurred_at ? String(event.occurred_at) : null,
  }
}

function extractFailureFromTimeline(
  timeline: DraftFactoryWakeDiagnosticTimeline,
): DraftFactoryDiagnosticsLatestProductionReport["failure"] {
  const failed = [...timeline.transitions].reverse().find((row) => row.stage === "FAILED")
  if (!failed) return null
  const failedStage =
    typeof failed.metadata.failed_stage === "string" ? failed.metadata.failed_stage : null
  return {
    message: failed.failureMessage ?? timeline.terminalReason,
    stage: failedStage,
    file: failed.failureFile,
    line: failed.failureLine,
    stack: failed.failureStack,
  }
}

export async function runDraftFactoryDiagnosticsLatestProductionValidation(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<DraftFactoryDiagnosticsLatestProductionReport> {
  const latestRun = await fetchLatestCompletedResearchRun(admin, input.organizationId)
  const target = await discoverLatestPostDeployResearchCompleteWake(admin, input.organizationId)

  if (!target) {
    return {
      qaMarker: GROWTH_AIOS_DRAFT_FACTORY_DIAGNOSTICS_HELPER_1A_QA_MARKER,
      organizationId: input.organizationId,
      generatedAt: new Date().toISOString(),
      postDeployWakeAvailable: false,
      waitingForFirstProductionWake: true,
      latestCompletedResearchRun: latestRun,
      target: null,
      leadCompanyName: latestRun ? ((await fetchGrowthLeadById(admin, latestRun.leadId))?.companyName ?? null) : null,
      draftFactoryState: null,
      timeline: null,
      failure: null,
    }
  }

  const [lead, timeline, dfState] = await Promise.all([
    fetchGrowthLeadById(admin, target.leadId),
    buildDraftFactoryWakeDiagnosticTimeline(admin, {
      organizationId: target.organizationId,
      eventId: target.eventId,
      leadId: target.leadId,
    }),
    admin
      .schema("growth")
      .from("draft_factory_lead_states")
      .select("state")
      .eq("organization_id", target.organizationId)
      .eq("lead_id", target.leadId)
      .maybeSingle(),
  ])

  return {
    qaMarker: GROWTH_AIOS_DRAFT_FACTORY_DIAGNOSTICS_HELPER_1A_QA_MARKER,
    organizationId: input.organizationId,
    generatedAt: new Date().toISOString(),
    postDeployWakeAvailable: true,
    waitingForFirstProductionWake: false,
    latestCompletedResearchRun: latestRun,
    target,
    leadCompanyName: lead?.companyName ?? null,
    draftFactoryState: dfState.data?.state ? String(dfState.data.state) : null,
    timeline,
    failure: extractFailureFromTimeline(timeline),
  }
}

function formatTimestamp(value: string | null | undefined): string {
  return value ?? "—"
}

export function printDraftFactoryDiagnosticsLatestProductionReport(
  report: DraftFactoryDiagnosticsLatestProductionReport,
): void {
  console.log(`\n[GE-AIOS-DRAFT-FACTORY-DIAGNOSTICS-HELPER-1A]`)
  console.log(`qaMarker: ${report.qaMarker}`)
  console.log(`organizationId: ${report.organizationId}`)
  console.log(`generatedAt: ${report.generatedAt}`)

  if (report.waitingForFirstProductionWake) {
    console.log("\nNo post-deployment wake attempts exist yet.")
    console.log("Observability deployment is healthy.")
    console.log("Waiting for first production research completion.")
    if (report.latestCompletedResearchRun) {
      console.log("\nLatest completed research run (pre/post-deploy context):")
      console.log(`  researchRunId: ${report.latestCompletedResearchRun.id}`)
      console.log(`  leadId: ${report.latestCompletedResearchRun.leadId}`)
      console.log(`  completedAt: ${report.latestCompletedResearchRun.completedAt}`)
      if (report.leadCompanyName) console.log(`  company: ${report.leadCompanyName}`)
    }
    return
  }

  const target = report.target
  const timeline = report.timeline
  if (!target || !timeline) {
    throw new Error("diagnostics_report_incomplete")
  }

  console.log("\nLead")
  console.log(`  company: ${report.leadCompanyName ?? "—"}`)
  console.log(`  leadId: ${target.leadId}`)
  console.log(`  organizationId: ${target.organizationId}`)

  console.log("\nResearch Run")
  console.log(`  researchRunId: ${target.researchRunId ?? timeline.researchRunId ?? "—"}`)
  console.log(`  completedAt: ${formatTimestamp(target.researchRunCompletedAt)}`)

  console.log("\nAI OS Event")
  console.log(`  eventId: ${target.eventId}`)
  console.log(`  occurredAt: ${formatTimestamp(target.eventOccurredAt ?? timeline.steps[0]?.occurredAt)}`)

  console.log("\nWake Attempt")
  console.log(`  wakeAttemptId: ${timeline.wakeAttemptId ?? target.wakeAttemptId}`)
  console.log(`  wakeType: research_completed`)

  console.log("\nWake State")
  console.log(`  draftFactoryRowExists: ${timeline.evidence.draftFactoryRowExists ? "yes" : "no"}`)
  console.log(`  wakeReceiptExists: ${timeline.evidence.wakeReceiptExists ? "yes" : "no"}`)
  console.log(`  durableFailureExists: ${timeline.evidence.durableFailureExists ? "yes" : "no"}`)
  console.log(`  invariantSatisfied: ${timeline.evidence.invariantSatisfied ? "yes" : "no"}`)
  console.log(`  draftFactoryState: ${report.draftFactoryState ?? "—"}`)

  console.log("\nTimeline")
  for (const step of timeline.steps) {
    const marker = step.occurredAt ? "✓" : "·"
    const detail = step.detail ? `  ${step.detail}` : ""
    console.log(`  ${marker} ${step.label.padEnd(22)} ${formatTimestamp(step.occurredAt)}${detail}`)
  }

  console.log("\nOutcome")
  console.log(`  ${timeline.terminalOutcome ?? "UNKNOWN"}`)
  if (timeline.terminalReason) console.log(`  reason: ${timeline.terminalReason}`)

  if (report.failure || timeline.terminalOutcome === "FAILED") {
    const failure = report.failure
    console.log("\nFailure")
    console.log(`  message: ${failure?.message ?? timeline.terminalReason ?? "—"}`)
    console.log(`  stage: ${failure?.stage ?? "—"}`)
    console.log(`  file: ${failure?.file ?? "—"}`)
    console.log(`  line: ${failure?.line ?? "—"}`)
    if (failure?.stack) {
      console.log("  stack:")
      for (const line of failure.stack.split("\n").slice(0, 12)) {
        console.log(`    ${line}`)
      }
    }
  }

  if (timeline.handlerTelemetry) {
    console.log("\nHandler Telemetry")
    console.log(`  discovered: ${timeline.handlerTelemetry.handlersDiscovered.join(", ") || "—"}`)
    console.log(`  invoked: ${timeline.handlerTelemetry.handlersInvoked.join(", ") || "—"}`)
    console.log(`  skipped: ${timeline.handlerTelemetry.handlersSkipped.join(", ") || "—"}`)
    if (timeline.handlerTelemetry.handlerFailures.length > 0) {
      console.log(`  failures: ${JSON.stringify(timeline.handlerTelemetry.handlerFailures)}`)
    }
  }

  if (timeline.subscriberTelemetry.length > 0) {
    console.log("\nSubscriber Telemetry")
    for (const row of timeline.subscriberTelemetry) {
      console.log(
        `  ${row.subscriberId}: ${row.status}${row.durationMs != null ? ` (${row.durationMs}ms)` : ""}${
          row.skipReason ? ` — ${row.skipReason}` : ""
        }${row.errorMessage ? ` — ${row.errorMessage}` : ""}`,
      )
    }
  }
}
