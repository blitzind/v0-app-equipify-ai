/**
 * GE-AIOS-HOME-UX-CLOSURE-1A — Production operator Home validation (read-only).
 *
 * Run: pnpm validate:ge-aios-home-ux-closure-1a-production
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildGrowthHomeRuntimeTrustViewModel } from "@/lib/growth/home/growth-home-runtime-trust-presenter-1b"
import { buildGrowthHomeWorkspaceSummary } from "@/lib/growth/home/growth-home-workspace-summary-service"
import {
  GROWTH_HOME_OPERATOR_CLOSURE_1A_QA_MARKER,
  GROWTH_HOME_OPERATOR_CLOSURE_NO_ACTION_MESSAGE,
} from "@/lib/growth/home/growth-home-operator-closure-1a"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_CERT_DEFAULT_AI_ORG_ID } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const PHASE = "GE-AIOS-HOME-UX-CLOSURE-1A" as const
const CERT_ACTOR_USER_ID = "00000000-0000-0000-0000-000000000001"

type Gate = { id: string; status: "pass" | "warn" | "fail"; detail: string }

function pushGate(gates: Gate[], gate: Gate): void {
  gates.push(gate)
  const icon = gate.status === "pass" ? "✓" : gate.status === "warn" ? "!" : "✗"
  console.log(`  ${icon} [${gate.id}] ${gate.detail}`)
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production operator Home validation (read-only)`)

  const bootstrap = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!bootstrap) process.exit(1)
  if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
    process.env.GROWTH_ENGINE_AI_ORG_ID = GROWTH_CERT_DEFAULT_AI_ORG_ID
  }

  const admin: SupabaseClient = bootstrap.admin
  const organizationId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const gates: Gate[] = []

  const dashboardBody = readSource("components/growth/workspace/growth-workspace-dashboard-body.tsx")
  pushGate(gates, {
    id: "employee_mode_routes_to_briefing",
    status: dashboardBody.includes("isGrowthWorkspacePriorityFeedActive() && !employeeMode") ? "pass" : "fail",
    detail: "Activated Ava bypasses UX-1A priority feed",
  })

  const briefingDashboard = readSource(
    "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  )
  pushGate(gates, {
    id: "operator_closure_wiring",
    status:
      briefingDashboard.includes("operatorClosureMode") &&
      briefingDashboard.includes("GROWTH_HOME_OPERATOR_CLOSURE_1A_QA_MARKER")
        ? "pass"
        : "fail",
    detail: "Executive briefing enforces operator closure mode",
  })

  const summary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: "home-ux-closure@equipify.ai",
    actorUserId: CERT_ACTOR_USER_ID,
  })

  const employeeMode = summary.avaActivation?.activated === true
  pushGate(gates, {
    id: "employee_mode_active",
    status: employeeMode ? "pass" : "warn",
    detail: `activated=${employeeMode}`,
  })

  const runtimeTrust = buildGrowthHomeRuntimeTrustViewModel({
    server: summary.runtimeTrust ?? null,
    salesOutcomes: summary.salesOutcomes,
    activeWork: null,
    pendingApprovals: summary.kpis.approvalQueueCount,
    setupIncomplete: false,
    missionDiscovery: summary.missionDiscovery,
    activation: summary.avaActivation ?? null,
    generatedAt: summary.generatedAt,
    canonicalFocusCompanyName: summary.canonicalOperatorFocus?.companyName ?? null,
  })

  pushGate(gates, {
    id: "closure_qa_marker",
    status: GROWTH_HOME_OPERATOR_CLOSURE_1A_QA_MARKER ? "pass" : "fail",
    detail: GROWTH_HOME_OPERATOR_CLOSURE_1A_QA_MARKER,
  })

  pushGate(gates, {
    id: "primary_company_resolved",
    status: runtimeTrust.primaryCompanyName != null || summary.canonicalOperatorFocus?.companyName != null ? "pass" : "warn",
    detail: `primary=${runtimeTrust.primaryCompanyName ?? summary.canonicalOperatorFocus?.companyName ?? "none"}`,
  })

  pushGate(gates, {
    id: "what_happens_next",
    status: runtimeTrust.whatHappensNextLines.length > 0 ? "pass" : "warn",
    detail: runtimeTrust.whatHappensNextLines.join(" | ") || "empty",
  })

  pushGate(gates, {
    id: "can_close_browser",
    status: runtimeTrust.canCloseBrowserLine != null ? "pass" : "warn",
    detail: runtimeTrust.canCloseBrowserLine ?? "missing",
  })

  pushGate(gates, {
    id: "no_action_copy",
    status: GROWTH_HOME_OPERATOR_CLOSURE_NO_ACTION_MESSAGE.includes("don't need anything") ? "pass" : "fail",
    detail: "Operator idle copy present",
  })

  const failCount = gates.filter((row) => row.status === "fail").length
  const passCount = gates.filter((row) => row.status === "pass").length
  console.log(`\n[${PHASE}] org=${organizationId}`)
  console.log(`[${PHASE}] Operator Home closure score: ${Math.round((passCount / gates.length) * 100)}/100`)
  console.log(
    `[${PHASE}] Above-the-fold: status=${runtimeTrust.operatorStateLabel}; company=${runtimeTrust.primaryCompanyName ?? "—"}`,
  )

  if (failCount > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
