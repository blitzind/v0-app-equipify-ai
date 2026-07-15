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
import {
  classifyBooleanFromDeployedOrLocal,
  classifySensitiveEnvPresence,
  classificationBlocksConfiguration,
} from "@/lib/growth/aios/runtime/growth-aios-runtime-config-health-1a-classifiers"
import { isNativeRevenueDecisionEngineEnabled } from "@/lib/growth/contact-verification/native-revenue-decision-feature"
import { isDailyRevenueWorkQueueEnabled } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-feature"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { fetchDeployedGrowthAiosRuntimeConfigHealth } from "@/lib/growth/qa/growth-aios-runtime-config-health-deployed-probe"
import { mintGrowthPlatformAdminBearerToken } from "@/lib/growth/qa/growth-platform-admin-bearer-probe"
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
  CONFIGURATION_UNVERIFIED_FROM_LOCAL_SECRET_CONTEXT: "CONFIGURATION_UNVERIFIED_FROM_LOCAL_SECRET_CONTEXT",
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

async function resolveDeployedRuntimeConfigHealth(boot: {
  url: string
  jwt: string
}): Promise<Awaited<ReturnType<typeof fetchDeployedGrowthAiosRuntimeConfigHealth>> | null> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!anonKey) return null

  const minted = await mintGrowthPlatformAdminBearerToken({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: anonKey,
  })
  if (!minted.access_token) return null

  return fetchDeployedGrowthAiosRuntimeConfigHealth({ bearerToken: minted.access_token })
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
  const killSwitches = await getRuntimeKillSwitchStates(admin)
  const vercelProductionEnvRun = process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1"

  const deployedHealth = await resolveDeployedRuntimeConfigHealth(boot)
  const deployedSnapshot = deployedHealth?.ok ? deployedHealth.snapshot : null

  const organizationConfiguredClassification = deployedSnapshot
    ? deployedSnapshot.organizationConfigured
      ? "verified_true"
      : "verified_false"
    : classifySensitiveEnvPresence("GROWTH_ENGINE_AI_ORG_ID")

  const organizationValidUuidClassification = deployedSnapshot
    ? deployedSnapshot.organizationValidUuid
      ? "verified_true"
      : "verified_false"
    : organizationConfiguredClassification === "unverified_sensitive_value"
      ? "unverified_sensitive_value"
      : organizationConfiguredClassification === "verified_true"
        ? "verified_true"
        : organizationConfiguredClassification

  const organizationProfileClassification = deployedSnapshot
    ? deployedSnapshot.organizationMatchesApprovedBusinessProfile
      ? "verified_true"
      : "verified_false"
    : organizationValidUuidClassification === "unverified_sensitive_value"
      ? "unverified_sensitive_value"
      : "not_configured"

  const nativeDecisionClassification = classifyBooleanFromDeployedOrLocal({
    deployedValue: deployedSnapshot?.nativeDecisionEngineEnabled,
    localValue: isNativeRevenueDecisionEngineEnabled(),
    localEnvPresent: process.env.GROWTH_NATIVE_DECISION_ENGINE?.trim() === "true",
    vercelProductionEnvRun,
  })

  const drqClassification = classifyBooleanFromDeployedOrLocal({
    deployedValue: deployedSnapshot?.dailyRevenueWorkQueueEnabled,
    localValue: isDailyRevenueWorkQueueEnabled(),
    localEnvPresent:
      process.env.GROWTH_DAILY_REVENUE_WORK_QUEUE?.trim() === "true" ||
      process.env.GROWTH_NATIVE_DECISION_ENGINE?.trim() === "true",
    vercelProductionEnvRun,
  })

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

  const schedulerMigrationReady =
    deployedSnapshot?.schedulerMigrationReady ??
    (await (async () => {
      try {
        const { error } = await admin
          .schema("growth")
          .from("organization_growth_objectives")
          .select("scheduler_wake_at, scheduler_runtime_running")
          .limit(1)
        return !error?.message?.includes("scheduler_wake_at")
      } catch {
        return false
      }
    })())

  const configurationClassifications = {
    organization_configured: organizationConfiguredClassification,
    organization_valid_uuid: organizationValidUuidClassification,
    organization_matches_approved_business_profile: organizationProfileClassification,
    native_decision_engine: nativeDecisionClassification,
    daily_revenue_work_queue: drqClassification,
  }

  const configurationVerifiedFromDeployedRuntime = deployedSnapshot != null
  const configurationUnverifiedLocally = Object.values(configurationClassifications).some(
    (value) => value === "unverified_sensitive_value",
  )
  const configurationBlockerPresent = [
    organizationConfiguredClassification,
    organizationValidUuidClassification,
    organizationProfileClassification,
    nativeDecisionClassification,
  ].some(classificationBlocksConfiguration)

  const report = {
    qa_marker: GE_AIOS_LIVE_INTERNAL_AUTONOMY_ACTIVATION_1B_QA_MARKER,
    deployment_sha: sha,
    runtime_batch_on_deployed_sha: batchOnSha(sha),
    local_asl_portfolio_snapshot_path: localPortfolioPath,
    configuration_verified_from_deployed_runtime: configurationVerifiedFromDeployedRuntime,
    deployed_runtime_config_probe: deployedHealth
      ? {
          probed: deployedHealth.probed,
          ok: deployedHealth.ok,
          status: deployedHealth.status,
          error: deployedHealth.ok ? null : deployedHealth.error,
        }
      : { probed: false, ok: false, status: null, error: "deployed_probe_unavailable" },
    configuration_classifications: configurationClassifications,
    configuration_unverified_from_local_secret_context: configurationUnverifiedLocally,
    outbound_disabled: deployedSnapshot ? !deployedSnapshot.outboundEnabled : !killSwitches.autonomy_outbound_enabled,
    scheduler_migration_ready: schedulerMigrationReady,
    active_objective_count: deployedSnapshot?.activeObjectiveCount ?? null,
    due_running_objective_count: deployedSnapshot?.dueRunningObjectiveCount ?? null,
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
  } else if (configurationUnverifiedLocally && !configurationVerifiedFromDeployedRuntime) {
    verdict = "CONFIGURATION_UNVERIFIED_FROM_LOCAL_SECRET_CONTEXT"
  } else if (configurationBlockerPresent) {
    verdict = "BLOCKED_BY_ORGANIZATION_CONFIGURATION"
  } else if (
    nativeDecisionClassification === "verified_false" ||
    drqClassification === "verified_false"
  ) {
    verdict = "BLOCKED_BY_PORTFOLIO_RANKING_CONFIGURATION"
  } else if ((equipifyLeads ?? 0) < 3) {
    verdict = "READY_AFTER_PORTFOLIO_ADMISSION"
  } else if ((research24h ?? 0) > 0 && report.outbound_disabled) {
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
