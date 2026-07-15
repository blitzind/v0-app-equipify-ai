/**
 * GE-AIOS-LIVE-INTERNAL-AUTONOMY-ACTIVATION-1B — Post-deploy internal autonomy gate (read-only Production).
 *
 * Run after operator completes deploy + env + migration + portfolio admission:
 *   pnpm test:ge-aios-live-internal-autonomy-activation-1b
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { isNativeRevenueDecisionEngineEnabled } from "@/lib/growth/contact-verification/native-revenue-decision-feature"
import { isDailyRevenueWorkQueueEnabled } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-feature"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { GROWTH_AUTONOMOUS_PORTFOLIO_WORK_SNAPSHOT_QA_MARKER } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { GROWTH_AIOS_RUNTIME_CONTEXT_1A_QA_MARKER } from "@/lib/growth/aios/runtime/growth-aios-runtime-context-1a-types"
import { GROWTH_CANONICAL_EXECUTION_AUTHORITY_1A_QA_MARKER } from "@/lib/growth/aios/execution/growth-canonical-execution-authority-1a"

export const GE_AIOS_LIVE_INTERNAL_AUTONOMY_ACTIVATION_1B_QA_MARKER =
  "ge-aios-live-internal-autonomy-activation-1b-v1" as const

export const GE_AIOS_LIVE_INTERNAL_AUTONOMY_ACTIVATION_1B_VERDICT = {
  INTERNAL_AUTONOMY_ACTIVE: "INTERNAL_AUTONOMY_ACTIVE",
  READY_AFTER_OPERATOR_CONFIGURATION: "READY_AFTER_OPERATOR_CONFIGURATION",
  READY_AFTER_PORTFOLIO_ADMISSION: "READY_AFTER_PORTFOLIO_ADMISSION",
  BLOCKED_BY_UNDEPLOYED_RUNTIME: "BLOCKED_BY_UNDEPLOYED_RUNTIME",
  BLOCKED_BY_ORGANIZATION_CONFIGURATION: "BLOCKED_BY_ORGANIZATION_CONFIGURATION",
  BLOCKED_BY_PORTFOLIO_RANKING_CONFIGURATION: "BLOCKED_BY_PORTFOLIO_RANKING_CONFIGURATION",
  BLOCKED_BY_EMPTY_OR_INELIGIBLE_PORTFOLIO: "BLOCKED_BY_EMPTY_OR_INELIGIBLE_PORTFOLIO",
  BLOCKED_BY_RUNTIME_CODE_DEFECT: "BLOCKED_BY_RUNTIME_CODE_DEFECT",
  BLOCKED_BY_CROSS_TENANT_STATE: "BLOCKED_BY_CROSS_TENANT_STATE",
} as const

const ROOT = process.cwd()
const BATCH_FILES = [
  "lib/growth/aios/runtime/growth-aios-runtime-context-1a.ts",
  "lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot.ts",
  "lib/growth/aios/execution/growth-canonical-execution-authority-1a.ts",
  "scripts/test-ge-aios-autonomy-recertification-1a.ts",
] as const

function deployedSha(): string {
  try {
    return execSync("gh api repos/blitzind/v0-app-equipify-ai/deployments --jq '.[0].sha'", {
      encoding: "utf8",
    }).trim()
  } catch {
    return "unknown"
  }
}

function batchOnSha(sha: string): boolean {
  return BATCH_FILES.every((file) => {
    try {
      execSync(`git cat-file -e ${sha}:${file}`, { stdio: "ignore" })
      return true
    } catch {
      return false
    }
  })
}

async function main(): Promise<void> {
  console.log("GE-AIOS-LIVE-INTERNAL-AUTONOMY-ACTIVATION-1B\n")
  assert.equal(process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN, "1")

  const sha = deployedSha()
  const aslSource = fs.readFileSync(
    path.join(ROOT, "lib/growth/specialists/execution/run-autonomous-sales-loop.ts"),
    "utf8",
  )

  const localPortfolioPath =
    aslSource.includes("buildGrowthAutonomousPortfolioWorkSnapshot") &&
    !aslSource.includes("buildGrowthHomeWorkspaceSummary")

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    console.error("Bootstrap failed")
    process.exit(1)
  }
  const admin = boot.admin
  const runtimeOrg = getGrowthEngineAiOrgId()
  const killSwitches = await getRuntimeKillSwitchStates(admin)

  const [{ count: equipifyLeads }, { count: equipifyDf }, { count: legacyDf }] = await Promise.all([
    admin
      .schema("growth")
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", EQUIPIFY_PRODUCTION_ORG_ID)
      .is("archived_at", null),
    admin
      .schema("growth")
      .from("draft_factory_lead_states")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", EQUIPIFY_PRODUCTION_ORG_ID),
    admin
      .schema("growth")
      .from("draft_factory_lead_states")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", "5876176a-61ec-4532-ad99-0c31482d5a91"),
  ])

  const { count: research24h } = await admin
    .schema("growth")
    .from("research_runs")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", EQUIPIFY_PRODUCTION_ORG_ID)
    .eq("status", "completed")
    .gte("completed_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  let schedulerColumns = false
  try {
    const { error } = await admin
      .schema("growth")
      .from("organization_growth_objectives")
      .select("scheduler_wake_at, scheduler_runtime_running")
      .limit(1)
    schedulerColumns = !error?.message?.includes("scheduler_wake_at")
  } catch {
    schedulerColumns = false
  }

  const report = {
    qa_marker: GE_AIOS_LIVE_INTERNAL_AUTONOMY_ACTIVATION_1B_QA_MARKER,
    deployment_sha: sha,
    runtime_batch_on_deployed_sha: batchOnSha(sha),
    local_asl_portfolio_snapshot_path: localPortfolioPath,
    runtime_org_id: runtimeOrg,
    documented_org: EQUIPIFY_PRODUCTION_ORG_ID,
    native_decision_enabled: isNativeRevenueDecisionEngineEnabled(),
    drq_enabled: isDailyRevenueWorkQueueEnabled(),
    outbound_disabled: !killSwitches.autonomy_outbound_enabled,
    scheduler_migration_columns: schedulerColumns,
    equipify_active_leads: equipifyLeads,
    equipify_draft_factory_states: equipifyDf,
    legacy_org_draft_factory_states: legacyDf,
    research_completed_24h: research24h,
    markers: {
      runtime_context: GROWTH_AIOS_RUNTIME_CONTEXT_1A_QA_MARKER,
      portfolio_snapshot: GROWTH_AUTONOMOUS_PORTFOLIO_WORK_SNAPSHOT_QA_MARKER,
      execution_authority: GROWTH_CANONICAL_EXECUTION_AUTHORITY_1A_QA_MARKER,
    },
  }

  console.log(JSON.stringify(report, null, 2))

  let verdict: keyof typeof GE_AIOS_LIVE_INTERNAL_AUTONOMY_ACTIVATION_1B_VERDICT =
    "BLOCKED_BY_UNDEPLOYED_RUNTIME"

  if (!report.runtime_batch_on_deployed_sha) {
    verdict = "BLOCKED_BY_UNDEPLOYED_RUNTIME"
  } else if (runtimeOrg !== EQUIPIFY_PRODUCTION_ORG_ID) {
    verdict = "BLOCKED_BY_ORGANIZATION_CONFIGURATION"
  } else if (!isNativeRevenueDecisionEngineEnabled()) {
    verdict = "BLOCKED_BY_PORTFOLIO_RANKING_CONFIGURATION"
  } else if ((equipifyLeads ?? 0) < 3) {
    verdict = "READY_AFTER_PORTFOLIO_ADMISSION"
  } else if ((research24h ?? 0) > 0 && killSwitches.autonomy_outbound_enabled === false) {
    verdict = "INTERNAL_AUTONOMY_ACTIVE"
  } else if ((equipifyLeads ?? 0) >= 3 && (research24h ?? 0) === 0) {
    verdict = "READY_AFTER_PORTFOLIO_ADMISSION"
  }

  if ((legacyDf ?? 0) > 0 && (equipifyDf ?? 0) === 0 && (research24h ?? 0) > 0) {
    verdict = "BLOCKED_BY_CROSS_TENANT_STATE"
  }

  console.log(`\nVERDICT: ${verdict}`)
  if (verdict !== "INTERNAL_AUTONOMY_ACTIVE") {
    process.exit(1)
  }
}

void main()
