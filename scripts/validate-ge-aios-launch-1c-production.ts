/**
 * GE-AIOS-LAUNCH-1C — Production activation & employee mode validation (read-only).
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { GROWTH_AVA_ACTIVATION_1C_QA_MARKER } from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

const PHASE = "GE-AIOS-LAUNCH-1C" as const

type Gate = { id: string; status: "pass" | "warn" | "fail"; detail: string }

function pushGate(gates: Gate[], gate: Gate): void {
  gates.push(gate)
  const icon = gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : "✗"
  console.log(`  ${icon} [${gate.id}] ${gate.detail}`)
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production activation validation (read-only)`)
  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) process.exit(1)
  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const gates: Gate[] = []

  const CERT_ACTOR_USER_ID = "00000000-0000-0000-0000-000000000001"

  const summary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: "production-cert@equipify.ai",
    actorUserId: CERT_ACTOR_USER_ID,
  })

  const activation = summary.avaActivation
  pushGate(gates, {
    id: "activation_payload_loaded",
    status: activation?.qaMarker === GROWTH_AVA_ACTIVATION_1C_QA_MARKER ? "pass" : "fail",
    detail: activation ? `activated=${activation.activated}; ready=${activation.readiness.ready}` : "missing",
  })

  const runtimeTrust = buildGrowthHomeRuntimeTrustViewModel({
    server: summary.runtimeTrust ?? null,
    salesOutcomes: summary.salesOutcomes,
    activeWork: null,
    pendingApprovals: summary.kpis.approvalQueueCount,
    setupIncomplete: false,
    missionDiscovery: summary.missionDiscovery,
    activation: activation ?? null,
    generatedAt: summary.generatedAt,
  })

  pushGate(gates, {
    id: "employee_mode_when_activated",
    status: activation?.activated ? (runtimeTrust.employeeMode ? "pass" : "fail") : "warn",
    detail: `employeeMode=${runtimeTrust.employeeMode}`,
  })

  pushGate(gates, {
    id: "activation_cta_when_ready_not_activated",
    status:
      activation && activation.readiness.ready && !activation.activated
        ? runtimeTrust.startStatus.primaryActionKind === "activate"
          ? "pass"
          : "fail"
        : "warn",
    detail: `mode=${runtimeTrust.startStatus.mode}; action=${runtimeTrust.startStatus.primaryActionKind ?? "none"}`,
  })

  pushGate(gates, {
    id: "employment_stats_when_activated",
    status:
      activation?.activated && runtimeTrust.employment
        ? "pass"
        : activation?.activated
          ? "warn"
          : "pass",
    detail: runtimeTrust.employment
      ? `researched=${runtimeTrust.employment.companiesResearched}; prepared=${runtimeTrust.employment.opportunitiesPrepared}`
      : "none",
  })

  const failCount = gates.filter((row) => row.status === "fail").length
  const passCount = gates.filter((row) => row.status === "pass").length
  console.log(`\n[${PHASE}] org=${organizationId} score=${Math.round((passCount / gates.length) * 100)}/100`)
  if (failCount > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
