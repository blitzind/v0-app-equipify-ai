/**
 * GE-LEADS-CANONICAL-4D — Legacy runtime branch strip certification.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/certify-ge-leads-canonical-legacy-strip-4d.ts
 */
import fs from "node:fs"
import path from "node:path"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  loadRevenueQueueDashboardPayload,
  parseRevenueQueueApiSource,
} from "@/lib/growth/revenue-queue/revenue-queue-api-bridge"
import { loadRevenueQueueOperatorWorkspace } from "@/lib/growth/revenue-queue/revenue-queue-detail-bridge"
import type { SupabaseClient } from "@supabase/supabase-js"

export const GE_LEADS_CANONICAL_LEGACY_STRIP_4D_QA_MARKER =
  "GE-LEADS-CANONICAL-4D-LEGACY-STRIP" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function verifyLeadInboxTableDropped(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("lead_inbox").select("id").limit(1)
  return Boolean(error?.message?.includes("does not exist") || error?.code === "PGRST205")
}

function runStaticChecks(): Record<string, boolean> {
  const apiBridge = readSource("lib/growth/revenue-queue/revenue-queue-api-bridge.ts")
  const detailBridge = readSource("lib/growth/revenue-queue/revenue-queue-detail-bridge.ts")
  const actionBridge = readSource("lib/growth/revenue-queue/revenue-queue-action-bridge.ts")
  const listRoute = readSource("app/api/platform/growth/lead-inbox/route.ts")
  const debugSource = readSource("lib/growth/home/growth-home-debug-source.ts")
  const synthesizer = readSource(
    "lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer.ts",
  )

  return {
    no_load_legacy_dashboard: !/loadLegacyRevenueQueueDashboardPayload/.test(apiBridge),
    no_load_lead_inbox_in_api_bridge: !/loadLeadInbox\(/.test(apiBridge),
    legacy_source_forced_canonical:
      parseRevenueQueueApiSource("legacy") === "canonical" &&
      parseRevenueQueueApiSource(null) === "canonical",
    list_route_no_source_param: !/parseRevenueQueueApiSource/.test(listRoute),
    detail_bridge_no_inbox_fallback: !/fetchLeadInboxById/.test(detailBridge),
    action_bridge_no_inbox_fallback: !/fetchLeadInboxById|applyLegacyInboxAction|claimLead\(/.test(
      actionBridge,
    ),
    action_bridge_canonical_only: /applyCanonicalLeadAction/.test(actionBridge),
    debug_source_uses_revenue_queue_loader: /loadRevenueQueueDashboardPayload/.test(debugSource),
    debug_source_no_load_lead_inbox: !/loadLeadInbox\(/.test(debugSource),
    synthesizer_no_lead_inbox_route: !/\/growth\/lead-inbox\?/.test(synthesizer),
    synthesizer_uses_canonical_lead_href: /\/admin\/growth\/leads\//.test(synthesizer),
  }
}

async function main(): Promise<void> {
  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = "1"
  const staticChecks = runStaticChecks()

  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          qa_marker: GE_LEADS_CANONICAL_LEGACY_STRIP_4D_QA_MARKER,
          error: "production_bootstrap_failed",
        },
        null,
        2,
      ),
    )
    process.exit(1)
  }

  const leadInboxDropped = await verifyLeadInboxTableDropped(boot.admin)

  const [defaultQueue, legacyParamQueue] = await Promise.all([
    loadRevenueQueueDashboardPayload(boot.admin, { sort: "priority", limit: 200 }),
    loadRevenueQueueDashboardPayload(boot.admin, {
      sort: "priority",
      limit: 200,
      source: "legacy",
    }),
  ])

  const sampleLeadId = defaultQueue.sections.flatMap((s) => s.items)[0]?.id ?? null
  const detail = sampleLeadId
    ? await loadRevenueQueueOperatorWorkspace(boot.admin, sampleLeadId)
    : null

  const certification = {
    qa_marker: GE_LEADS_CANONICAL_LEGACY_STRIP_4D_QA_MARKER,
    env_source: boot.env_source,
    supabase_host: new URL(boot.url).host,
    no_env_local: !fs.existsSync(path.join(process.cwd(), ".env.local")),
    static: staticChecks,
    production_read_only: {
      lead_inbox_table_dropped: leadInboxDropped,
      default_queue_source: defaultQueue.queue_source,
      legacy_param_queue_source: legacyParamQueue.queue_source,
      legacy_param_matches_canonical:
        legacyParamQueue.queue_source === "canonical" &&
        legacyParamQueue.total === defaultQueue.total,
      canonical_queue_total: defaultQueue.total,
      sample_detail_source: detail?.resolution.source ?? null,
    },
    revenue_queue_unchanged: defaultQueue.queue_source === "canonical" && defaultQueue.total >= 23,
    all_static_pass: Object.values(staticChecks).every(Boolean),
  }

  console.log(JSON.stringify(certification, null, 2))

  const failed =
    !certification.all_static_pass ||
    !leadInboxDropped ||
    !certification.revenue_queue_unchanged ||
    legacyParamQueue.queue_source !== "canonical" ||
    detail?.resolution.source !== "canonical_lead"

  if (failed) process.exit(1)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
