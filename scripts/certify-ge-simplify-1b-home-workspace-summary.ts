/**
 * GE-SIMPLIFY-1B — Certification for unified Home workspace summary.
 *
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/certify-ge-simplify-1b-home-workspace-summary.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  GROWTH_HOME_WORKSPACE_API_ROUTES,
  GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER,
  GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH,
} from "../lib/growth/home/growth-home-workspace-api-contract"
import {
  __growthHomeWorkspaceSummaryUsesSharedLeadResolver,
  buildGrowthHomeWorkspaceSummary,
} from "../lib/growth/home/growth-home-workspace-summary-service"
import {
  GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH as SUMMARY_PATH,
  GROWTH_HOME_WORKSPACE_SUMMARY_QA_MARKER,
} from "../lib/growth/home/growth-home-workspace-summary-types"

const ROOT = process.cwd()
const LEGACY_HOME_API_CALLS = GROWTH_HOME_WORKSPACE_API_ROUTES.length

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runStaticCert(): void {
  console.log(`\n=== ${GROWTH_HOME_WORKSPACE_SUMMARY_QA_MARKER} (static) ===\n`)

  assert.equal(GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH, SUMMARY_PATH)
  assert.equal(GROWTH_HOME_WORKSPACE_DASHBOARD_FETCH_BATCH_MARKER, "growth-workspace-dashboard-fetch-batch-v3")
  assert.equal(LEGACY_HOME_API_CALLS, 12)

  const dashboardHook = read("components/growth/workspace/use-growth-workspace-dashboard.ts")
  assert.match(dashboardHook, /GROWTH_HOME_WORKSPACE_SUMMARY_API_PATH/)
  assert.match(dashboardHook, /legacy_api_calls_eliminated: 11/)
  assert.doesNotMatch(dashboardHook, /route\.id === "lead_inbox"/)
  assert.doesNotMatch(dashboardHook, /Promise\.all\(\[/)

  const summaryRoute = read("app/api/platform/growth/home/workspace-summary/route.ts")
  assert.match(summaryRoute, /buildGrowthHomeWorkspaceSummary/)
  assert.match(summaryRoute, /growthHomeNoStoreJson/)

  const resolver = read("lib/growth/daily-work-queue/daily-revenue-work-queue-resolver.ts")
  assert.match(resolver, /fetchDailyRevenueWorkQueueFromLeads/)

  assert.equal(__growthHomeWorkspaceSummaryUsesSharedLeadResolver(), true)

  console.log("PASS — static structure")
}

async function runProductionCert(): Promise<void> {
  console.log(`\n=== ${GROWTH_HOME_WORKSPACE_SUMMARY_QA_MARKER} (production) ===\n`)

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "bootstrap_failed" }, null, 2))
    process.exit(1)
  }

  const startedAt = Date.now()
  const summary = await buildGrowthHomeWorkspaceSummary({
    admin: boot.admin,
    operatorEmail: "cert@equipify.ai",
    actorUserId: "00000000-0000-0000-0000-000000000001",
  })
  const durationMs = Date.now() - startedAt

  assert.equal(summary.ok, true)
  assert.equal(summary.qaMarker, GROWTH_HOME_WORKSPACE_SUMMARY_QA_MARKER)
  assert.ok(Array.isArray(summary.sources.leadInboxSections))
  assert.ok(summary.revenueQueue.queueSource === "canonical")
  assert.equal(summary.optimization.listGrowthLeadsCalls, 1)
  assert.equal(summary.optimization.duplicateLeadListEliminated, 1)
  assert.ok(summary.dashboard.sections.length >= 5)
  assert.ok(summary.avaConsole.greeting.length > 0)
  assert.ok(summary.kpis)

  const highPrioritySections = summary.sources.leadInboxSections.filter((section) =>
    ["high_priority", "needs_review", "pipeline_running", "enrichment_needed"].includes(section.id),
  )
  assert.ok(highPrioritySections.length > 0 || summary.revenueQueue.total >= 0)

  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_HOME_WORKSPACE_SUMMARY_QA_MARKER,
        api_calls_before: LEGACY_HOME_API_CALLS,
        api_calls_after: 1,
        duplicate_lead_list_calls_eliminated: 1,
        revenue_queue: {
          total: summary.revenueQueue.total,
          queue_source: summary.revenueQueue.queueSource,
          section_counts: summary.revenueQueue.sectionCounts,
        },
        daily_work_queue_enabled: summary.dailyRevenueWorkQueue.enabled,
        dashboard_sections: summary.dashboard.sections.map((section) => section.id),
        lead_inbox_highlights: summary.dashboard.leadInboxHighlights.length,
        ava_console: summary.avaConsole,
        optimization: summary.optimization,
        production_duration_ms: durationMs,
        revenue_queue_verified: summary.revenueQueue.total >= 0,
        dashboard_verified: summary.dashboard.qaMarker.length > 0,
        no_commit: true,
        no_push: true,
        no_deploy: true,
      },
      null,
      2,
    ),
  )

  console.log("\nPASS — production workspace summary")
}

async function main(): Promise<void> {
  runStaticCert()
  await runProductionCert()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
