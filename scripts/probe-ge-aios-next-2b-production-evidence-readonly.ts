/**
 * GE-AIOS-NEXT-2B — Read-only Production evidence for continuous runtime certification.
 *
 * Run via Vercel Production env:
 *   pnpm probe:ge-aios-next-2b-production-evidence-readonly
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { listRecentGrowthCronExecutionRuns } from "@/lib/growth/runtime/cron-telemetry-repository"
import { growthCronApiPath } from "@/lib/growth/runtime/cron-telemetry-types"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import {
  AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import { GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

export const GE_AIOS_NEXT_2B_PRODUCTION_EVIDENCE_QA_MARKER =
  "ge-aios-next-2b-continuous-runtime-production-evidence-v1" as const

const OBJECTIVE_SCHEDULER_ROUTE = growthCronApiPath("growth-objective-runtime-scheduler")
const OBSERVATION_HOURS = Number(process.env.GE_AIOS_NEXT_2B_OBSERVATION_HOURS ?? "24")

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

async function main(): Promise<void> {
  const boot = await bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("production_bootstrap_failed")
  const admin = boot.admin
  const organizationId = getGrowthEngineAiOrgId() || EQUIPIFY_PRODUCTION_ORG_ID
  const sinceIso = hoursAgoIso(OBSERVATION_HOURS)
  const nowIso = new Date().toISOString()

  const [
    schedulerRuns,
    objectiveRows,
    datamoonRuns,
    recentLeads,
    outboundMessages,
    draftFactoryStates,
    killSwitches,
  ] = await Promise.all([
    listRecentGrowthCronExecutionRuns(admin, { cronRoute: OBJECTIVE_SCHEDULER_ROUTE, limit: 100 }),
    admin
      .schema("growth")
      .from("organization_growth_objectives")
      .select("id, title, status, current_value, target_value, runtime_state, scheduler_wake_at, updated_at")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .limit(10),
    admin
      .schema("growth")
      .from("datamoon_audience_import_runs")
      .select("id, run_name, status, record_count, preview_count, imported_count, created_at, completed_at, last_polled_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .schema("growth")
      .from("leads")
      .select("id, created_at, source_channel, status, organization_id")
      .eq("organization_id", organizationId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .schema("growth")
      .from("outbound_messages")
      .select("id, created_at, status, channel")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .schema("growth")
      .from("draft_factory_lead_states")
      .select("lead_id, state, updated_at, next_eligible_wake_at")
      .gte("updated_at", sinceIso)
      .order("updated_at", { ascending: false })
      .limit(25),
    getRuntimeKillSwitchStates(admin, organizationId).catch(() => null),
  ])

  const schedulerInWindow = schedulerRuns.filter((run) => run.startedAt >= sinceIso)
  const schedulerSuccessInWindow = schedulerInWindow.filter((run) => run.ok)
  const autonomousDiscoveryRuns = (datamoonRuns.data ?? []).filter((row) =>
    String(row.run_name ?? "").startsWith(AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX),
  )

  const objectiveTicksInWindow = (objectiveRows.data ?? []).map((row) => {
    const runtime = (row as { runtime_state?: { lastTickAt?: string; missionRuntime?: { lastOrchestrationAt?: string } } })
      .runtime_state
    return {
      id: row.id,
      title: row.title,
      currentValue: row.current_value,
      targetValue: row.target_value,
      lastTickAt: runtime?.lastTickAt ?? null,
      lastOrchestrationAt: runtime?.missionRuntime?.lastOrchestrationAt ?? null,
      updatedAt: row.updated_at,
    }
  })

  const evidence = {
    qaMarker: GE_AIOS_NEXT_2B_PRODUCTION_EVIDENCE_QA_MARKER,
    readOnly: true,
    organizationId,
    observationWindow: {
      hours: OBSERVATION_HOURS,
      since: sinceIso,
      until: nowIso,
    },
    continuousExecution: {
      schedulerRunsInWindow: schedulerInWindow.length,
      schedulerSuccessInWindow: schedulerSuccessInWindow.length,
      schedulerFailureInWindow: schedulerInWindow.length - schedulerSuccessInWindow.length,
      latestSchedulerRun: schedulerRuns[0] ?? null,
      objectiveActiveCount: objectiveRows.data?.length ?? 0,
      objectiveTicksInWindow,
      autonomousDiscoveryRunsInWindow: autonomousDiscoveryRuns.length,
      leadsAdmittedInWindow: recentLeads.data?.length ?? 0,
      draftFactoryUpdatesInWindow: draftFactoryStates.data?.length ?? 0,
    },
    outboundPolicy: {
      automationRuntimeSafetyFlags: GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS,
      outboundMessagesInWindow: outboundMessages.data?.length ?? 0,
      recentOutboundSample: (outboundMessages.data ?? []).slice(0, 5),
      killSwitches,
    },
    bottleneckSignals: {
      draftFactoryDueSample: draftFactoryStates.data ?? [],
      schedulerSkippedReason:
        (schedulerRuns[0]?.metadata?.autonomous_sales_loop as { skipped_reason?: string } | undefined)
          ?.skipped_reason ?? null,
    },
    errors: {
      objectives: objectiveRows.error?.message ?? null,
      datamoon: datamoonRuns.error?.message ?? null,
      leads: recentLeads.error?.message ?? null,
      outbound: outboundMessages.error?.message ?? null,
      draftFactory: draftFactoryStates.error?.message ?? null,
    },
  }

  console.log(JSON.stringify(evidence, null, 2))
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
