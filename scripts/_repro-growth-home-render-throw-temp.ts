/**
 * AVA-GROWTH-HOME-RENDER-HOTFIX-1A — reproduce render throw against production workspace-summary.
 */
import { execSync } from "node:child_process"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { normalizeGrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-runtime-safe-defaults"
import { mintGrowthPlatformAdminBearerToken } from "@/lib/growth/qa/growth-platform-admin-bearer-probe"
import { buildGrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-mapper"
import { synthesizeGrowthHomeExecutiveBriefing } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"

async function main(): Promise<void> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) throw new Error("bootstrap failed")

  const projectRef = boot.url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  if (!projectRef) throw new Error("no project ref")
  const anon = (
    JSON.parse(
      execSync(`supabase projects api-keys --project-ref ${projectRef} -o json`, { encoding: "utf8" }),
    ) as Array<{ name: string; api_key: string }>
  ).find((entry) => entry.name === "anon")?.api_key
  if (!anon) throw new Error("no anon")

  const minted = await mintGrowthPlatformAdminBearerToken({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: anon,
    admin_email: "mike@blitzind.com",
  })
  if (!minted.access_token) throw new Error(minted.error ?? "mint_failed")

  const res = await fetch("https://app.equipify.ai/api/platform/growth/home/workspace-summary", {
    headers: { Authorization: `Bearer ${minted.access_token}` },
  })
  const raw = (await res.json()) as Record<string, unknown>
  const payload = normalizeGrowthHomeWorkspaceSummaryPayload(raw)
  const dashboard = payload.dashboard ?? buildGrowthWorkspaceDashboardViewModel(payload.sources)

  console.log("payload_shapes", {
    portfolioManager: payload.portfolioManager
      ? {
          hasHealth: Boolean((payload.portfolioManager as { health?: unknown }).health),
          hasTarget: Boolean((payload.portfolioManager as { target?: unknown }).target),
        }
      : null,
    operatorTasks: payload.operatorTasks ?? null,
    kpis: payload.kpis ?? null,
    avaActivation: payload.avaActivation?.activated ?? null,
  })
  const approval = payload.canonicalOperatorApproval
  console.log("approval_snapshot", {
    present: Boolean(approval),
    packagesType: approval ? typeof (approval as { packages?: unknown }).packages : null,
    packagesIsArray: approval ? Array.isArray((approval as { packages?: unknown }).packages) : null,
    keys: approval ? Object.keys(approval as object) : [],
  })

  try {
    // Reproduce dashboard useMemo access patterns (pre-hotfix)
    const brokenPortfolio =
      (payload.portfolioManager?.health.needsCount ?? 0) > 0
    console.log("broken_portfolio_ok", brokenPortfolio)
  } catch (error) {
    console.log("broken_portfolio_throw", error instanceof Error ? error.message : String(error))
  }

  try {
    const brokenOperatorTasks = payload.operatorTasks.leadsNeedingAction ?? 0
    console.log("broken_operator_tasks_ok", brokenOperatorTasks)
  } catch (error) {
    console.log("broken_operator_tasks_throw", error instanceof Error ? error.message : String(error))
  }

  try {
    const briefing = synthesizeGrowthHomeExecutiveBriefing({
      dashboard,
      teammate: resolveAiTeammatePresentation("Ava"),
      portfolioBelowTarget: ((payload.portfolioManager as { health?: { needsCount?: number } } | null)?.health?.needsCount ?? 0) > 0,
      portfolioTargetCurrent:
        (payload.portfolioManager as { health?: { counts?: { activeCompanies?: number } } } | null)?.health?.counts
          ?.activeCompanies ?? null,
      portfolioTargetGoal:
        (payload.portfolioManager as { target?: { targetActiveCompanies?: number } } | null)?.target
          ?.targetActiveCompanies ?? null,
      portfolioOperator: payload.portfolioManager?.operator ?? null,
      productionMissionAuthority: payload.productionMissionAuthority ?? null,
      canonicalOperatorApproval: payload.canonicalOperatorApproval ?? null,
      canonicalOperatorTask: payload.canonicalOperatorTask ?? null,
      canonicalActiveMissions: payload.canonicalActiveMissions ?? null,
      canonicalOperatorFocus: payload.canonicalOperatorFocus ?? null,
      supervisedOperatorAttention: payload.supervisedOperatorAttention ?? null,
      missionDiscovery: payload.missionDiscovery ?? null,
    })
    console.log("synthesize_ok", {
      approveItemsCount: briefing.aiOsUx.approveItemsCount,
      waitingOnYou: briefing.aiOsUx.waitingOnYou.length,
    })
  } catch (error) {
    console.log("synthesize_throw", error instanceof Error ? error.message : String(error))
    if (error instanceof Error) {
      console.log(error.stack?.split("\n").slice(0, 10).join("\n"))
    }
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
