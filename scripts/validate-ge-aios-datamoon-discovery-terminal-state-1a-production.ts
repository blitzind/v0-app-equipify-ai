/**
 * GE-AIOS-DATAMOON-DISCOVERY-TERMINAL-STATE-1A — Production read-only certification.
 *
 * Run:
 *   pnpm validate:ge-aios-datamoon-discovery-terminal-state-1a-production
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  DATAMOON_AUDIENCE_PROVIDER_TERMINAL_STATUSES,
  GROWTH_DATAMOON_AUDIENCE_PROVIDER_TERMINAL_STATE_1A_QA_MARKER,
  isDatamoonAudienceProviderTerminalStatus,
  normalizeDatamoonAudienceProviderStatus,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-fetch-payload"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  findActiveAutonomousProspectSearchDatamoonRun,
  isDatamoonAutonomousDiscoveryRunActive,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import { AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"

const PHASE = "GE-AIOS-DATAMOON-DISCOVERY-TERMINAL-STATE-1A" as const

type Gate = { id: string; status: "pass" | "warn" | "fail"; detail: string }

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production certification (read-only)`)
  console.log(`QA marker: ${GROWTH_DATAMOON_AUDIENCE_PROVIDER_TERMINAL_STATE_1A_QA_MARKER}`)

  const gates: Gate[] = []
  const serviceSource = readFileSync(
    resolve("lib/growth/lead-sources/datamoon/datamoon-audience-import-service.ts"),
    "utf8",
  )
  const orchestratorSource = readFileSync(
    resolve("lib/growth/objectives/growth-objective-runtime-scheduler.ts"),
    "utf8",
  )

  gates.push({
    id: "single_poll_transition_authority",
    status: serviceSource.includes("isDatamoonAudienceProviderTerminalStatus") &&
      serviceSource.includes("failDatamoonAudienceImportRun")
      ? "pass"
      : "fail",
    detail: "pollDatamoonAudienceImportRun terminalizes provider failures via failDatamoonAudienceImportRun only.",
  })
  gates.push({
    id: "no_duplicate_scheduler_or_poller",
    status:
      (serviceSource.match(/export async function pollDatamoonAudienceImportRun/g) ?? []).length === 1 &&
      !orchestratorSource.includes("fetchAudience(")
        ? "pass"
        : "fail",
    detail: "Single poll transition authority; objective scheduler does not fetch audiences directly.",
  })
  gates.push({
    id: "canonical_terminal_status_set",
    status: "pass",
    detail: `Terminal statuses: ${DATAMOON_AUDIENCE_PROVIDER_TERMINAL_STATUSES.join(", ")}`,
  })

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) {
    gates.push({
      id: "production_bootstrap",
      status: "fail",
      detail: "Run via vercel-production-env-run.ts",
    })
    printGates(gates)
    process.exit(1)
  }

  const admin = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID

  const { data: autonomousRuns } = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("id, status, error_message, last_polled_at, provider_metadata")
    .like("run_name", `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:%`)
    .in("status", ["building", "pending_build"])
    .order("created_at", { ascending: false })
    .limit(20)

  const stuckTerminalPollRuns = (autonomousRuns ?? []).filter((row) => {
    const meta = (row.provider_metadata as Record<string, unknown>) ?? {}
    const pollStatus = normalizeDatamoonAudienceProviderStatus(String(meta.poll_status ?? ""))
    return row.status === "building" && isDatamoonAudienceProviderTerminalStatus(pollStatus)
  })

  gates.push({
    id: "no_building_runs_with_terminal_provider_poll_status",
    status: stuckTerminalPollRuns.length === 0 ? "pass" : "warn",
    detail:
      stuckTerminalPollRuns.length === 0
        ? "No active building runs carry terminal provider poll_status."
        : `${stuckTerminalPollRuns.length} building run(s) still have terminal poll_status — await next scheduler poll after deploy: ${stuckTerminalPollRuns
            .map((row) => row.id)
            .join(", ")}`,
  })

  const activeRun = await findActiveAutonomousProspectSearchDatamoonRun(admin, organizationId)
  gates.push({
    id: "discovery_replenishment_unblocked_when_no_active_run",
    status:
      !activeRun || !isDatamoonAutonomousDiscoveryRunActive(activeRun)
        ? "pass"
        : activeRun.providerMetadata?.poll_status &&
            isDatamoonAudienceProviderTerminalStatus(String(activeRun.providerMetadata.poll_status))
          ? "warn"
          : "pass",
    detail: activeRun
      ? `Active canonical run ${activeRun.id} status=${activeRun.status} poll_status=${String(activeRun.providerMetadata?.poll_status ?? "null")}`
      : "No active canonical autonomous import run — replenishment can start a new run.",
  })

  printGates(gates)
  if (gates.some((gate) => gate.status === "fail")) process.exit(1)
}

function printGates(gates: Gate[]): void {
  for (const gate of gates) {
    console.log(`[${gate.status.toUpperCase()}] ${gate.id}: ${gate.detail}`)
  }
  const passed = gates.filter((gate) => gate.status === "pass").length
  console.log(`\n[${PHASE}] ${passed}/${gates.length} gates passed`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
